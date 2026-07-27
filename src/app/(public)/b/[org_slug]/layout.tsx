import { ReactNode } from "react";
import { supabase } from "@/utils/supabase/client";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function OrganizationPublicLayout({ children, params }: { children: ReactNode, params: Promise<{ org_slug: string }> }) {
  const resolvedParams = await params;
  
  // Fetch organization
  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', resolvedParams.org_slug)
    .single();
  
  if (!org) {
    notFound();
  }

  // Prende il colore aziendale e lo inietta come CSS Variable "--theme-color"
  const themeColor = org.theme_color || '#2563eb';

  return (
    <div 
      className="min-h-screen flex flex-col bg-gray-50 font-sans" 
      style={{ '--theme-color': themeColor } as React.CSSProperties}
    >
      <header className="bg-white/90 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link href={`/b/${resolvedParams.org_slug}`} className="flex items-center gap-3 group">
             {(org.host_photo || org.logo_url) ? (
               // eslint-disable-next-line @next/next/no-img-element
               <img src={org.host_photo || org.logo_url} alt={org.name} className="h-10 w-10 rounded-full object-cover border border-gray-200" />
             ) : (
               <div 
                 className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm transition-transform group-hover:scale-105" 
                 style={{ backgroundColor: 'var(--theme-color)'}}
               >
                 {org.name.charAt(0).toUpperCase()}
               </div>
             )}
             <h1 className="text-xl font-bold text-gray-900 tracking-tight">{org.name}</h1>
          </Link>
          <nav className="hidden md:flex items-center space-x-8">
            <Link href={`/b/${resolvedParams.org_slug}`} className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
              Le Nostre Strutture
            </Link>
            <a 
              href="#contatti" 
              className="text-sm font-medium text-white px-6 py-2.5 rounded-full shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5" 
              style={{ backgroundColor: 'var(--theme-color)'}}
            >
              Contatti
            </a>
          </nav>
        </div>
      </header>
      
      <main className="flex-grow">
        {children}
      </main>
      
      <footer className="bg-gray-950 text-gray-400 py-16 mt-16" id="contatti">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-12 text-sm text-center md:text-left">
          <div className="space-y-4">
             <h3 className="text-white text-lg font-semibold">{org.name}</h3>
             <p className="opacity-80">Esperienze di soggiorno uniche gestite con passione e professionalità.</p>
          </div>
          <div className="space-y-4">
             <h3 className="text-white text-lg font-semibold">Scopri</h3>
             <ul className="space-y-2 opacity-80">
               <li><Link href={`/b/${resolvedParams.org_slug}`} className="hover:text-white transition-colors">Strutture</Link></li>
               <li><a href="#" className="hover:text-white transition-colors">Chi Siamo</a></li>
               <li><a href="#" className="hover:text-white transition-colors">Termini e Condizioni</a></li>
             </ul>
          </div>
          <div className="space-y-4">
             <h3 className="text-white text-lg font-semibold">Contatti</h3>
             <p className="opacity-80">Hai bisogno di assistenza per una prenotazione? Siamo a tua disposizione.</p>
             <button 
               className="mt-2 text-white border border-gray-700 px-4 py-2 rounded-lg hover:border-gray-500 transition-colors"
             >
               Invia Messaggio
             </button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 border-t border-gray-800 mt-12 pt-8 text-center text-xs opacity-60">
           © {new Date().getFullYear()} {org.name}. Tutti i diritti riservati.<br/>
           Engineered with PMS System
        </div>
      </footer>
    </div>
  );
}
