import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

export async function confirmBookingFromDeposit(bookingId: string, origin?: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, organizations(*), properties(name, notification_emails)')
    .eq('id', bookingId)
    .single();

  if (!booking) return { confirmed: false, emailSent: false };
  if (booking.status === 'confirmed') return { confirmed: true, emailSent: false };

  await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', booking.id);

  let emailSent = false;
  const org = booking.organizations;
  if (org?.smtp_host && org?.smtp_user && org?.smtp_pass && org?.smtp_from_email && booking.guest_email) {
    try {
      const transporter = nodemailer.createTransport({
        host: org.smtp_host,
        port: org.smtp_port || 465,
        secure: org.smtp_port === 465,
        auth: { user: org.smtp_user, pass: org.smtp_pass },
      });

      const base = origin || process.env.NEXT_PUBLIC_SITE_URL || "";
      const portalLink = `${base}/guest/${booking.id}`;
      const htmlContent = (org as any).booking_email_template
        ? (org as any).booking_email_template
            .replace(/{{guest_name}}/g, booking.guest_name || '')
            .replace(/{{check_in_date}}/g, booking.check_in_date?.split('-').reverse().join('/') || '')
            .replace(/{{check_out_date}}/g, booking.check_out_date?.split('-').reverse().join('/') || '')
            .replace(/{{total_price}}/g, String(booking.total_price || 0))
            .replace(/{{org_name}}/g, org.name)
            .replace(/{{property_name}}/g, booking.properties?.name || '')
            .replace(/{{portal_link}}/g, portalLink)
        : `<h1>Prenotazione Confermata!</h1><p>Ciao ${booking.guest_name},<br/>La tua prenotazione presso <b>${booking.properties?.name}</b> dal <b>${booking.check_in_date?.split('-').reverse().join('/')}</b> al <b>${booking.check_out_date?.split('-').reverse().join('/')}</b> è stata confermata.<br/><br/>Saluti,<br/>Lo staff di ${org.name}</p>`;

      await transporter.sendMail({
        from: `"${org.name}" <${org.smtp_from_email}>`,
        to: booking.guest_email,
        cc: booking.properties?.notification_emails?.length ? booking.properties.notification_emails : undefined,
        subject: `Prenotazione Confermata - ${org.name}`,
        html: htmlContent,
      });
      emailSent = true;
    } catch (mailErr) {
      console.error("Email confirmation error:", mailErr);
    }
  }

  return { confirmed: true, emailSent };
}
