import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const authHeader = req.headers.get("Authorization");
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader || "" } }
  });

  try {
    const { status, checkin_staff_id, checkout_staff_id, cleaning_staff_id, requires_linens, staff_notes, deposit_amount, deposit_date, deposit_paid, payment_method, security_deposit_amount, check_in_date, check_out_date } = await req.json();

    // Verify session
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

    // Fetch booking
    const { data: booking, error: bkError } = await supabase
      .from('bookings')
      .select('*, properties(name, deposit_percentage, default_checkin_staff_id, default_cleaning_staff_id, notification_emails, deposit_method), organizations(*)')
      .eq('id', id)
      .single();

    if (bkError || !booking) return NextResponse.json({ error: "Prenotazione non trovata" }, { status: 404 });

    const org = booking.organizations;
    const oldStatus = booking.status;

    // Build update payload
    let payload: any = {};
    if (status) payload.status = status;
    if (checkin_staff_id !== undefined) payload.checkin_staff_id = checkin_staff_id;
    if (checkout_staff_id !== undefined) payload.checkout_staff_id = checkout_staff_id;
    if (cleaning_staff_id !== undefined) payload.cleaning_staff_id = cleaning_staff_id;
    if (requires_linens !== undefined) payload.requires_linens = requires_linens;
    if (staff_notes !== undefined) payload.staff_notes = staff_notes;
    if (deposit_amount !== undefined) payload.deposit_amount = deposit_amount;
    if (deposit_date !== undefined) payload.deposit_date = deposit_date;
    if (deposit_paid !== undefined) payload.deposit_paid = deposit_paid;
    if (payment_method !== undefined) payload.payment_method = payment_method;
    if (security_deposit_amount !== undefined) payload.security_deposit_amount = security_deposit_amount;
    if (check_in_date !== undefined) payload.check_in_date = check_in_date;
    if (check_out_date !== undefined) payload.check_out_date = check_out_date;

    const { error: upError } = await supabase
      .from('bookings')
      .update(payload)
      .eq('id', id);

    if (upError) throw upError;

    // EMAIL DISPATCH (Solo se cambia lo stato a confirmed o cancelled)
    if (status && status !== oldStatus && (status === 'confirmed' || status === 'cancelled')) {
       // Send mail logic
       const template = status === 'confirmed' ? org.template_booking_confirmed : org.template_booking_cancelled;
       
       if (template && (org.smtp_host || org.smtp_config?.host)) {
          console.log("[SMTP] Dispatching email to:", booking.guest_email);
          const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "";
          const portalLink = `${origin}/guest/${booking.id}`;
          let html = template
             .replace(/{{guest_name}}/g, booking.guest_name)
             .replace(/{{check_in_date}}/g, booking.check_in_date.split('-').reverse().join('/'))
             .replace(/{{check_out_date}}/g, booking.check_out_date.split('-').reverse().join('/'))
             .replace(/{{total_price}}/g, booking.total_price)
             .replace(/{{org_name}}/g, org.name || "Agency")
             .replace(/{{property_name}}/g, booking.properties?.name || "")
             .replace(/{{portal_link}}/g, portalLink);

          const host = org.smtp_host || org.smtp_config?.host;
          const port = org.smtp_port || org.smtp_config?.port || 465;
          const secure = Number(port) === 465;

           try {
              // Cerca di usare le vecchie colonne o il config jsonb
              const transporter = nodemailer.createTransport({
                  host: host,
                  port: Number(port),
                  secure: secure,
                  auth: { 
                      user: org.smtp_user || org.smtp_config?.user, 
                      pass: org.smtp_pass || org.smtp_config?.pass 
                  },
                  tls: { rejectUnauthorized: false }
              });

             await transporter.sendMail({
                 from: `"${org.name}" <${org.smtp_from_email || org.smtp_user || org.smtp_config?.fromEmail}>`,
                 to: booking.guest_email,
                 cc: booking.properties?.notification_emails?.length ? booking.properties.notification_emails : undefined,
                 subject: status === 'confirmed' ? `Conferma Prenotazione: ${booking.properties?.name}` : `Annullamento Prenotazione`,
                 html: html
             });

             console.log("[SMTP] Invio riuscito.");
             
             // Registra in booking_messages
             await supabase.from('booking_messages').insert({
                 booking_id: booking.id,
                 organization_id: org.id,
                 direction: 'outbound',
                 channel: 'system',
                 content: `[SISTEMA: EMAIL INVIATA PER CAMBIO STATO A ${status.toUpperCase()}]`
             });

          } catch (mailError) {
             console.error("[SMTP] Fallimento invio:", mailError);
          }
       } else {
           console.log("[SMTP] NESSUNA CONFIGURAZIONE O TEMPLATE. Messaggio saltato per status:", status);
       }
    }
    // SE LA PRENOTAZIONE VIENE ANNULLATA, SBLOCCA IL CALENDARIO
    if (status === 'cancelled' && oldStatus !== 'cancelled') {
       console.log("[AUTOMATION] Booking cancelled, freeing calendar dates...");
       const checkIn = new Date(booking.check_in_date);
       const checkOut = new Date(booking.check_out_date);
       const datesToRemove = [];
       let currentDate = checkIn;
       while (currentDate < checkOut) {
         datesToRemove.push(currentDate.toISOString().split('T')[0]);
         currentDate = new Date(currentDate.getTime() + 86400000);
       }
       if (datesToRemove.length > 0) {
         const { error: delErr } = await supabase
           .from('calendar_overrides')
           .delete()
           .eq('property_id', booking.property_id)
           .in('date', datesToRemove);
         if (delErr) console.error("Error freeing calendar dates:", delErr);
       }
    }

    // AUTOMAZIONE INCASSI SU STAFF TASK E CASH LEDGER
    if (status === 'confirmed' && oldStatus !== 'confirmed') {
       console.log("[AUTOMATION] Generazione task e ledger per operatore check-in...");

       // Notifica check-in (1 giorno prima)
       const checkInDate = new Date(booking.check_in_date);
       const checkInLinkDate = new Date(checkInDate);
       checkInLinkDate.setDate(checkInLinkDate.getDate() - 1);
       try {
          await supabase.from('tasks').insert({
             organization_id: org.id, property_id: booking.property_id,
             staff_member_id: null, task_date: checkInLinkDate.toISOString().split('T')[0],
             task_type: 'send_checkin_link',
             notes: `Inviare link check-in al cliente ${booking.guest_name} per ${booking.properties?.name} (check-in: ${booking.check_in_date})`
          });
       } catch(e) { console.error("Error creating checkin link task", e); }

       // Notifica cauzione (se metodo Stripe)
       const { data: prop } = await supabase.from('properties').select('deposit_method').eq('id', booking.property_id).single();
       if (prop?.deposit_method === 'stripe') {
          try {
             await supabase.from('tasks').insert({
                organization_id: org.id, property_id: booking.property_id,
                staff_member_id: null, task_date: booking.check_in_date,
                task_type: 'send_deposit_link',
                notes: `Inviare link pagamento cauzione Stripe al cliente ${booking.guest_name}`
             });
          } catch(e) { console.error("Error creating deposit link task", e); }
       }

       // Notifica check-out
       try {
          await supabase.from('tasks').insert({
             organization_id: org.id, property_id: booking.property_id,
             staff_member_id: null, task_date: booking.check_out_date,
             task_type: 'send_checkout_link',
             notes: `Inviare link check-out al cliente ${booking.guest_name} per ${booking.properties?.name}`
          });
       } catch(e) { console.error("Error creating checkout link task", e); }

       const balance = Number(booking.total_price) - (Number(booking.deposit_amount) || 0);
       const depositReq = Number(booking.security_deposit_amount) || 0;
       const payMethod = payment_method || booking.payment_method || 'Contante all\'arrivo';
       
       let noteDesc = "";
       if (balance <= 0) {
          noteDesc = `Saldo interamente pagato prima dell'arrivo. `;
       } else {
          noteDesc = `Da Incassare: €${balance} per Saldo Soggiorno (Metodo: ${payMethod}). `;
          if (payMethod.toLowerCase().includes('bonifico')) {
             noteDesc += `[!] Il cliente ha indicato bonifico istantaneo: richiedere la contabile e avvisare l'amministratore per la verifica! `;
          }
       }
       if (depositReq > 0) {
          noteDesc += `[!] Da ritirare Cauzione di €${depositReq}.`;
       }

       // 1. Task Generico ("Incarico al checkin") - visibile al personale nel modulo HR
       try {
          await supabase.from('tasks').insert({
             organization_id: org.id,
             property_id: booking.property_id,
             staff_member_id: booking.checkin_staff_id || null,
             task_date: booking.check_in_date,
             task_type: 'checkin',
             notes: noteDesc
          });
       } catch(e) { console.error("Error creating checkin task", e); }

       // 2. Generazione incassi programmati per le voci separate se non esistono già
       try {
           const { count } = await supabase.from('booking_payments').select('*', { count: 'exact', head: true }).eq('booking_id', booking.id);
           if (count === 0) {
               const payments = [];
               if (Number(booking.down_payment) > 0) payments.push({
                 booking_id: booking.id, amount: Number(booking.down_payment), status: 'scheduled',
                 payment_method: 'Bonifico', reason: 'Caparra',
                 notes: `Caparra (${booking.properties?.deposit_percentage || 0}%) — da versare anticipatamente`
               });
                if (Number(booking.security_deposit) > 0 && booking.properties?.deposit_method !== 'stripe') payments.push({
                  booking_id: booking.id, amount: Number(booking.security_deposit), status: 'scheduled',
                  payment_method: 'Contante', reason: 'Cauzione Danni', date: booking.check_in_date,
                  staff_member_id: booking.properties?.default_checkin_staff_id || null,
                  notes: "Cauzione danni — cash all'arrivo"
                });
                if (Number(booking.city_tax) > 0) payments.push({
                  booking_id: booking.id, amount: Number(booking.city_tax), status: 'scheduled',
                  payment_method: 'Contante', reason: 'Tassa Soggiorno', date: booking.check_in_date,
                  staff_member_id: booking.properties?.default_checkin_staff_id || null,
                  notes: "Tassa di soggiorno — cash all'arrivo"
                });
                if (Number(booking.cleaning_fee) > 0) payments.push({
                  booking_id: booking.id, amount: Number(booking.cleaning_fee), status: 'scheduled',
                  payment_method: 'Contante', reason: 'Pulizie', date: booking.check_in_date,
                  staff_member_id: booking.properties?.default_cleaning_staff_id || null,
                  notes: "Spese pulizie"
                });
               if (payments.length > 0) {
                   await supabase.from('booking_payments').insert(payments);
               }
           }
       } catch (e) {
           console.error("Error creating scheduled payments on confirm", e);
        }
     }

     // Ricrea task notifica se le date cambiano
     const datesChanged = (check_in_date && check_in_date !== booking.check_in_date) || (check_out_date && check_out_date !== booking.check_out_date);
     if (datesChanged) {
        const effectiveIn = check_in_date || booking.check_in_date;
        const effectiveOut = check_out_date || booking.check_out_date;
        // Elimina vecchi task notifica
        await supabase.from('tasks').delete().eq('property_id', booking.property_id).in('task_type', ['send_checkin_link', 'send_deposit_link', 'send_checkout_link']).gte('task_date', booking.check_in_date);
        // Crea nuovi task
        const linkDate = new Date(effectiveIn);
        linkDate.setDate(linkDate.getDate() - 1);
        try {
           await supabase.from('tasks').insert({
              organization_id: org.id, property_id: booking.property_id,
              staff_member_id: null, task_date: linkDate.toISOString().split('T')[0],
              task_type: 'send_checkin_link',
              notes: `Inviare link check-in al cliente ${booking.guest_name} per ${booking.properties?.name} (check-in: ${effectiveIn})`
           });
        } catch(e) { console.error("Error creating checkin link task", e); }
        try {
           await supabase.from('tasks').insert({
              organization_id: org.id, property_id: booking.property_id,
              staff_member_id: null, task_date: effectiveOut,
              task_type: 'send_checkout_link',
              notes: `Inviare link check-out al cliente ${booking.guest_name} per ${booking.properties?.name}`
           });
        } catch(e) { console.error("Error creating checkout link task", e); }
     }

     return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Booking Update Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
