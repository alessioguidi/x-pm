import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import { PlusCircle, MapPin, Bed, Users, ExternalLink } from "lucide-react";

// Forziamo il render dinamico se stiamo leggendo i dati dal Database
export const dynamic = 'force-dynamic';

export default async function PropertiesPage() {
  
  // Estrazione lista immobili dal database Supabase
  const { data: properties, error } = await supabase
    .from('properties')
    .select('*, organizations(slug), property_photos(image_url)')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">I Miei Immobili</h1>
        <Link 
          href="/properties/new" 
          className="flex items-center px-5 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <PlusCircle className="w-5 h-5 mr-2" />
          Aggiungi Immobile
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {error && (
          <div className="p-4 bg-red-50 text-red-600">Errore nel caricamento dei dati: controlla la connessione a Supabase.</div>
        )}
        
        {!error && (!properties || properties.length === 0) ? (
          <div className="p-12 text-center text-gray-500">
            Nessun immobile trovato. Inizia cliccando su "Aggiungi Immobile".
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {properties?.map((property) => {
              const mainPhoto = property.property_photos?.[0]?.image_url || "https://placehold.co/100x100?text=No+Foto";
              return (
              <li key={property.id} className="hover:bg-gray-50 transition-colors group relative bg-white">
                <Link href={`/properties/${property.id}`} className="absolute inset-0 z-0">
                  <span className="sr-only">Vedi dettagli di {property.name}</span>
                </Link>
                <div className="p-4 sm:p-6 flex items-center justify-between w-full relative z-10 pointer-events-none">
                  <div className="flex items-center gap-4">
                    {/* Immagine */}
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0 bg-gray-100 pointer-events-auto">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={mainPhoto} alt="Cover" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    </div>
                    {/* Dettagli Testuali */}
                    <div className="pointer-events-auto">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 group-hover:text-blue-600 transition-colors">
                        <Link href={`/properties/${property.id}`} className="hover:underline">
                          {property.name}
                        </Link>
                        
                        <a 
                          href={`/b/${(property.organizations as any)?.slug || (property.organizations as any)?.[0]?.slug || 'cinzia-case'}/p/${property.slug}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-blue-600 transition-colors ml-2 p-1 bg-white rounded-md border shadow-sm hover:shadow"
                          title="Vedi Pagina Pubblica"
                        >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                      </h3>
                      <div className="mt-1 flex items-center flex-wrap text-sm text-gray-500 space-x-3 sm:space-x-4">
                        <span className="flex items-center"><MapPin className="w-4 h-4 mr-1 opacity-70"/> {property.city || 'N/A'}</span>
                        <span className="flex items-center"><Bed className="w-4 h-4 mr-1 opacity-70"/> {property.bedrooms} Camere</span>
                        <span className="flex items-center"><Users className="w-4 h-4 mr-1 opacity-70"/> Max {property.max_guests} Ospiti</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end justify-center pointer-events-auto">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${property.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800 border border-gray-200'}`}>
                      {property.is_active ? 'Online' : 'Bozza'}
                    </span>
                    <p className="mt-2 text-sm font-bold text-gray-900">
                      €{property.base_price_per_night} <span className="text-gray-500 font-normal">/notte base</span>
                    </p>
                  </div>
                </div>
              </li>
            )})}
          </ul>
        )}
      </div>
    </div>
  );
}
