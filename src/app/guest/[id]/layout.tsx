import type { Metadata } from "next";
import { getGuestBookingMeta, fmtRange } from "@/utils/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const booking = await getGuestBookingMeta(id);
  const prop = booking?.properties?.name || "Struttura";
  const title = `${prop} — Portale Ospite`;
  const description = booking
    ? `Prenotazione di ${booking.guest_name} • ${fmtRange(booking.check_in_date, booking.check_out_date)}`
    : "Il portale del tuo soggiorno";
  return {
    title,
    description,
    openGraph: { title, description, type: "website", siteName: "Property Manager", images: [{ url: "/icons/icon-512.png", width: 512, height: 512 }] },
    twitter: { card: "summary", title, description, images: ["/icons/icon-512.png"] },
  };
}

export default function GuestPortalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
