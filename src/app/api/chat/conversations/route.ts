import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const authHeader = req.headers.get("Authorization");
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    global: { headers: { Authorization: authHeader || "" } }
  });

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile?.organization_id) return NextResponse.json({ error: "Profilo non trovato" }, { status: 404 });

    const { data: conversations, error } = await supabase
      .from('conversations')
      .select(`
        *,
        conversation_participants(
          *,
          profiles(full_name, role)
        )
      `)
      .eq('organization_id', profile.organization_id)
      .order('last_message_at', { nullsFirst: false, ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (conversations && conversations.length > 0) {
      const conv = conversations[0];
      const isParticipant = conv.conversation_participants?.some(
        (p: any) => p.profile_id === user.id
      );
      
      if (!isParticipant) {
        await supabase.from('conversation_participants').insert({
          conversation_id: conv.id,
          profile_id: user.id,
          joined_at: new Date().toISOString()
        });
        
        conversations[0].conversation_participants = [
          ...(conv.conversation_participants || []),
          { profile_id: user.id, profiles: { full_name: null, role: '' } }
        ];
      }
    }

    return NextResponse.json(conversations || []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}