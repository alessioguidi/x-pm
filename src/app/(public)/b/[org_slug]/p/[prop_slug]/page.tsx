import { supabase } from "@/utils/supabase/client";
import { notFound } from "next/navigation";
import { MapPin, Users, Bed, Bath, CheckSquare, ShieldCheck, AlertCircle, Clock } from "lucide-react";
import Link from "next/link";
import LightboxGallery from "@/components/public/LightboxGallery";
import BookingWidget from "@/components/public/BookingWidget";
import type { Metadata } from "next";

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ org_slug: string, prop_slug: string }> }): Promise<Metadata> {
  const { org_slug, prop_slug } = await params;
  const { data: property } = await supabase
    .from('properties')
    .select('name, city, property_photos(image_url, display_order), organizations!inner(name)')
    .eq('slug', prop_slug)
    .eq('organizations.slug', org_slug)
    .order('display_order', { referencedTable: 'property_photos', ascending: true, nullsFirst: false })
    .single();
  if (!property) return { title: "Property Manager" };
  const orgName = Array.isArray(property.organizations) ? property.organizations[0]?.name : (property.organizations as any)?.name;
  const ogImage = property.property_photos?.[0]?.image_url || "/icons/icon.svg";
  return {
    title: `${property.name} — ${orgName}`,
    description: `${property.name} a ${property.city || "località"}`,
    openGraph: {
      title: property.name,
      description: `${property.name} a ${property.city || "località"} — ${orgName}`,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: property.name,
      description: `${property.name} a ${property.city || "località"}`,
      images: [ogImage],
    },
  };
}

export default async function PropertyDetailPage({ params }: { params: Promise<{ org_slug: string, prop_slug: string }> }) {
  const resolvedParams = await params;
  const { org_slug, prop_slug } = resolvedParams;

  // Fetch the property and its photos
  const { data: property } = await supabase
    .from('properties')
    .select('*, organizations!inner(*), property_photos(*)')
    .eq('slug', prop_slug)
    .eq('organizations.slug', org_slug)
    .order('display_order', { referencedTable: 'property_photos', ascending: true, nullsFirst: false })
    .single();

  if (!property) notFound();

  const photos = (property.property_photos || []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
      
      {/* Pulsante Indietro e Titolo */}
      <div className="mb-6">
        <Link href={`/b/${org_slug}`} className="inline-flex items-center text-sm font-medium hover:underline mb-4 transition-colors font-bold" style={{ color: 'var(--theme-color)'}}>
           ← Torna alle nostre strutture
        </Link>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight mb-2">
          {property.name}
        </h1>
        <div className="flex items-center text-gray-600 font-medium text-sm">
          <MapPin className="w-4 h-4 mr-1.5" /> 
          <span className="underline decoration-gray-300 underline-offset-4">{property.address || 'Indirizzo da inserire'}, {property.city || 'Città'}</span>
        </div>
      </div>

      {/* Galleria Fotografica Moderna (Stile Airbnb) */}
      <LightboxGallery photos={photos} />

      {/* Contenuto e Sidebar Prenotazione */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        
        {/* Colonna Sinistra (Dettagli) */}
        <div className="lg:col-span-2 space-y-10">
          
          <div className="flex justify-between items-start border-b border-gray-200 pb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Un soggiorno offerto da {property.organizations.name}</h2>
              <div className="flex flex-wrap gap-4 text-gray-600 font-medium">
                <span className="flex items-center"><Users className="w-5 h-5 mr-2 opacity-70"/> Fino a {property.max_guests} ospiti</span>
                <span className="flex items-center"><Bed className="w-5 h-5 mr-2 opacity-70"/> {property.bedrooms} camere</span>
                <span className="flex items-center"><Bath className="w-5 h-5 mr-2 opacity-70"/> {property.bathrooms || 1} bagni</span>
              </div>
            </div>
            {/* Host Avatar */}
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl text-white font-bold shadow-md overflow-hidden bg-gray-100 shrink-0" style={!property.organizations.host_photo ? { backgroundColor: 'var(--theme-color)'} : {}}>
               {property.organizations.host_photo ? (
                 // eslint-disable-next-line @next/next/no-img-element
                 <img src={property.organizations.host_photo} alt={property.organizations.name} className="w-full h-full object-cover" />
               ) : (
                 property.organizations.name.charAt(0).toUpperCase()
               )}
            </div>
          </div>

          <div>
            {property.description && (
              <div className="mb-10">
                <h3 className="text-xl font-bold text-gray-900 mb-4">La Struttura</h3>
                <div className="prose prose-gray max-w-none text-gray-600">
                  <p className="whitespace-pre-line">{property.description}</p>
                </div>
              </div>
            )}
            <h3 className="text-xl font-bold text-gray-900 mb-4">L'Host: {property.organizations.name}</h3>
            <div className="prose prose-gray max-w-none text-gray-600 space-y-4">
              <p>{property.organizations.description || 'Nessuna descrizione è stata ancora fornita dall\'host.'}</p>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-6">Cosa troverai in struttura</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 text-gray-700 mb-8 border-b pb-8">
              {(!property.amenities || property.amenities.length === 0) ? (
                 <p className="text-gray-500 italic">Servizi non specificati.</p>
              ) : (
                property.amenities.map((item: string, i: number) => (
                  <div key={i} className="flex items-center text-md font-medium text-gray-800">
                    <CheckSquare className="w-5 h-5 mr-3 text-gray-400" /> {item}
                  </div>
                ))
              )}
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-6">Sicurezza</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 text-gray-700 mb-8 border-b pb-8">
              {(!property.safety_features || property.safety_features.length === 0) ? (
                 <p className="text-gray-500 italic">Nessun dispositivo di sicurezza segnalato.</p>
              ) : (
                property.safety_features.map((item: string, i: number) => (
                  <div key={i} className="flex items-center text-md font-medium text-gray-800">
                    <ShieldCheck className="w-5 h-5 mr-3 text-gray-400" /> {item}
                  </div>
                ))
              )}
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-6">Regole della casa e Info</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-700 bg-gray-50 p-6 rounded-2xl border border-gray-100">
              
              <div>
                 <h4 className="font-bold flex items-center mb-2"><Clock className="w-4 h-4 mr-2"/> Check-in / Check-out</h4>
                 <ul className="space-y-1 text-gray-600">
                   <li>Metodo: <span className="font-medium text-gray-800">{property.check_in_method || "Di persona"}</span></li>
                   {property.house_rules?.quiet_hours_start && (
                     <li>Orario di Silenzio: {property.house_rules.quiet_hours_start} - {property.house_rules.quiet_hours_end}</li>
                   )}
                 </ul>
              </div>

              <div>
                 <h4 className="font-bold flex items-center mb-2"><AlertCircle className="w-4 h-4 mr-2"/> Regole Alloggio</h4>
                 <ul className="space-y-1 text-gray-600">
                   <li>Animali: <span className="font-medium text-gray-800">{property.house_rules?.pets_allowed ? "Ammessi" : "Non ammessi"}</span></li>
                   <li>Fumatori: <span className="font-medium text-gray-800">{property.house_rules?.smoking_allowed ? "Ammessi" : "Vietato"}</span></li>
                   <li>Feste/Eventi: <span className="font-medium text-gray-800">{property.house_rules?.events_allowed ? "Consentiti" : "Vietati"}</span></li>
                 </ul>
              </div>

              <div className="col-span-1 md:col-span-2 pt-4 border-t border-gray-200">
                 <h4 className="font-bold mb-1">Termini di Cancellazione</h4>
                 <p className="text-gray-600">{property.cancellation_policy || "Contatta l'host per i dettagli."}</p>
              </div>

              {(property.cir || property.cin) && (
                <div className="col-span-1 md:col-span-2 pt-4 border-t border-gray-200">
                  <h4 className="font-bold mb-1">Codici Identificativi</h4>
                  <div className="flex flex-wrap gap-4 text-gray-600">
                    {property.cir && <span>CIR: <span className="font-medium text-gray-800">{property.cir}</span></span>}
                    {property.cin && <span>CIN: <span className="font-medium text-gray-800">{property.cin}</span></span>}
                  </div>
                </div>
              )}

            </div>

          </div>

        </div>

        {/* Colonna Destra (Widget Prenotazione) */}
        <div className="lg:col-span-1">
          <BookingWidget property={property} />
        </div>

      </div>

    </div>
  );
}
