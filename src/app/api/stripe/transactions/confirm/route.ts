import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/utils/stripe/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { payment_intent_id } = await req.json();
    if (!payment_intent_id) return NextResponse.json({ error: "payment_intent_id richiesto" }, { status: 400 });

    const pi = await stripe.paymentIntents.retrieve(payment_intent_id);

    const statusMap: Record<string, string> = {
      requires_payment_method: "pending",
      requires_confirmation: "pending",
      processing: "processing",
      requires_capture: "authorized",
      succeeded: "succeeded",
      canceled: "cancelled",
    };

    const newStatus = statusMap[pi.status] || pi.status;
    const patch: any = { status: newStatus };
    if (pi.status === "succeeded") patch.paid_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("stripe_transactions")
      .update(patch)
      .eq("payment_intent_id", payment_intent_id)
      .select()
      .maybeSingle();

    if (error) {
      console.error("[stripe/transactions/confirm]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Pagamento riuscito: registra come incassati i movimenti di Prima Nota inclusi nel pagamento online
    if (pi.status === "succeeded" && pi.metadata?.tx_ids) {
      const ids = pi.metadata.tx_ids.split(",").filter(Boolean);
      if (ids.length > 0) {
        const { error: ctError } = await supabase
          .from("cash_transactions")
          .update({ status: "confirmed" })
          .in("id", ids)
          .eq("status", "scheduled");
        if (ctError) console.error("[stripe/transactions/confirm] cash_transactions update failed", ctError);
      }
    }

    return NextResponse.json({ success: true, status: newStatus, transaction: data || null });
  } catch (err: any) {
    console.error("[stripe/transactions/confirm]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
