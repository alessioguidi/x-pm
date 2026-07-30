import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { payment_intent_id, booking_id } = await req.json();
    if (!payment_intent_id) return NextResponse.json({ error: "payment_intent_id richiesto" }, { status: 400 });

    const bid = booking_id || (await findBookingByPi(payment_intent_id));
    if (!bid) return NextResponse.json({ error: "Prenotazione non trovata" }, { status: 404 });

    await supabase.from("bookings").update({ deposit_status: "authorized" }).eq("id", bid);

    const { data: tx } = await supabase
      .from("cash_transactions")
      .select("id")
      .eq("booking_id", bid)
      .eq("reason", "Cauzione Danni")
      .eq("status", "scheduled")
      .maybeSingle();

    if (tx) {
      await supabase
        .from("cash_transactions")
        .update({ status: "confirmed" })
        .eq("id", tx.id);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[confirm-deposit]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function findBookingByPi(piId: string) {
  const { data } = await supabase
    .from("bookings")
    .select("id")
    .eq("stripe_payment_intent_id", piId)
    .maybeSingle();
  return data?.id;
}
