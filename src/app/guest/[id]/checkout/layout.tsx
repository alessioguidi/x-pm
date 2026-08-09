import type { Metadata } from "next";
import { getGuestBookingMeta, fmtRange } from "@/utils/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const booking = await getGuestBookingMeta(id);
  const prop = booking?.properties?.name || "Struttura";
  const title = `${prop} — Check-out`;
  const description = booking
    ? `Prenotazione di ${booking.guest_name} • ${fmtRange(booking.check_in_date, booking.check_out_date)}.`
    : "Check-out del tuo soggiorno";
  const logo = booking?.properties?.logo_url || "/icons/icon-512.png";
  return {
    title,
    description,
    openGraph: { title, description, type: "website", siteName: "Property Manager", images: [{ url: logo, width: 512, height: 512 }] },
    twitter: { card: "summary", title, description, images: [logo] },
  };
}

export default function GuestCheckoutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
