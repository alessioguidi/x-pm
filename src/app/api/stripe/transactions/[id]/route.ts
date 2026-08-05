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

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getAuthedClient(req);
  const orgId = await getOrgId(supabase);
  if (!orgId) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const { data: tx } = await supabase
    .from("stripe_transactions")
    .select("id, payment_intent_id")
    .eq("id", id)
    .eq("organization_id", orgId)
    .single();

  if (!tx) return NextResponse.json({ error: "Transazione non trovata" }, { status: 404 });

  try {
    if (tx.payment_intent_id) {
      const pi = await stripe.paymentIntents.retrieve(tx.payment_intent_id);
      if (pi.status === "requires_payment_method" || pi.status === "requires_confirmation" || pi.status === "processing") {
        await stripe.paymentIntents.cancel(tx.payment_intent_id);
      }
    }
  } catch (e) {
    console.error("[stripe/transactions] cancel on delete failed", e);
  }

  const { error } = await supabase.from("stripe_transactions").delete().eq("id", id).eq("organization_id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getAuthedClient(req);
  const orgId = await getOrgId(supabase);
  if (!orgId) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const { status } = await req.json();

  const { data: tx } = await supabase
    .from("stripe_transactions")
    .select("id, payment_intent_id, status")
    .eq("id", id)
    .eq("organization_id", orgId)
    .single();

  if (!tx) return NextResponse.json({ error: "Transazione non trovata" }, { status: 404 });

  const patch: any = { status };
  if (status === "succeeded" || status === "paid") {
    patch.status = "succeeded";
    patch.paid_at = new Date().toISOString();
  }

  const { error } = await supabase.from("stripe_transactions").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
