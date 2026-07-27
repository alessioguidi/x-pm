import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${origin}/settings?fb_error=${error}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/settings?fb_error=missing_params`);
  }

  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const redirectUri = `${origin}/api/auth/facebook/callback`;

  if (!appId || !appSecret) {
    return NextResponse.redirect(`${origin}/settings?fb_error=config_missing`);
  }

  try {
    const stateParts = state.split("|");
    const orgId = stateParts[0];

    const tokenRes = await fetch(
      `https://graph.facebook.com/v22.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
    );
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return NextResponse.redirect(`${origin}/settings?fb_error=token_exchange_failed`);
    }

    // Exchange for long-lived token
    const longTokenRes = await fetch(
      `https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`
    );
    const longTokenData = await longTokenRes.json();
    const accessToken = longTokenData.access_token || tokenData.access_token;

    // Try to get pages list
    const pagesRes = await fetch(
      `https://graph.facebook.com/v22.0/me/accounts?access_token=${accessToken}&fields=id,name,access_token,instagram_business_account`
    );
    const pagesData = await pagesRes.json();

    const page = pagesData.data?.[0];
    if (page) {
      // Page found — save everything and done
      const pageToken = page.access_token;
      const instagramId = page.instagram_business_account?.id || null;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (serviceKey) {
        const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);
        await admin.from("organizations").update({
          facebook_page_token: pageToken,
          instagram_account_id: instagramId,
          facebook_user_token: null,
        }).eq("id", orgId);
      }
      return NextResponse.redirect(
        `${origin}/settings?fb_success=1&page=${encodeURIComponent(page.name)}${instagramId ? `&ig=1` : ""}`
      );
    }

    // No page found — save user token and ask for Page ID
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceKey) {
      const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);
      await admin.from("organizations").update({
        facebook_user_token: accessToken,
      }).eq("id", orgId);
    }

    return NextResponse.redirect(`${origin}/settings?fb_needs_page=1`);
  } catch (err: any) {
    return NextResponse.redirect(`${origin}/settings?fb_error=${err.message}`);
  }
}
