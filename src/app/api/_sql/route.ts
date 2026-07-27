import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase/client'; // client or server? There is a client

export async function GET() {
   // get all tables using postgrest or just list from pg_catalog
   const { data, error } = await supabase.from('properties').select('*').limit(1);
   // wait, what tables do we have?
   return NextResponse.json({ ok: true, data });
}
