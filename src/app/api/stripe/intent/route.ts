import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID richiesto" }, { status: 400 });

  try {
    const pi = await stripe.paymentIntents.retrieve(id);
    const bookingId = pi.metadata?.booking_id;
    let booking = null;

    if (bookingId) {
      const { data } = await supabase
        .from("bookings")
        .select("guest_name, check_in_date, check_out_date, properties(name)")
        .eq("id", bookingId)
        .single();
      booking = data;
    }

    return NextResponse.json({
      id: pi.id,
      amount: pi.amount / 100,
      currency: pi.currency,
      status: pi.status,
      client_secret: pi.client_secret,
      booking,
    });
  } catch {
    return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  }
}
