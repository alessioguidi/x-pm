import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const authHeader = req.headers.get("Authorization");
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader || "" } }
  });

  try {
    // 1. Get payment details from cash_transactions
    const { data: payment, error: pErr } = await supabase
      .from('cash_transactions')
      .select('*, bookings(*, properties(name), organizations(*))')
      .eq('id', id)
      .single();

    if (pErr || !payment) return NextResponse.json({ error: "Pagamento non trovato" }, { status: 404 });

    if (payment.status === 'confirmed') {
       return NextResponse.json({ error: "Pagamento già incassato" }, { status: 400 });
    }

    // 2. Update payment status
    const { data, error: updErr } = await supabase
       .from('cash_transactions')
       .update({ status: 'confirmed', notes: payment.notes?.replace(/^\[STORNATO\]\s*/, '') || '' })
       .eq('id', id)
       .select()
       .single();

    if (updErr) throw updErr;

    // 3. If this is a Caparra payment, update booking to confirmed + send email
    const booking = (payment as any).bookings;
    if (payment.reason === 'Caparra' && booking && booking.status !== 'confirmed') {
      // Update booking status
      await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', booking.id);

      // Send confirmation email
      const org = (booking as any).organizations;
      if (org?.smtp_host && org?.smtp_user && org?.smtp_pass && org?.smtp_from_email) {
        try {
          const transporter = nodemailer.createTransport({
            host: org.smtp_host, port: org.smtp_port || 465,
            secure: org.smtp_port === 465,
            auth: { user: org.smtp_user, pass: org.smtp_pass }
          });

          const htmlContent = (org as any).booking_email_template
            ? (org as any).booking_email_template
                .replace(/{{guest_name}}/g, booking.guest_name || '')
                .replace(/{{check_in_date}}/g, booking.check_in_date?.split('-').reverse().join('/') || '')
                .replace(/{{check_out_date}}/g, booking.check_out_date?.split('-').reverse().join('/') || '')
                .replace(/{{total_price}}/g, String(booking.total_price || 0))
                .replace(/{{org_name}}/g, org.name)
            : `<h1>Prenotazione Confermata!</h1><p>Ciao ${booking.guest_name},<br/>La tua prenotazione presso <b>${booking.properties?.name}</b> dal <b>${booking.check_in_date?.split('-').reverse().join('/')}</b> al <b>${booking.check_out_date?.split('-').reverse().join('/')}</b> è stata confermata.<br/><br/>Saluti,<br/>Lo staff di ${org.name}</p>`;

          await transporter.sendMail({
            from: `"${org.name}" <${org.smtp_from_email}>`,
            to: booking.guest_email,
            subject: `Prenotazione Confermata - ${org.name}`,
            html: htmlContent
          });
        } catch (mailErr) {
          console.error("Email confirmation error:", mailErr);
        }
      }
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("Payment Confirm Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
