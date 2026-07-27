import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const recipientId = url.searchParams.get("rid")?.trim();
  const targetUrl = url.searchParams.get("u");

  if (!targetUrl) return new Response("Missing target URL", { status: 400 });

  if (recipientId && recipientId !== "test") {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: recipient } = await supabase
        .from("campaign_recipients")
        .select("*")
        .eq("id", recipientId)
        .maybeSingle();

      if (recipient && (recipient.status === "sent" || recipient.status === "pending")) {
        const userAgent = req.headers.get("user-agent") || "";
        const now = new Date();
        const sentAt = recipient.sent_at ? new Date(recipient.sent_at) : new Date(recipient.created_at);
        const secondsSinceSent = (now.getTime() - sentAt.getTime()) / 1000;
        const isBot = /bot|crawler|spider|ahrefs|bing|preview|scanner/i.test(userAgent) || secondsSinceSent < 0.3;

        if (!isBot) {
          if (!recipient.clicked_at) {
            await supabase.from("campaign_recipients").update({
              clicked_at: now.toISOString(),
            }).eq("id", recipientId);
          }

          await supabase.from("campaign_recipients").update({
            clicks_count: (recipient.clicks_count || 0) + 1,
          }).eq("id", recipientId);

          // Re-count stats on campaign
          const cId = recipient.campaign_id;
          const { count: totalClicked } = await supabase
            .from("campaign_recipients")
            .select("*", { count: "exact", head: true })
            .eq("campaign_id", cId)
            .not("clicked_at", "is", null);

          await supabase.from("campaigns").update({
            stats_clicked: totalClicked || 0,
          }).eq("id", cId);
        }
      }
    } catch (e) {
      console.error("[track-click] Error:", e);
    }
  }

  return new Response(null, { status: 302, headers: { Location: targetUrl, "Cache-Control": "no-store, no-cache" } });
}
