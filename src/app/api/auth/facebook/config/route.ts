import { NextResponse } from "next/server";

export async function GET() {
  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
  if (!appId) {
    return NextResponse.json({ error: "Facebook App ID non configurata" }, { status: 500 });
  }
  return NextResponse.json({ appId });
}
