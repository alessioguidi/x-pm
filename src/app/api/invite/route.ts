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
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Non autorizzato", details: userError?.message }, { status: 401 });
    }

    const { staff_id, email, name } = await req.json();

    const { data: staff } = await supabase
      .from('staff_members')
      .select('*, organizations(*)')
      .eq('id', staff_id)
      .single();

    if (!staff) return NextResponse.json({ error: "Staff non trovato" }, { status: 404 });

    const org = staff.organizations;

    const magicToken = crypto.randomUUID();
    
    await supabase
      .from('staff_members')
      .update({ magic_token: magicToken })
      .eq('id', staff_id);

    const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/invite/${magicToken}`;

    if (org?.smtp_host) {
      try {
        const transporter = nodemailer.createTransport({
          host: org.smtp_host,
          port: Number(org.smtp_port || 465),
          secure: Number(org.smtp_port) === 465,
          auth: {
            user: org.smtp_user || org.smtp_config?.user,
            pass: org.smtp_pass || org.smtp_config?.pass
          }
        });

        await transporter.sendMail({
          from: `"${org.name}" <${org.smtp_from_email || org.smtp_user}>`,
          to: email,
          subject: `Invito a unirti a ${org.name}`,
          html: `
            <h2>Ciao ${name || staff.name}!</h2>
            <p>Sei stato invitato a unirti al team di <strong>${org.name}</strong>.</p>
            <p>Clicca sul link qui sotto per registrarti e accedere all'app:</p>
            <p><a href="${inviteUrl}" style="background: #E11D48; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">Accetta Invito</a></p>
            <p style="color: #666; font-size: 12px;">Questo link scade tra 7 giorni.</p>
          `
        });
      } catch (mailError) {
        console.error("Mail error:", mailError);
        return NextResponse.json({ 
          url: inviteUrl,
          message: "Email non inviata, ma ecco il link:"
        });
      }
    } else {
      return NextResponse.json({ 
        url: inviteUrl,
        message: "Email non configurata. Ecco il link da condividere:"
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}