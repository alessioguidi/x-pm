import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    return NextResponse.json({ error: "Token mancante" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

    const { data: bookings } = await supabase.from('bookings').select(`
      id, total_price, extra_services, channel_id, property_id,
      properties(default_checkin_staff_id, default_checkout_staff_id, default_cleaning_staff_id)
    `);

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ updated: 0, message: "Nessuna prenotazione trovata" });
    }

    const allStaffIds = [...new Set(bookings.flatMap((b: any) =>
      [b.properties?.default_checkin_staff_id, b.properties?.default_checkout_staff_id, b.properties?.default_cleaning_staff_id].filter(Boolean)
    ))];
    const { data: staffList } = await supabase.from('staff_members').select('id, cost_per_service').in('id', allStaffIds);
    const costMap: Record<string, number> = {};
    staffList?.forEach((s: any) => { costMap[s.id] = Number(s.cost_per_service || 0); });

    const { data: channels } = await supabase.from('booking_channels').select('id, commission_pct, tax_pct');
    const channelMap: Record<string, any> = {};
    channels?.forEach((c: any) => { channelMap[c.id] = c; });

    let updated = 0;
    for (const booking of bookings) {
      const prop = (booking as any).properties || {};
      const staffIds = [prop.default_checkin_staff_id, prop.default_checkout_staff_id, prop.default_cleaning_staff_id].filter(Boolean);
      const staffCost = staffIds.reduce((acc: number, id: string) => acc + (costMap[id] || 0), 0);

      const extServices = (booking as any).extra_services || [];
      const servicesCost = extServices.reduce((acc: number, e: any) => acc + Number(e.cost_price || 0) * Number(e.qty || 1), 0);

      const ch = (booking as any).channel_id ? channelMap[(booking as any).channel_id] : null;
      const totalPrice = Number((booking as any).total_price || 0);
      const commissionAmount = ch ? Math.round(totalPrice * Number(ch.commission_pct || 0) / 100 * 100) / 100 : 0;
      const taxAmount = ch ? Math.round(totalPrice * Number(ch.tax_pct || 0) / 100 * 100) / 100 : 0;

      const { error: upErr } = await supabase.from('bookings').update({
        staff_cost: staffCost,
        services_cost: servicesCost,
        commission_amount: commissionAmount,
        tax_amount: taxAmount,
      }).eq('id', (booking as any).id);

      if (!upErr) updated++;
    }

    return NextResponse.json({ updated, message: `${updated} prenotazioni aggiornate` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
