import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const authHeader = req.headers.get("Authorization");

  if (!authHeader) return NextResponse.json({ error: "Token mancante" }, { status: 401 });

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } }
  });

  let postId = "";
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

    const { campaign_id } = await req.json();
    if (!campaign_id) return NextResponse.json({ error: "campaign_id richiesto" }, { status: 400 });

    const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", campaign_id).single();
    if (!campaign) return NextResponse.json({ error: "Campagna non trovata" }, { status: 404 });

    const { data: org } = await supabase.from("organizations").select("facebook_page_token, instagram_account_id").eq("id", campaign.organization_id).single();
    if (!org?.facebook_page_token) return NextResponse.json({ error: "Token Facebook non configurato" }, { status: 400 });

    postId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const baseText = campaign.text_content || "";
    let finalText = baseText;

    if (campaign.auto_availability && campaign.property_id) {
      const { data: prop } = await supabase.from("properties").select("*").eq("id", campaign.property_id).maybeSingle();
      const propMinStay = (prop as any)?.min_stay || 1;

      const { data: bookings } = await supabase.from("bookings").select("check_in_date, check_out_date").eq("property_id", campaign.property_id).in("status", ["confirmed", "pending"]);
      const { data: overrides } = await supabase.from("calendar_overrides").select("date, is_blocked, closed_to_arrival, closed_to_departure, min_stay").eq("property_id", campaign.property_id);

      const startDate = new Date(campaign.start_date); startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(campaign.end_date); endDate.setHours(23, 59, 59, 0);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const from = today > startDate ? today : startDate;

      const blocked = new Set<string>();
      const noArrival = new Set<string>();
      const noDeparture = new Set<string>();
      const minStays: Record<string, number> = {};
      (bookings || []).forEach(b => { const s = new Date(b.check_in_date), e = new Date(b.check_out_date); for (let d = new Date(s); d < e; d.setDate(d.getDate() + 1)) blocked.add(d.toISOString().split("T")[0]); });
      (overrides || []).forEach((o: any) => {
        if (o.is_blocked) blocked.add(o.date);
        if (o.closed_to_arrival) noArrival.add(o.date);
        if (o.closed_to_departure) noDeparture.add(o.date);
        if (o.min_stay) minStays[o.date] = o.min_stay;
      });

      // Find available date ranges
      const validRanges: string[] = [];
      let rangeStart: Date | null = null;
      let maxMinStay = 1;
      const iterDate = new Date(from);
      const endMs = endDate.getTime();
      while (iterDate.getTime() <= endMs) {
        const key = iterDate.toISOString().split("T")[0];
        const isBlocked = blocked.has(key);
        const isLast = iterDate.getTime() >= endMs - 86400000; // last midnight before end

        if (!isBlocked && !rangeStart && !noArrival.has(key)) {
          rangeStart = new Date(iterDate);
          maxMinStay = Math.max(maxMinStay, minStays[key] || propMinStay);
        } else if (!isBlocked && rangeStart) {
          maxMinStay = Math.max(maxMinStay, minStays[key] || propMinStay);
        }

        if ((isBlocked || isLast) && rangeStart) {
          const rangeEnd = isBlocked ? new Date(iterDate.getTime() - 86400000) : new Date(iterDate);
          if (!noDeparture.has(rangeEnd.toISOString().split("T")[0]) && rangeEnd >= rangeStart) {
            validRanges.push(`${rangeStart.toISOString().split("T")[0].split("-").reverse().join("/")} → ${rangeEnd.toISOString().split("T")[0].split("-").reverse().join("/")}${maxMinStay > 1 ? ` (min ${maxMinStay} notti)` : ""}`);
          }
          rangeStart = null;
          maxMinStay = 1;
        }
        iterDate.setDate(iterDate.getDate() + 1);
      }

      if (validRanges.length > 0) finalText += `\n\n📅 Date disponibili:\n${validRanges.join("\n")}`;
    }

    const text = finalText;
    const mediaUrls = (campaign.media_urls || []).filter((url: string) => 
        ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'].includes(url.split('.').pop()?.toLowerCase() || '')
    );
    const token = org.facebook_page_token;

    await supabase.from("campaign_posts").insert({
      id: postId, campaign_id: campaign.id,
      text_content: text, media_urls: mediaUrls,
      scheduled_at: new Date().toISOString(), status: "publishing", platform: "both",
    });

    let facebookPostId: string | null = null;
    let errorMessage: string | null = null;
    const publishFB = campaign.platform === "both" || campaign.platform === "facebook";

    if (publishFB && mediaUrls.length > 0) {
      // 1. Ottieni l'ID della Pagina
      const meRes = await fetch(`https://graph.facebook.com/v22.0/me?fields=id&access_token=${token}`);
      const meData = await meRes.json();
      const pageId = meData.id;
      if (!pageId) throw new Error("Impossibile ottenere l'ID della Pagina");

      // 2. Carica ogni foto come bozza (published=false) e raccogli gli ID
      const mediaIds: string[] = [];
      for (const url of mediaUrls) {
        const fbRes = await fetch(`https://graph.facebook.com/v22.0/${pageId}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, access_token: token, published: false }),
        });
        const fbData = await fbRes.json();
        if (fbData.id) {
          mediaIds.push(fbData.id);
        } else {
          errorMessage = `Errore upload foto: ${fbData.error?.message || "errore"}`;
        }
      }

      // 3. Crea il post unico con tutte le foto
      if (mediaIds.length > 0) {
        const feedRes = await fetch(`https://graph.facebook.com/v22.0/${pageId}/feed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            attached_media: mediaIds.map(id => ({ media_fbid: id })),
            access_token: token,
          }),
        });
        const feedData = await feedRes.json();
        if (feedData.id) {
          facebookPostId = feedData.id;
        } else {
          errorMessage = `Errore post: ${feedData.error?.message || JSON.stringify(feedData)}`;
        }
      }
    } else if (publishFB) {
      // No photos: text-only post on Facebook
      const fbRes = await fetch(`https://graph.facebook.com/v22.0/me/feed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, access_token: token }),
      });
      const fbData = await fbRes.json();
      if (fbData.id) facebookPostId = fbData.id;
      else errorMessage = `Feed: ${JSON.stringify(fbData)}`;
    }

    // --- Instagram ---
    if ((campaign.platform === "both" || campaign.platform === "instagram") && org.instagram_account_id && mediaUrls.length > 0) {
      for (const url of mediaUrls) {
        const igRes = await fetch(`https://graph.facebook.com/v22.0/${org.instagram_account_id}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_url: url, caption: text, access_token: token }),
        });
        const igData = await igRes.json();
        if (igData.id) {
          await fetch(`https://graph.facebook.com/v22.0/${org.instagram_account_id}/media_publish`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ creation_id: igData.id, access_token: token }),
          });
        }
      }
    }

    await supabase.from("campaign_posts").update({
      status: facebookPostId ? "published" : "failed",
      published_at: facebookPostId ? new Date().toISOString() : null,
      platform_ids: facebookPostId ? { facebook: facebookPostId } : {},
      error_message: errorMessage,
    }).eq("id", postId);

    return NextResponse.json({ success: !!facebookPostId, facebook_id: facebookPostId, error: errorMessage });
  } catch (err: any) {
    try { await supabase.from("campaign_posts").update({ status: "failed", error_message: err?.message }).eq("id", postId); } catch {}
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
