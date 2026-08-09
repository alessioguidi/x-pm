import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/utils/stripe/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { booking_id } = await req.json();
    if (!booking_id) return NextResponse.json({ error: "booking_id richiesto" }, { status: 400 });

    const { data: booking } = await supabase
      .from("bookings")
      .select("id, guest_name, guest_email, property_id, organization_id")
      .eq("id", booking_id)
      .single();

    if (!booking) return NextResponse.json({ error: "Prenotazione non trovata" }, { status: 404 });

    const { data: property } = await supabase
      .from("properties")
      .select("deposit_method")
      .eq("id", booking.property_id)
      .single();

    const { data: pending } = await supabase
      .from("cash_transactions")
      .select("*")
      .eq("booking_id", booking_id)
      .eq("status", "scheduled");

    // Se la cauzione è gestita via pre-autorizzazione Stripe, escludila dal saldo online
    const depositMethod = property?.deposit_method || "cash";
    const due = (pending || []).filter(p => Number(p.amount) > 0 && !(p.reason === "Cauzione Danni" && depositMethod === "stripe"));
    const total = due.reduce((sum, p) => sum + Number(p.amount), 0);

    if (due.length === 0 || total <= 0) {
      return NextResponse.json({ error: "Nessun pagamento in sospeso" }, { status: 400 });
    }

    const reason = due.map(p => p.reason || "Pagamento").join(" + ");
    const txIds = due.map(p => p.id).join(",");

    const pi = await stripe.paymentIntents.create({
      amount: Math.round(total * 100),
      currency: "eur",
      capture_method: "automatic",
      description: `Pagamento all'arrivo — ${reason}`,
      metadata: {
        organization_id: booking.organization_id || "",
        property_id: booking.property_id || "",
        booking_id: booking.id,
        tx_ids: txIds,
        guest_name: booking.guest_name || "",
        guest_email: booking.guest_email || "",
        reason,
      },
      automatic_payment_methods: { enabled: true },
    });

    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "";
    const paymentLink = `${origin}/stripe-pay/${pi.id}`;

    await supabase.from("stripe_transactions").insert({
      organization_id: booking.organization_id || null,
      property_id: booking.property_id || null,
      booking_id: booking.id,
      payment_intent_id: pi.id,
      guest_name: booking.guest_name || null,
      guest_email: booking.guest_email || null,
      amount: total,
      reason,
      capture_method: "automatic",
      status: "pending",
      payment_link: paymentLink,
    });

    return NextResponse.json({ payment_link: paymentLink, payment_intent_id: pi.id, total });
  } catch (err: any) {
    console.error("[stripe/pay-pending]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
