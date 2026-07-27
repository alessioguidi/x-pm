import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const authHeader = req.headers.get("Authorization");
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader || "" } }
  });

  try {
    const { channel, content } = await req.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

    const { data: booking, error: bkError } = await supabase
      .from('bookings')
      .select('*, properties(name), organizations(*)')
      .eq('id', id)
      .single();

    if (bkError || !booking) return NextResponse.json({ error: "Prenotazione non trovata" }, { status: 404 });

    const org = booking.organizations;

    // 1. Internal Note
    if (channel === 'internal') {
        await supabase.from('booking_messages').insert({
            booking_id: booking.id,
            organization_id: org.id,
            sender_user_id: user.id,
            direction: 'internal',
            channel: 'internal',
            content: content
        });
        return NextResponse.json({ success: true });
    }

    // 2. Outbound WhatsApp
    if (channel === 'whatsapp') {
        const apiUrl = process.env.EVOLUTION_API_URL || "";
        const apiKey = process.env.EVOLUTION_API_KEY || "";
        const instanceName = `org-${org.id.replace(/-/g, '').substring(0, 20)}`;

        if (apiUrl && booking.guest_phone) {
             let cleanPhone = booking.guest_phone.replace(/[^0-9]/g, '');
             // Default country code setup if missing (assuming IT 39 for local)
             if (cleanPhone.length <= 10) cleanPhone = "39" + cleanPhone;

             try {
                const res = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
                     method: 'POST',
                     headers: {
                         'Content-Type': 'application/json',
                         'apikey': apiKey
                     },
                     body: JSON.stringify({
                         number: cleanPhone,
                         text: content
                     })
                 });
                 if (!res.ok) console.error("Evolution API Error:", await res.text());
             } catch (wError) {
                console.error("Evolution Catch:", wError);
             }
        } else {
             console.log("No Whatsapp configured or no phone number found.");
        }

        await supabase.from('booking_messages').insert({
            booking_id: booking.id,
            organization_id: org.id,
            sender_user_id: user.id,
            direction: 'outbound',
            channel: 'whatsapp',
            content: content
        });
        return NextResponse.json({ success: true });
    }

    // 3. Outbound Email
    if (channel === 'email') {
        if (org.smtp_host || org.smtp_config?.host) {
          const host = org.smtp_host || org.smtp_config?.host;
          const port = org.smtp_port || org.smtp_config?.port || 465;
          const secure = Number(port) === 465;

          try {
             const transporter = nodemailer.createTransport({
                 host: host,
                 port: Number(port),
                 secure: secure,
                 auth: { 
                     user: org.smtp_user || org.smtp_config?.user, 
                     pass: org.smtp_pass || org.smtp_config?.pass 
                 }
             });

             await transporter.sendMail({
                 from: `"${org.name}" <${org.smtp_from_email || org.smtp_user}>`,
                 to: booking.guest_email,
                 subject: `Messaggio da ${booking.properties?.name}`,
                 text: content,
                 html: content.replace(/\n/g, '<br/>')
             });
          } catch (mailError) {
             console.error("[SMTP] Fallimento invio msg manuale:", mailError);
          }
        } else {
           console.log("Nessun SMTP Configurato per questo invio Email.");
        }

        await supabase.from('booking_messages').insert({
            booking_id: booking.id,
            organization_id: org.id,
            sender_user_id: user.id,
            direction: 'outbound',
            channel: 'email',
            content: content
        });
        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Canale non valido" }, { status: 400 });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
