import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createPreAuth, capturePreAuth, releasePreAuth } from "@/utils/stripe/server";

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return NextResponse.json({ error: "Token mancante" }, { status: 401 });

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  try {
    const { action, booking_id, payment_intent_id } = await req.json();

    if (action === "create") {
      const { data: booking } = await supabase
        .from("bookings")
        .select("*, properties!inner(*)")
        .eq("id", booking_id)
        .single();

      if (!booking) return NextResponse.json({ error: "Prenotazione non trovata" }, { status: 404 });

      const depositAmount = booking.properties.security_deposit || 0;
      if (depositAmount <= 0) return NextResponse.json({ error: "Cauzione non configurata" }, { status: 400 });

      const pi = await createPreAuth(depositAmount, "eur", {
        booking_id: booking.id,
        property_id: booking.properties.id,
        property_name: booking.properties.name,
      });

      await supabase.from("bookings").update({
        deposit_status: "pending",
        stripe_payment_intent_id: pi.id,
      }).eq("id", booking.id);

      return NextResponse.json({ client_secret: pi.client_secret, payment_intent_id: pi.id });
    }

    if (action === "capture") {
      if (!payment_intent_id) return NextResponse.json({ error: "payment_intent_id richiesto" }, { status: 400 });
      const pi = await capturePreAuth(payment_intent_id);

      if (booking_id) {
        await supabase.from("bookings").update({ deposit_status: "captured" }).eq("id", booking_id);
      }

      return NextResponse.json({ status: pi.status });
    }

    if (action === "release") {
      if (!payment_intent_id) return NextResponse.json({ error: "payment_intent_id richiesto" }, { status: 400 });
      const pi = await releasePreAuth(payment_intent_id);

      if (booking_id) {
        await supabase.from("bookings").update({ deposit_status: "released" }).eq("id", booking_id);
      }

      return NextResponse.json({ status: pi.status });
    }

    return NextResponse.json({ error: "Azione non valida" }, { status: 400 });
  } catch (err: any) {
    console.error("[stripe/deposit]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
