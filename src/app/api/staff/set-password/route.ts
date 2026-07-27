import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    return NextResponse.json({ error: "Token mancante" }, { status: 401 });
  }

  if (!supabaseServiceKey) {
    return NextResponse.json({ error: "Service role key non configurata" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const { staff_id, email, password, name } = await req.json();

    if (!email || !password || !staff_id) {
      return NextResponse.json({ error: "Email, password e staff_id richiesti" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password deve essere almeno 6 caratteri" }, { status: 400 });
    }

    const { data: staff } = await supabase
      .from('staff_members')
      .select('*')
      .eq('id', staff_id)
      .single();

    if (!staff) return NextResponse.json({ error: "Staff non trovato" }, { status: 404 });

    if (staff.user_id) {
      return NextResponse.json({ error: "Questo membro staff ha già un account" }, { status: 400 });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name || staff.name }
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: "Errore nella creazione utente" }, { status: 500 });
    }

    const { error: profileError } = await adminClient.from('profiles').insert({
      id: authData.user.id,
      organization_id: staff.organization_id,
      full_name: name || staff.name,
      role: 'org_staff'
    });

    if (profileError) {
      await adminClient.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: "Errore creazione profilo: " + profileError.message }, { status: 500 });
    }

    const { error: staffUpdateError } = await adminClient
      .from('staff_members')
      .update({ user_id: authData.user.id, magic_token: null })
      .eq('id', staff_id);

    if (staffUpdateError) {
      await adminClient.from('profiles').delete().eq('id', authData.user.id);
      await adminClient.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: "Errore aggiornamento staff" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
