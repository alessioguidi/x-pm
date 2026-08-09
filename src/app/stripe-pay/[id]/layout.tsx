import type { Metadata } from "next";
import Stripe from "stripe";
import { getGuestBookingMeta } from "@/utils/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  let title = "Pagamento Sicuro";
  let description = "Pagamento tramite Stripe";
  let bookingId = "";

  try {
    const pi = await stripe.paymentIntents.retrieve(id);
    const reason = pi.metadata?.reason || pi.description || "Pagamento";
    const amount = (pi.amount / 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    title = `Pagamento — ${reason}`;
    description = `Importo: €${amount}`;

    if (pi.metadata?.booking_id) {
      bookingId = pi.metadata.booking_id;
      const booking = await getGuestBookingMeta(bookingId);
      if (booking) {
        const dates = `${booking.check_in_date?.split("-").reverse().join("/")} - ${booking.check_out_date?.split("-").reverse().join("/")}`;
        description = `Prenotazione di ${booking.guest_name}${dates ? ` • ${dates}` : ""} • €${amount}`;
      }
    }
  } catch {
    // link non valido: mantiene il fallback generico
  }

  const ogUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://x-pm-omega.vercel.app"}/og/${bookingId}`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website", siteName: "Property Manager", images: [{ url: ogUrl, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [ogUrl] },
  };
}

export default function StripePayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
