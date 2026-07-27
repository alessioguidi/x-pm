import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const authHeader = req.headers.get("Authorization");

  if (!authHeader) return NextResponse.json({ error: "Token mancante" }, { status: 401 });

  const isSelfChain = authHeader.replace("Bearer ", "") === supabaseServiceKey;

  let supabase;
  if (isSelfChain) {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${supabaseServiceKey}` } }
    });
  } else {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user && !isSelfChain) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

    const { campaign_id, recipient_ids } = await req.json();
    if (!campaign_id) return NextResponse.json({ error: "campaign_id richiesto" }, { status: 400 });

    const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", campaign_id).single();
    if (!campaign) return NextResponse.json({ error: "Campagna non trovata" }, { status: 404 });

    if (campaign.channel !== "whatsapp") return NextResponse.json({ error: "Campagna non di tipo WhatsApp" }, { status: 400 });

    const evoApiUrl = (process.env.EVOLUTION_API_URL || "").replace(/\/$/, "");
    const evoApiKey = process.env.EVOLUTION_API_KEY || "";

    if (!evoApiUrl) {
      return NextResponse.json({ error: "Evolution API non configurata" }, { status: 500 });
    }

    const evoInstanceName = `org-${(campaign.organization_id || "").replace(/-/g, "").substring(0, 20)}`;

    const evoHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      accept: "application/json",
    };
    if (evoApiKey) evoHeaders["apikey"] = evoApiKey;

    // Pre-flight: check instance connection state
    try {
      const stateRes = await fetch(`${evoApiUrl}/instance/connectionState/${evoInstanceName}`, {
        method: "GET",
        headers: evoHeaders,
        signal: AbortSignal.timeout(8000),
      });
      if (stateRes.ok) {
        const stateData = await stateRes.json();
        const connState = (
          stateData?.instance?.state ||
          stateData?.state ||
          stateData?.connectionStatus ||
          ""
        ).toLowerCase();
        if (connState && connState !== "open") {
          return NextResponse.json({
            error: `Istanza WhatsApp "${evoInstanceName}" non connessa (stato: ${connState}). Riconnetti il QR code.`,
          }, { status: 503 });
        }
      }
    } catch {
      // non bloccante
    }

    // Get phone prefix from connected instance
    let countryPrefix = "";
    let ownerPhone = "";
    try {
      const fetchRes = await fetch(
        `${evoApiUrl}/instance/fetchInstances?instanceName=${encodeURIComponent(evoInstanceName)}`,
        { method: "GET", headers: evoHeaders, signal: AbortSignal.timeout(6000) }
      );
      if (fetchRes.ok) {
        const fetchData = await fetchRes.json();
        const instances = Array.isArray(fetchData) ? fetchData : (fetchData?.data || [fetchData]);
        const inst = instances.find((i: any) =>
          (i.instance?.instanceName || i.instanceName) === evoInstanceName
        ) || instances[0];
        const ownerJid = (
          inst?.instance?.ownerJid ||
          inst?.ownerJid ||
          inst?.instance?.owner ||
          inst?.owner || ""
        ).replace(/@.*$/, "").replace(/\D/g, "");
        if (ownerJid && ownerJid.length >= 10) {
          for (const ccLen of [1, 2, 3]) {
            const localPart = ownerJid.substring(ccLen);
            if (localPart.length >= 9 && localPart.length <= 10) {
              countryPrefix = ownerJid.substring(0, ccLen);
              ownerPhone = ownerJid;
              break;
            }
          }
        }
      }
    } catch {
      // non bloccante
    }

    // Get pending recipients (batch of 5)
    let recipientQuery = supabase
      .from("campaign_recipients")
      .select("*")
      .eq("campaign_id", campaign_id)
      .eq("status", "pending");

    if (recipient_ids && Array.isArray(recipient_ids) && recipient_ids.length > 0) {
      recipientQuery = recipientQuery.in("id", recipient_ids);
    }

    const { data: recipients } = await recipientQuery.limit(recipient_ids?.length || 5);

    if (!recipients?.length) {
      // mark campaign as sent
      await supabase.from("campaigns").update({ is_active: false }).eq("id", campaign_id);
      return NextResponse.json({ message: "Campagna completata" });
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;

      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get("origin") || "";

      const rewriteTextLinks = (text: string, rid: string) => {
        if (!text) return "";
        const trackClickBase = `${baseUrl}/api/track-click?rid=${rid}`;
        const urlRegex = /(https?:\/\/[^\s<"']+)/gi;
        return text.replace(urlRegex, (matchUrl) => {
          if (matchUrl.includes("/track-click")) return matchUrl;
          return `${trackClickBase}&u=${encodeURIComponent(matchUrl)}`;
        });
      };

      for (const recipient of recipients) {
        try {
          if (recipient.status !== "pending") continue;

          let phone = recipient.phone.replace(/[\+\s\-\(\)]/g, "");
          if (phone.startsWith("00")) phone = phone.substring(2);

          if (countryPrefix && ownerPhone) {
            const intlLen = ownerPhone.length;
            const localLen = intlLen - countryPrefix.length;
            if (phone.length === localLen) {
              phone = countryPrefix + phone;
            }
          }

          const messageText = rewriteTextLinks(
            (campaign.text_content || "")
              .replace(/{{NOME}}|\[NOME\]/gi, recipient.name),
            recipient.id
          );

        const mediaUrls: string[] = campaign.media_urls || [];
        const typingDelay = 1000 + Math.floor(Math.random() * 1500);

        const sendViaEvolution = async (body: any, endpoint: string) => {
          const res = await fetch(`${evoApiUrl}${endpoint}/${evoInstanceName}`, {
            method: "POST",
            headers: evoHeaders,
            signal: AbortSignal.timeout(20000),
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            const errText = await res.text();
            let isNoWhatsApp = false;
            try {
              const errJson = JSON.parse(errText);
              const msgs = errJson?.response?.message;
              if (Array.isArray(msgs) && msgs.some((m: any) => m.exists === false)) {
                isNoWhatsApp = true;
              }
            } catch { /* ignore */ }
            if (isNoWhatsApp) {
              await supabase.from("campaign_recipients").update({
                status: "skipped",
                error_message: "Numero non registrato su WhatsApp",
              }).eq("id", recipient.id);
              skipped++;
              await supabase.from("campaigns").update({
                stats_failed: skipped,
              }).eq("id", campaign_id);
              return { ok: false, skipped: true };
            }
            throw new Error(`Evolution API error: ${res.status} - ${errText}`);
          }
          return { ok: true };
        };

        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

        let sendOk = false;

        if (mediaUrls.length > 0) {
          // First media with text as caption (or empty caption if no text)
          const firstMedia = mediaUrls[0];
          const ext = firstMedia.split("?").shift()?.split(".").pop()?.toLowerCase() || "";
          const mediatype = ["mp4", "webm", "ogg"].includes(ext) ? "video" : "image";
          const result = await sendViaEvolution({
            number: phone,
            mediatype,
            media: firstMedia,
            caption: messageText || " ",
            delay: typingDelay,
          }, "/message/sendMedia");
          if (result.ok) sendOk = true;
          if (result.skipped) continue;

          // Remaining media with real delays between them
          for (let i = 1; i < mediaUrls.length; i++) {
            const ext2 = mediaUrls[i].split("?").shift()?.split(".").pop()?.toLowerCase() || "";
            const mt2 = ["mp4", "webm", "ogg"].includes(ext2) ? "video" : "image";
            const mediaDelay = 2000 + Math.floor(Math.random() * 3000);
            await sleep(mediaDelay);
            const r2 = await sendViaEvolution({
              number: phone,
              mediatype: mt2,
              media: mediaUrls[i],
              caption: " ",
              delay: 1000 + Math.floor(Math.random() * 1000),
            }, "/message/sendMedia");
            if (r2.skipped) break;
          }
        } else {
          // Text-only message
          const result = await sendViaEvolution({
            number: phone,
            text: messageText,
            delay: typingDelay,
          }, "/message/sendText");
          if (result.ok) sendOk = true;
          if (result.skipped) continue;
        }

        if (sendOk) {
          await supabase.from("campaign_recipients").update({
            status: "sent",
            sent_at: new Date().toISOString(),
          }).eq("id", recipient.id);
          sent++;
          await supabase.from("campaigns").update({
            stats_sent: sent,
          }).eq("id", campaign_id);
        }

        // Rate-limiting delay
        const jitter = Math.floor(Math.random() * 4000);
        await new Promise(resolve => setTimeout(resolve, 5000 + jitter));
      } catch (e: any) {
        await supabase.from("campaign_recipients").update({
          status: "failed",
          error_message: e.message || "Errore sconosciuto",
        }).eq("id", recipient.id);
        failed++;
        await supabase.from("campaigns").update({
          stats_failed: failed,
        }).eq("id", campaign_id);
      }
    }

    // Self-chain next batch (only if recipient_ids not explicitly specified)
    let stillPending = 0;
    if (recipient_ids && Array.isArray(recipient_ids) && recipient_ids.length > 0) {
      // Don't self-chain when user explicitly selected recipients
      const { count } = await supabase
        .from("campaign_recipients")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaign_id)
        .eq("status", "pending");
      stillPending = count || 0;
      if (!stillPending) {
        await supabase.from("campaigns").update({ is_active: false }).eq("id", campaign_id);
      }
    } else {
      const { count } = await supabase
        .from("campaign_recipients")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaign_id)
        .eq("status", "pending");
      stillPending = count || 0;

      if (stillPending > 0) {
        const interBatchPause = 20000 + Math.floor(Math.random() * 20000);
        await new Promise(resolve => setTimeout(resolve, interBatchPause));

        const selfChainUrl = process.env.NEXT_PUBLIC_SITE_URL
          ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/marketing/send-whatsapp`
          : `${new URL(req.url).origin}/api/marketing/send-whatsapp`;

        fetch(selfChainUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ campaign_id }),
        }).catch(e => console.error("[send-whatsapp] Self-chain error:", e));
      } else {
        await supabase.from("campaigns").update({ is_active: false }).eq("id", campaign_id);
      }
    }

    return NextResponse.json({
      message: stillPending > 0
        ? `Batch completato (${stillPending} ancora in coda)`
        : "Campagna completata",
      sent, failed, skipped, still_pending: stillPending,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
