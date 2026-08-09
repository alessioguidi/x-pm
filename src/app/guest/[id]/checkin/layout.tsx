import type { Metadata } from "next";
import { getGuestBookingMeta, fmtRange } from "@/utils/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const booking = await getGuestBookingMeta(id);
  const prop = booking?.properties?.name || "Struttura";
  const title = `${prop} — Check-in Ospiti`;
  const description = booking
    ? `Prenotazione di ${booking.guest_name} • ${fmtRange(booking.check_in_date, booking.check_out_date)}. Registra i dati di tutti gli ospiti.`
    : "Registrazione dei dati degli ospiti";
  const ogUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://x-pm-omega.vercel.app"}/og/${id}`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website", siteName: "Property Manager", images: [{ url: ogUrl, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [ogUrl] },
  };
}

export default function GuestCheckinLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
