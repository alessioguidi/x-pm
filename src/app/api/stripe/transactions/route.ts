import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/utils/stripe/server";

function getAuthedClient(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const authHeader = req.headers.get("Authorization");
  return createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader || "" } },
  });
}

async function getOrgId(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  return profile?.organization_id || null;
}

export async function GET(req: NextRequest) {
  const supabase = getAuthedClient(req);
  const orgId = await getOrgId(supabase);
  if (!orgId) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const { data, error } = await supabase
    .from("stripe_transactions")
    .select("*, properties(name), bookings(guest_name, check_in_date, check_out_date)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ transactions: data || [] });
}

export async function POST(req: NextRequest) {
  const supabase = getAuthedClient(req);
  const orgId = await getOrgId(supabase);
  if (!orgId) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  try {
    const { booking_id, guest_name, guest_email, property_id, amount, reason, capture_method } = await req.json();

    const value = Number(amount);
    if (!value || value <= 0) return NextResponse.json({ error: "Importo non valido" }, { status: 400 });
    if (!guest_name) return NextResponse.json({ error: "Nome ospite richiesto" }, { status: 400 });
    if (!guest_email) return NextResponse.json({ error: "Email ospite richiesta" }, { status: 400 });

    let effectivePropertyId = property_id || null;
    let effectiveGuestName = guest_name;
    let effectiveGuestEmail = guest_email;

    if (booking_id) {
      const { data: booking, error: bkError } = await supabase
        .from("bookings")
        .select("id, guest_name, guest_email, property_id, organization_id")
        .eq("id", booking_id)
        .single();

      if (bkError || !booking) return NextResponse.json({ error: "Prenotazione non trovata" }, { status: 404 });
      if (booking.organization_id !== orgId) return NextResponse.json({ error: "Prenotazione non autorizzata" }, { status: 403 });

      effectivePropertyId = booking.property_id;
      effectiveGuestName = booking.guest_name || guest_name;
      effectiveGuestEmail = booking.guest_email || guest_email;
    }

    const pi = await stripe.paymentIntents.create({
      amount: Math.round(value * 100),
      currency: "eur",
      capture_method: capture_method === "manual" ? "manual" : "automatic",
      description: reason || "Pagamento",
      metadata: {
        organization_id: orgId,
        property_id: effectivePropertyId || "",
        booking_id: booking_id || "",
        guest_name: effectiveGuestName,
        guest_email: effectiveGuestEmail,
        reason: reason || "",
      },
      automatic_payment_methods: { enabled: true },
    });

    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "";
    const paymentLink = `${origin}/stripe-pay/${pi.id}`;

    const { data: row, error: insertError } = await supabase
      .from("stripe_transactions")
      .insert({
        organization_id: orgId,
        property_id: effectivePropertyId,
        booking_id: booking_id || null,
        payment_intent_id: pi.id,
        guest_name: effectiveGuestName,
        guest_email: effectiveGuestEmail,
        amount: value,
        reason: reason || null,
        capture_method: capture_method === "manual" ? "manual" : "automatic",
        status: "pending",
        payment_link: paymentLink,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[stripe/transactions] insert failed", insertError);
      return NextResponse.json({ error: "Errore nel salvataggio transazione" }, { status: 500 });
    }

    return NextResponse.json({ transaction: row, payment_link: paymentLink }, { status: 201 });
  } catch (err: any) {
    console.error("[stripe/transactions]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
