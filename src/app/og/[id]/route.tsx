import { ImageResponse } from "next/og";
import { getGuestBookingMeta } from "@/utils/supabase/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const booking = await getGuestBookingMeta(id);

  let logoDataUrl: string | null = null;
  if (booking?.properties?.logo_url) {
    try {
      const res = await fetch(booking.properties.logo_url);
      const buf = Buffer.from(await res.arrayBuffer());
      const type = res.headers.get("content-type") || "image/jpeg";
      logoDataUrl = `data:${type};base64,${buf.toString("base64")}`;
    } catch {
      logoDataUrl = null;
    }
  }

  const propName = booking?.properties?.name || "Struttura";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {logoDataUrl ? (
          /* satori img */
          <img src={logoDataUrl} width={1200} height={630} style={{ objectFit: "contain" }} />
        ) : (
          <div style={{ fontSize: 64, fontWeight: 800, color: "#1d4ed8", textAlign: "center", lineHeight: 1.2 }}>{propName}</div>
        )}
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
