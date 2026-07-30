import { supabase } from "@/utils/supabase/client";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Users, Bed, ChevronRight } from "lucide-react";
import CoverCarousel from "@/components/public/CoverCarousel";
import type { Metadata } from "next";

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ org_slug: string }> }): Promise<Metadata> {
  const { org_slug } = await params;
  const { data: org } = await supabase.from('organizations').select('name, description, host_photo, logo_url, cover_photos').eq('slug', org_slug).single();
  if (!org) return { title: "Property Manager" };
  const ogImage = org.host_photo || org.logo_url || org.cover_photos?.[0] || "/icons/icon.svg";
  return {
    title: org.name,
    description: org.description || `Benvenuti da ${org.name} — Esplora le nostre proprietà`,
    openGraph: {
      title: org.name,
      description: org.description || `Benvenuti da ${org.name}`,
      images: [{ url: ogImage, width: 512, height: 512 }],
    },
    twitter: {
      card: "summary",
      title: org.name,
      description: org.description || `Benvenuti da ${org.name}`,
      images: [ogImage],
    },
  };
}

export default async function PublicOrganizationPage({ params }: { params: Promise<{ org_slug: string }> }) {
  const resolvedParams = await params;
  const orgSlug = resolvedParams.org_slug;

  const { data: org } = await supabase.from('organizations').select('id, name, theme_color, cover_photos').eq('slug', orgSlug).single();
  if (!org) notFound();

  // Omette le strutture nascoste is_active = false
  const { data: properties } = await supabase.from('properties')
    .select('*, property_photos(image_url, display_order, media_type)')
    .eq('organization_id', org.id)
    .eq('is_active', true)
    .order('display_order', { referencedTable: 'property_photos', ascending: true, nullsFirst: false });

  const today = new Date().toISOString().split('T')[0];
  const propertyIds = properties?.map(p => p.id) || [];
  
  // Cover photos: org cover_photos, fallback to first property photo
  const coverPhotos = (org.cover_photos && org.cover_photos.length > 0)
    ? org.cover_photos
    : (() => {
        const first = properties?.reduce<string | null>((found, p) => found || p.property_photos?.[0]?.image_url || null, null);
        return first ? [first] : [];
      })();

  let minimumPrices: Record<string, number> = {};
  if (propertyIds.length > 0) {
     const { data: calData } = await supabase.from('calendar')
        .select('property_id, price')
        .in('property_id', propertyIds)
        .gte('date', today)
        .limit(10000);
        
     if (calData) {
        calData.forEach(c => {
           if (c.price && c.price > 0) {
              if (!minimumPrices[c.property_id] || c.price < minimumPrices[c.property_id]) {
                 minimumPrices[c.property_id] = c.price;
              }
           }
        });
     }
  }

  return (
    <div className="animate-in fade-in duration-700">
      {/* Hero Carousel */}
      <CoverCarousel images={coverPhotos} themeColor={org.theme_color} orgName={org.name} />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
          <div>
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 tracking-tight">Le Nostre Strutture</h2>
            <div className="w-24 h-1.5 mt-6 rounded-full" style={{ backgroundColor: 'var(--theme-color)'}}></div>
          </div>
          <p className="text-gray-500 mt-4 md:mt-0 max-w-md md:text-right">
            Scegli tra {properties?.length || 0} fantastiche sistemazioni pronte ad accoglierti.
          </p>
        </div>

        {(!properties || properties.length === 0) ? (
          <div className="text-center text-gray-500 py-24 bg-white rounded-3xl border border-dashed border-gray-300">
             Nessuna struttura è attualmente visibile al pubblico. Assicurati che l'immobile sia attivo dal Backoffice.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {properties.map(p => {
              const mainPhoto = p.property_photos?.[0]?.image_url || "https://placehold.co/600x400?text=Nessuna+Foto";
              const isVideo = p.property_photos?.[0]?.media_type === 'video' ;
              const startingPrice = minimumPrices[p.id] ? Math.min(minimumPrices[p.id], p.base_price_per_night) : p.base_price_per_night;
              return (
                <Link key={p.id} href={`/b/${orgSlug}/p/${p.slug}`} className="group flex flex-col bg-white rounded-3xl shadow-sm hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100 relative translate-y-0 hover:-translate-y-2">
                  <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                    {isVideo ? (
                      <video src={mainPhoto} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out" muted playsInline />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mainPhoto} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out" />
                    )}
                    
                    {/* Price Badge */}
                    {!p.hide_prices && (
                    <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl text-sm font-bold shadow-lg" style={{ color: 'var(--theme-color)'}}>
                      Da €{startingPrice} <span className="text-gray-400 font-normal text-xs">/notte</span>
                    </div>
                    )}
                  </div>
                  
                  <div className="p-8 flex flex-col flex-grow">
                    <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-[var(--theme-color)] transition-colors">{p.name}</h3>
                    <div className="flex items-center text-sm text-gray-500 mb-6 font-medium">
                      <MapPin className="w-4 h-4 mr-1.5 opacity-70" /> {p.city}
                    </div>
                    
                    <div className="mt-auto">
                      <div className="flex items-center justify-between text-sm text-gray-600 bg-gray-50 p-4 rounded-2xl mb-6 shadow-sm">
                        <span className="flex items-center font-medium"><Users className="w-4 h-4 mr-2 opacity-70" style={{ color: 'var(--theme-color)'}}/> Fino a {p.max_guests} Ospiti</span>
                        <span className="w-px h-4 bg-gray-200"></span>
                        <span className="flex items-center font-medium"><Bed className="w-4 h-4 mr-2 opacity-70" style={{ color: 'var(--theme-color)'}}/> {p.bedrooms} Camere</span>
                      </div>
                      
                      <div className="flex items-center text-sm font-bold transition-transform group-hover:translate-x-1" style={{ color: 'var(--theme-color)'}}>
                        Visualizza disponibilità <ChevronRight className="w-4 h-4 ml-1" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
