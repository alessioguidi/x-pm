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
  return {
    title,
    description,
    openGraph: { title, description, type: "website", siteName: "Property Manager", images: [{ url: "/icons/icon-512.png", width: 512, height: 512 }] },
    twitter: { card: "summary", title, description, images: ["/icons/icon-512.png"] },
  };
}

export default function GuestCheckinLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
