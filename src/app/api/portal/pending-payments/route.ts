import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const bookingId = req.nextUrl.searchParams.get("booking_id");
    if (!bookingId) return NextResponse.json({ error: "booking_id richiesto" }, { status: 400 });

    const { data: booking } = await supabase
      .from("bookings")
      .select("property_id")
      .eq("id", bookingId)
      .single();

    if (!booking) return NextResponse.json({ error: "Prenotazione non trovata" }, { status: 404 });

    const { data: property } = await supabase
      .from("properties")
      .select("deposit_method")
      .eq("id", booking.property_id)
      .single();

    const { data: pending } = await supabase
      .from("cash_transactions")
      .select("id, reason, amount")
      .eq("booking_id", bookingId)
      .eq("status", "scheduled")
      .order("created_at", { ascending: true });

    const depositMethod = property?.deposit_method || "cash";
    const due = (pending || []).filter(p => Number(p.amount) > 0 && !(p.reason === "Cauzione Danni" && depositMethod === "stripe"));
    const total = due.reduce((sum, p) => sum + Number(p.amount), 0);

    return NextResponse.json({ payments: due, total });
  } catch (err: any) {
    console.error("[portal/pending-payments]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
