import { ImageResponse } from "next/og";
import { getGuestBookingMeta, fmtRange } from "@/utils/supabase/server";

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
  const guestName = booking?.guest_name || "Ospite";
  const dates = booking ? fmtRange(booking.check_in_date, booking.check_out_date) : "";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1d4ed8, #6366f1)",
          color: "white",
          padding: 60,
        }}
      >
        {logoDataUrl && (
          <div
            style={{
              width: 180,
              height: 180,
              borderRadius: 36,
              background: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              marginBottom: 36,
            }}
          >
            {/* satori img */}
            <img src={logoDataUrl} width={150} height={150} style={{ objectFit: "contain" }} />
          </div>
        )}
        <div style={{ fontSize: 56, fontWeight: 800, textAlign: "center", lineHeight: 1.2 }}>{propName}</div>
        <div style={{ fontSize: 30, opacity: 0.95, marginTop: 18, textAlign: "center" }}>{`Prenotazione di ${guestName}${dates ? ` • ${dates}` : ""}`}</div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
