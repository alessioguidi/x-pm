import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!serviceKey) return NextResponse.json({ error: "Service key non configurata" }, { status: 500 });

  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // Supporto per override forzato: ?force=1 pubblica subito ignorando orario/giorno
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";

    const { data: campaigns } = await admin.from("campaigns").select("*, organizations(facebook_page_token, instagram_account_id)").eq("is_active", true).gte("end_date", today).lte("start_date", today);

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({ message: "Nessuna campagna attiva nel periodo" });
    }

    const published: string[] = [];

    for (const c of campaigns) {
      if (!force) {
        // Verifica se oggi è giorno di pubblicazione
        const dayOfWeek = now.getDay();
        const dayOfMonth = now.getDate();

        if (c.recurrence === "weekly" && c.day_of_week !== null && c.day_of_week !== dayOfWeek) continue;
        if (c.recurrence === "monthly" && c.day_of_month !== null && c.day_of_month !== dayOfMonth) continue;

        // Verifica orario (±30 minuti)
        const [schedH, schedM] = (c.time_of_day || "21:00").split(":").map(Number);
        const schedMinutes = schedH * 60 + schedM;
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        if (Math.abs(nowMinutes - schedMinutes) > 30) continue;
      }

      // Controlla se lo scheduler ha già pubblicato oggi (solo se non è forzato)
      if (!force) {
        const { data: existing } = await admin.from("campaign_posts").select("id").eq("campaign_id", c.id).eq("platform", "scheduler").gte("scheduled_at", `${today}T00:00:00`).lte("scheduled_at", `${today}T23:59:59`);
        if (existing && existing.length > 0) continue;
      }

      // Pubblica!
      const token = (c as any).organizations?.facebook_page_token;
      if (!token) continue;

      const baseText = c.text_content || "";
      let finalText = baseText;

      if (c.auto_availability && c.property_id) {
        const { data: prop } = await admin.from("properties").select("min_stay").eq("id", c.property_id).single();
        const propMinStay = prop?.min_stay || 1;

        const { data: bookings } = await admin.from("bookings").select("check_in_date, check_out_date").eq("property_id", c.property_id).in("status", ["confirmed", "pending"]);
        const { data: overrides } = await admin.from("calendar_overrides").select("date, is_blocked, closed_to_arrival, closed_to_departure, min_stay").eq("property_id", c.property_id);
        const startCampaign = new Date(c.start_date); startCampaign.setHours(0, 0, 0, 0);
        const endCampaign = new Date(c.end_date); endCampaign.setHours(23, 59, 59, 0);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const from = today > startCampaign ? today : startCampaign;
        const blocked = new Set<string>();
        const noArrival = new Set<string>();
        const noDeparture = new Set<string>();
        const minStays: Record<string, number> = {};
        (bookings || []).forEach((b: any) => { const s = new Date(b.check_in_date), e = new Date(b.check_out_date); for (let d = new Date(s); d < e; d.setDate(d.getDate() + 1)) blocked.add(d.toISOString().split("T")[0]); });
        (overrides || []).forEach((o: any) => { if (o.is_blocked) blocked.add(o.date); if (o.closed_to_arrival) noArrival.add(o.date); if (o.closed_to_departure) noDeparture.add(o.date); if (o.min_stay) minStays[o.date] = o.min_stay; });
        const validRanges: string[] = [];
        let rangeStart: Date | null = null;
        let maxMinStay = 1;
        const iterDate = new Date(from);
        const endMs = endCampaign.getTime();
        while (iterDate.getTime() <= endMs) {
          const key = iterDate.toISOString().split("T")[0];
          const isBlocked = blocked.has(key);
          const isLast = iterDate.getTime() >= endMs - 86400000;
          if (!isBlocked && !rangeStart && !noArrival.has(key)) { rangeStart = new Date(iterDate); maxMinStay = Math.max(maxMinStay, minStays[key] || propMinStay); }
          else if (!isBlocked && rangeStart) { maxMinStay = Math.max(maxMinStay, minStays[key] || propMinStay); }
          if ((isBlocked || isLast) && rangeStart) {
            const rangeEnd = isBlocked ? new Date(iterDate.getTime() - 86400000) : new Date(iterDate);
            if (!noDeparture.has(rangeEnd.toISOString().split("T")[0]) && rangeEnd >= rangeStart) {
              validRanges.push(`${rangeStart.toISOString().split("T")[0].split("-").reverse().join("/")} → ${rangeEnd.toISOString().split("T")[0].split("-").reverse().join("/")}${maxMinStay > 1 ? ` (min ${maxMinStay} notti)` : ""}`);
            }
            rangeStart = null; maxMinStay = 1;
          }
          iterDate.setDate(iterDate.getDate() + 1);
        }
        if (validRanges.length > 0) finalText += `\n\n📅 Date disponibili:\n${validRanges.join("\n")}`;
      }

      const text = finalText;
      const mediaUrls = (c.media_urls || []).filter((url: string) =>
        ["jpg", "jpeg", "png", "gif", "webp", "avif"].includes(url.split(".").pop()?.toLowerCase() || "")
      );

      let facebookPostId: string | null = null;

      if (mediaUrls.length > 0) {
        const meRes = await fetch(`https://graph.facebook.com/v22.0/me?fields=id&access_token=${token}`);
        const meData = await meRes.json();
        const pageId = meData.id;

        const mediaIds: string[] = [];
        for (const url of mediaUrls) {
          const fbRes = await fetch(`https://graph.facebook.com/v22.0/${pageId}/photos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, access_token: token, published: false }),
          });
          const fbData = await fbRes.json();
          if (fbData.id) mediaIds.push(fbData.id);
        }

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
          if (feedData.id) facebookPostId = feedData.id;
        }
      } else {
        const fbRes = await fetch(`https://graph.facebook.com/v22.0/me/feed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, access_token: token }),
        });
        const fbData = await fbRes.json();
        if (fbData.id) facebookPostId = fbData.id;
      }

      // Salva lo storico del post pubblicato
      await admin.from("campaign_posts").insert({
        campaign_id: c.id,
        text_content: text,
        media_urls: mediaUrls,
        scheduled_at: new Date().toISOString(),
        published_at: facebookPostId ? new Date().toISOString() : null,
        status: facebookPostId ? "published" : "failed",
        platform_ids: facebookPostId ? { facebook: facebookPostId } : {},
        platform: "scheduler",
      });

      if (facebookPostId) published.push(c.name);
    }

    return NextResponse.json({
      message: `Pubblicate ${published.length} campagne`,
      published,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
