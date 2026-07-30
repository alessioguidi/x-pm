import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const bookingId = resolvedParams.id;

  try {
    // 1. Dati prenotazione completi
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*, organizations(name, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from_email, booking_email_template), properties(name, deposit_percentage, security_deposit)')
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      return NextResponse.json({ error: 'Prenotazione non trovata.' }, { status: 404 });
    }

    const org = booking.organizations;
    const prop = booking.properties;

    if (!org || !org.smtp_host || !org.smtp_user || !org.smtp_pass || !org.smtp_from_email) {
       console.log(`[SIMULATORE SMTP] Reinviato Riepilogo a ${booking.guest_email}: Totale agg: ${booking.total_price}`);
       return NextResponse.json({ success: true, simulated: true });
    }

    // 2. Invio Reale SMTP
    const transporter = nodemailer.createTransport({
       host: org.smtp_host,
       port: org.smtp_port || 465,
       secure: org.smtp_port === 465,
       auth: {
         user: org.smtp_user,
         pass: org.smtp_pass
       },
       tls: { rejectUnauthorized: false }
    });

    let htmlContent = org.booking_email_template;
    if (!htmlContent) {
      let extraHtml = "";
      if (booking.extra_services && booking.extra_services.length > 0) {
         extraHtml = "<h3>Servizi Extra Richiesti / Aggiunti:</h3><ul>";
         booking.extra_services.forEach((ex: any) => {
           extraHtml += `<li><b>${ex.name}</b> x${ex.qty}: €${ex.total}</li>`;
         });
         extraHtml += "</ul>";
      }

      const caparraReq = prop && prop.deposit_percentage > 0 ? (booking.total_price * prop.deposit_percentage / 100).toFixed(2) : '0.00';
      const cauzioneDanni = prop && prop.security_deposit > 0 ? prop.security_deposit : '0.00';

      htmlContent = `
         <h1>Riepilogo Aggiornato Prenotazione</h1>
         <p>Ciao {{guest_name}},</p>
         <p>La tua pratica per la struttura <b>${prop?.name || 'Selezionata'}</b> dal <b>{{check_in_date}}</b> al <b>{{check_out_date}}</b> è stata aggiornata dal manager.</p>
         ${extraHtml}
         <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin-top: 20px;">
           <p style="margin: 0;">Il Nuovo Importo Totale è: <b>€{{total_price}}</b></p>
           ${Number(caparraReq) > 0 ? `<p style="margin: 5px 0 0 0; color: #b45309;">Caparra Richiesta (${prop.deposit_percentage}%): <b>€${caparraReq}</b></p>` : ''}
           ${Number(cauzioneDanni) > 0 ? `<p style="margin: 5px 0 0 0; color: #b91c1c;">Cauzione Danni (blocco su carta all'arrivo): <b>€${cauzioneDanni}</b></p>` : ''}
         </div>
         <br/>
         <p>Saluti,<br/>Lo staff di {{org_name}}</p>
      `;
    }

    // Parsing tag template anche per il Resend
     htmlContent = htmlContent
        .replace(/{{guest_name}}/g, booking.guest_name)
        .replace(/{{check_in_date}}/g, booking.check_in_date.split('-').reverse().join('/'))
        .replace(/{{check_out_date}}/g, booking.check_out_date.split('-').reverse().join('/'))
        .replace(/{{total_price}}/g, booking.total_price)
        .replace(/{{org_name}}/g, org.name)
        .replace(/{{property_name}}/g, prop?.name || 'la struttura');

    await transporter.sendMail({
       from: `"${org.name}" <${org.smtp_from_email}>`,
       to: booking.guest_email,
       subject: `Aggiornamento Prenotazione: ${prop?.name || org.name}`,
       html: htmlContent
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Resend Email Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
