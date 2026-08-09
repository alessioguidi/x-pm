import { createClient } from "@supabase/supabase-js";

export function getSupabaseServer() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function getGuestBookingMeta(id: string) {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("bookings")
    .select("guest_name, check_in_date, check_out_date, properties(name)")
    .eq("id", id)
    .single();

  if (!data) return null;
  const props: any = Array.isArray(data.properties) ? data.properties[0] : data.properties;
  return { ...data, properties: props || null };
}

export function fmtRange(inDate?: string | null, outDate?: string | null) {
  if (!inDate || !outDate) return "";
  return `${inDate.split("-").reverse().join("/")} - ${outDate.split("-").reverse().join("/")}`;
}
