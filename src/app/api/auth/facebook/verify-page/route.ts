import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { org_id, page_id } = await req.json();
    if (!org_id || !page_id) {
      return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!serviceKey) {
      return NextResponse.json({ error: "Service key non configurata" }, { status: 500 });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: org } = await admin.from("organizations").select("facebook_user_token").eq("id", org_id).single();
    if (!org?.facebook_user_token) {
      return NextResponse.json({ error: "Nessun token utente. Ricollegati con Facebook." }, { status: 400 });
    }

    // Get page access token using the user token
    const pageRes = await fetch(
      `https://graph.facebook.com/v22.0/${page_id}?fields=id,name,access_token,instagram_business_account&access_token=${org.facebook_user_token}`
    );
    const pageData = await pageRes.json();

    if (!pageData.access_token) {
      return NextResponse.json({
        error: pageData.error?.message || "Impossibile ottenere il token della pagina. Verifica l'ID.",
      }, { status: 400 });
    }

    const instagramId = pageData.instagram_business_account?.id || null;

    await admin.from("organizations").update({
      facebook_page_token: pageData.access_token,
      instagram_account_id: instagramId,
      facebook_user_token: null,
    }).eq("id", org_id);

    return NextResponse.json({
      success: true,
      page_name: pageData.name,
      instagram: !!instagramId,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
