import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    
    // Recupero info della Property
    const { data: prop } = await supabase.from('properties')
      .select('name, default_checkin_staff_id, default_checkout_staff_id, default_cleaning_staff_id, security_deposit, deposit_percentage, cleaning_fee, pet_fee, city_tax_per_night, city_tax_max_nights, city_tax_child_age, extra_services')
      .eq('id', payload.property_id)
      .single();

    // Calcoli finanziari server-side (validazione lato server)
    const nights = payload.nights || 1;
    const adults = payload.adults_count || 1;
    const children = payload.children_count || 0;
    const petsCount = payload.pets_count || 0;

    const basePrice = payload.base_price || 0;
    const cleaningFee = prop?.cleaning_fee ?? 0;
    const petFee = petsCount * (prop?.pet_fee ?? 0);
    const maxN = (prop as any)?.city_tax_max_nights ?? 10;
    const taxableNights = Math.min(nights, maxN);
    // city_tax è separata (cash in loco) — NON nel totalPrice del soggiorno
    const cityTax = payload.city_tax !== undefined 
      ? payload.city_tax 
      : (prop?.city_tax_per_night ?? 2) * taxableNights * adults;
    const extraTotal = (payload.extra_services || []).reduce((acc: number, e: any) => acc + Number(e.total || 0), 0);
    // totalPrice = soggiorno base (senza city tax)
    const totalPrice = payload.total_price || (basePrice + cleaningFee + petFee + extraTotal);
    const depositPct = prop?.deposit_percentage ?? 0;
    const downPayment = depositPct > 0 ? Math.round(totalPrice * depositPct / 100 * 100) / 100 : 0;
    const securityDeposit = prop?.security_deposit ?? 0;

    // Calcolo costi agenzia (services_cost e staff_cost)
    const propServices = prop?.extra_services || [];
    const servicesCost = (payload.extra_services || []).reduce((acc: number, e: any) => {
        const matched = propServices.find((ps: any) => ps.name === e.name);
        const costForOne = matched ? Number(matched.cost_price || 0) : 0;
        const qty = Number(e.qty || 1);
        return acc + (costForOne * qty);
    }, 0);

    const staffIds = [prop?.default_checkin_staff_id, prop?.default_checkout_staff_id, prop?.default_cleaning_staff_id].filter(Boolean);
    let staffCost = 0;
    if (staffIds.length > 0) {
       const { data: stf } = await supabase.from('staff_members').select('id, cost_per_service').in('id', staffIds);
       if (stf) {
           staffCost = stf.reduce((acc, s) => acc + Number(s.cost_per_service || 0), 0);
       }
    }

    // Calcolo commissioni portale (usa canale "Sito Web" default se presente)
    let channelId = payload.channel_id || null;
    let commissionAmount = 0;
    let taxAmount = 0;
    if (!channelId) {
      const { data: siteChannel } = await supabase
        .from('booking_channels')
        .select('id, commission_pct, tax_pct')
        .eq('organization_id', payload.organization_id)
        .eq('name', 'Sito Web')
        .maybeSingle();
      if (siteChannel) {
        channelId = siteChannel.id;
        commissionAmount = Math.round(totalPrice * Number(siteChannel.commission_pct || 0) / 100 * 100) / 100;
        taxAmount = Math.round(totalPrice * Number(siteChannel.tax_pct || 0) / 100 * 100) / 100;
      }
    }

    // Inserimento booking
    const { data: booking, error: errBooking } = await supabase
      .from('bookings')
      .insert({
        organization_id: payload.organization_id,
        property_id: payload.property_id,
        contact_id: payload.contact_id || null,
        guest_name: payload.guest_name,
        guest_email: payload.guest_email,
        guest_phone: payload.guest_phone,
        check_in_date: payload.check_in_date,
        check_out_date: payload.check_out_date,
        nights: nights,
        guests_count: adults + children,
        adults_count: adults,
        children_count: children,
        pets_count: petsCount,
        base_price: basePrice,
        cleaning_fee: cleaningFee,
        pet_fee: petFee,
        city_tax: cityTax,
        security_deposit: securityDeposit,
        down_payment: downPayment,
        total_price: totalPrice,
        payment_method: payload.payment_method || "Contante",
        status: payload.status || 'pending',
        notes: payload.notes,
        extra_services: payload.extra_services || [],
        channel_id: channelId,
        commission_amount: commissionAmount,
        tax_amount: taxAmount,
        checkin_staff_id: prop?.default_checkin_staff_id || null,
        checkout_staff_id: prop?.default_checkout_staff_id || null,
        cleaning_staff_id: prop?.default_cleaning_staff_id || null,
        services_cost: servicesCost,
        staff_cost: staffCost
      })
      .select()
      .single();
      
    if (errBooking) {
      console.error("Booking Error:", errBooking);
      return NextResponse.json({ error: 'Errore DB: ' + errBooking.message }, { status: 500 });
    }

    // Auto-generate pagamenti pianificati
    if (booking && (booking as any).id) {
      const bId = (booking as any).id;
      const contactId = payload.contact_id || null;
      const checkInDate = payload.check_in_date;

      const scheduledPayments = [];
      
      // Caparra: da versare anticipatamente (Bonifico), due_date non è check-in
      if (downPayment > 0) {
        scheduledPayments.push({
          booking_id: bId, amount: downPayment, status: 'scheduled',
          payment_method: 'Bonifico',
          reason: 'Caparra',
          notes: `Caparra (${depositPct}%) — da versare anticipatamente`
        });
      }

      // Saldo: 2 giorni prima del check-in, Bonifico
      const saldo = totalPrice - downPayment;
      if (saldo > 0) {
        const dueDate = new Date(checkInDate);
        dueDate.setDate(dueDate.getDate() - 2);
        scheduledPayments.push({
          booking_id: bId, amount: saldo, status: 'scheduled',
          payment_method: 'Bonifico',
          reason: 'Saldo',
          date: dueDate.toISOString().split('T')[0],
          notes: `Saldo soggiorno — da versare entro il ${dueDate.toISOString().split('T')[0].split('-').reverse().join('/')}`
        });
      }

      // Cauzione: cash all'arrivo → due_date = check_in
      if (securityDeposit > 0) {
        scheduledPayments.push({
          booking_id: bId, amount: securityDeposit, status: 'scheduled',
          payment_method: 'Contante',
          reason: 'Cauzione Danni',
          date: checkInDate,
          staff_member_id: prop?.default_checkin_staff_id || null,
          notes: "Cauzione danni — cash all'arrivo, restituita al check-out"
        });
      }

      // Tassa di soggiorno: cash all'arrivo → due_date = check_in
      if (cityTax > 0) {
        scheduledPayments.push({
          booking_id: bId, amount: cityTax, status: 'scheduled',
          payment_method: 'Contante',
          reason: 'Tassa Soggiorno',
          date: checkInDate,
          staff_member_id: prop?.default_checkin_staff_id || null,
          notes: `Tassa di soggiorno (${adults} adulti × ${taxableNights} notti) — cash all'arrivo`
        });
      }

      if (scheduledPayments.length > 0) {
        const cashTxs = scheduledPayments.map(p => ({
            organization_id: payload.organization_id || null,
            property_id: payload.property_id || null,
            booking_id: p.booking_id,
            staff_member_id: p.staff_member_id || null,
            amount: p.amount,
            transaction_type: p.reason === 'Caparra' ? 'deposit_collection' : p.reason === 'Saldo' ? 'stay_balance' : 'stay_balance',
            status: p.status,
            payment_method: p.payment_method,
            reason: p.reason,
            notes: p.notes,
            created_at: p.date ? new Date(p.date).toISOString() : new Date().toISOString()
        }));
        await supabase.from('cash_transactions').insert(cashTxs);
      }
    }

    // Email al cliente
    const { data: org } = await supabase
      .from('organizations')
      .select('name, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from_email, booking_email_template')
      .eq('id', payload.organization_id)
      .single();

    if (org && org.smtp_host && org.smtp_user && org.smtp_pass && org.smtp_from_email) {
       try {
         const transporter = nodemailer.createTransport({
           host: org.smtp_host, port: org.smtp_port || 465,
           secure: org.smtp_port === 465,
           auth: { user: org.smtp_user, pass: org.smtp_pass }
         });

         let htmlContent = org.booking_email_template;
         if (!htmlContent) {
           const extraHtml = (payload.extra_services || []).length > 0
             ? `<h3>Servizi Extra:</h3><ul>${payload.extra_services.map((ex: any) => `<li><b>${ex.name}</b> x${ex.qty}: €${ex.total}</li>`).join('')}</ul>`
             : '';
           htmlContent = `
             <h1>Prenotazione Ricevuta!</h1>
             <p>Ciao {{guest_name}},</p>
             <p>La tua richiesta per <b>${prop?.name}</b> dal <b>{{check_in_date}}</b> al <b>{{check_out_date}}</b> è stata ricevuta.</p>
             ${extraHtml}
             <div style="background:#f9fafb;padding:15px;border-radius:8px;margin-top:20px;">
               <p>Totale Soggiorno: <b>€${totalPrice}</b></p>
               ${cityTax > 0 ? `<p style="color:#b45309;">Tassa di soggiorno (${adults} adulti × ${taxableNights} notti): <b>€${cityTax}</b> — contanti in loco</p>` : ''}
               ${downPayment > 0 ? `<p style="color:#b45309;">Caparra (${prop?.deposit_percentage}%): <b>€${downPayment}</b> — da versare anticipatamente</p>` : ''}
               ${securityDeposit > 0 ? `<p style="color:#b91c1c;">Cauzione danni: <b>€${securityDeposit}</b> — contanti all'arrivo</p>` : ''}
             </div>
             <br/><p>Saluti,<br/>Lo staff di {{org_name}}</p>
           `;
         }
         htmlContent = htmlContent
           .replace(/{{guest_name}}/g, payload.guest_name || '')
           .replace(/{{check_in_date}}/g, payload.check_in_date?.split('-').reverse().join('/') || '')
           .replace(/{{check_out_date}}/g, payload.check_out_date?.split('-').reverse().join('/') || '')
           .replace(/{{total_price}}/g, String(totalPrice))
           .replace(/{{org_name}}/g, org.name);

         await transporter.sendMail({
           from: `"${org.name}" <${org.smtp_from_email}>`,
           to: payload.guest_email,
           subject: `Conferma Prenotazione - ${org.name}`,
           html: htmlContent
         });
       } catch (mailError) {
         console.error("Errore Invio Email:", mailError);
       }
    } else {
      console.log(`\n[SIMULATORE SMTP] → ${payload.guest_email} | Totale: €${totalPrice} | City Tax: €${cityTax} | Caparra: €${downPayment}`);
    }

    return NextResponse.json({ success: true, booking });
    
  } catch (error: any) {
    console.error("API Checkout Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
