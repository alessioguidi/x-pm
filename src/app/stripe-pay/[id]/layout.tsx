import type { Metadata } from "next";
import Stripe from "stripe";
import { getGuestBookingMeta } from "@/utils/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  let title = "Pagamento Sicuro";
  let description = "Pagamento tramite Stripe";
  let logo = "/icons/icon-512.png";

  try {
    const pi = await stripe.paymentIntents.retrieve(id);
    const reason = pi.metadata?.reason || pi.description || "Pagamento";
    const amount = (pi.amount / 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    title = `Pagamento — ${reason}`;
    description = `Importo: €${amount}`;

    if (pi.metadata?.booking_id) {
      const booking = await getGuestBookingMeta(pi.metadata.booking_id);
      if (booking) {
        const dates = `${booking.check_in_date?.split("-").reverse().join("/")} - ${booking.check_out_date?.split("-").reverse().join("/")}`;
        description = `Prenotazione di ${booking.guest_name}${dates ? ` • ${dates}` : ""} • €${amount}`;
        if (booking.properties?.logo_url) logo = booking.properties.logo_url;
      }
    }
  } catch {
    // link non valido: mantiene il fallback generico
  }

  return {
    title,
    description,
    openGraph: { title, description, type: "website", siteName: "Property Manager", images: [{ url: logo, width: 512, height: 512 }] },
    twitter: { card: "summary", title, description, images: [logo] },
  };
}

export default function StripePayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
