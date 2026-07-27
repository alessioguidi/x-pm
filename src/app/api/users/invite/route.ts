import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const authHeader = req.headers.get("Authorization");
  
  if (!authHeader) {
    return NextResponse.json({ error: "Token mancante" }, { status: 401 });
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } }
  });

  try {
    const { data: { user: adminUser }, error: userError } = await supabase.auth.getUser();
    if (userError || !adminUser) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const { email, name, role, organization_id } = await req.json();

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, organizations(*)')
      .eq('id', adminUser.id)
      .single();
    
    if (!profile?.organization_id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const inviteToken = crypto.randomUUID();
    
    const { data: invite, error: inviteError } = await supabase
      .from('invitations')
      .insert({
        email,
        name,
        role,
        organization_id: profile.organization_id,
        token: inviteToken,
        invited_by: adminUser.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    if (inviteError) {
      console.log("Invite insert error:", inviteError);
    }

    const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/register/${inviteToken}`;

    const org = Array.isArray(profile.organizations) ? profile.organizations[0] : profile.organizations as any;
    
    if (org?.smtp_host) {
      try {
        const transporter = nodemailer.createTransport({
          host: org.smtp_host,
          port: Number(org.smtp_port || 465),
          secure: Number(org.smtp_port) === 465,
          auth: {
            user: org.smtp_user,
            pass: org.smtp_pass
          }
        });

        await transporter.sendMail({
          from: `"${org.name}" <${org.smtp_from_email || org.smtp_user}>`,
          to: email,
          subject: `Invito a unirti a ${org.name}`,
          html: `
            <h2>Ciao ${name}!</h2>
            <p>Sei stato invitato a unirti al team di <strong>${org.name}</strong>.</p>
            <p>Clicca sul link qui sotto per registrarti:</p>
            <p><a href="${inviteUrl}" style="background: #E11D48; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">Registrati</a></p>
            <p style="color: #666; font-size: 12px;">Questo link scade tra 7 giorni.</p>
          `
        });
        
        return NextResponse.json({ success: true, message: "Email inviata!" });
      } catch (mailError) {
        console.log("Mail error:", mailError);
      }
    }

    return NextResponse.json({ 
      url: inviteUrl,
      success: true,
      message: "Ecco il link di invito:"
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}