import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
    console.log("[evo-webhook] POST request received.");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    // MUST use service role key here to bypass RLS since webhook has no user session
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const bodyText = await req.text();
        if (!bodyText) return new Response('Empty body', { status: 200 });

        const payload = JSON.parse(bodyText);
        const event = (payload.event || '').toLowerCase();
        
        console.log(`[evo-webhook] Event: ${event}`);

        const isMessageUpsert = event.includes('messages.upsert');
        if (!isMessageUpsert) {
            return new Response('OK', { status: 200 });
        }

        const data = payload.data;
        if (!data || !data.key) return new Response('OK', { status: 200 });

        const key = data.key;
        const remoteJid: string = key.remoteJid || '';
        
        if (remoteJid === 'status@broadcast' || remoteJid.endsWith('@g.us')) {
            return new Response('OK', { status: 200 });
        }

        const fromMe: boolean = key.fromMe === true;
        // Se mandiamo dal nostro sistema, lo loggiamo in /messages. Quindi se fromMe è true via whatsapp nativo potremmo volerlo loggare.
        // Cmq, Direction
        const direction = fromMe ? 'outbound' : 'inbound';
        
        // Es. "393401234567@s.whatsapp.net"
        const cleanNumber = remoteJid.replace(/[:@].*$/, ''); 

        let content = '[Messaggio Non Supportato]';
        const msgType: string = data.messageType || '';
        const msg = data.message || {};

        if (msgType === 'conversation' || msg.conversation) {
            content = msg.conversation;
        } else if (msgType === 'extendedTextMessage' || msg.extendedTextMessage) {
            content = msg.extendedTextMessage?.text || '';
        } else if (msg.imageMessage) {
            content = '[Immagine] ' + (msg.imageMessage.caption || '');
        }

        // FIND THE BOOKING MATCHING THIS PHONE NUMBER
        // We look for any booking where guest_phone contains the cleanNumber (or vice versa).
        // Best approach: look for the last 9 digits.
        const lastDigits = cleanNumber.substring(cleanNumber.length - 8);

        const { data: booking, error: bkError } = await supabase
            .from('bookings')
            .select('id, organization_id')
            .like('guest_phone', `%${lastDigits}%`)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (bkError || !booking) {
            console.log(`[evo-webhook] Number ${cleanNumber} non associato a nessuna prenotazione attiva.`);
            return new Response('OK', { status: 200 });
        }

        console.log(`[evo-webhook] Messaggio inbound associato alla prenotazione ${booking.id}`);

        await supabase.from('booking_messages').insert({
            booking_id: booking.id,
            organization_id: booking.organization_id,
            direction: direction,
            channel: 'whatsapp',
            content: content
        });

        return new Response('OK', { status: 200 });

    } catch (e: any) {
        console.error(`[evo-webhook] Error: ${e.message}`);
        return new Response('OK', { status: 200 });
    }
}
