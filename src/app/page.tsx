import { GlobalHeader } from "@/components/public/GlobalHeader";
import Link from "next/link";
import { CheckCircle2, ArrowRight, Home, CalendarCheck, Paintbrush, Euro } from "lucide-react";

export const dynamic = "force-static"; // Landing Page non ha bisogno di chiamate DB attive

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans selection:bg-rose-100">
      <GlobalHeader />

      {/* HERO SECTION */}
      <div className="relative pt-24 pb-32 lg:pt-36 lg:pb-40 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-rose-50 to-white -z-10" />
        <div className="absolute inset-y-0 right-0 w-1/2 bg-rose-50/50 rounded-l-[100px] -z-10 hidden lg:block" />
        
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="max-w-2xl">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-rose-100/50 text-rose-700 text-sm font-semibold mb-6 border border-rose-200">
              <span className="flex h-2 w-2 rounded-full bg-rose-600 mr-2 animate-pulse"></span>
              La piattaforma definitiva per Property Manager
            </div>
            <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-gray-900 leading-[1.1] mb-6">
              Il tuo Motore di <span className="text-rose-600">Booking Diretto</span>
            </h1>
            <p className="text-xl text-gray-600 mb-10 leading-relaxed">
              Dimentica le commissioni OTA. Ottieni un formidabile Sito Web per i tuoi alloggi, un Gestionale completo e un'App per lo Staff. Tutto sincronizzato, in una sola piattaforma B2B.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link 
                href="/login" 
                className="inline-flex justify-center items-center px-8 py-4 text-lg font-bold rounded-xl text-white bg-rose-600 hover:bg-rose-700 shadow-xl hover:shadow-rose-600/30 transition-all hover:-translate-y-0.5"
              >
                Inizia Ora Gratis (7 Giorni) <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <Link 
                href="#features" 
                className="inline-flex justify-center items-center px-8 py-4 text-lg font-bold rounded-xl text-gray-700 bg-white border-2 border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all"
              >
                Scopri le funzioni
              </Link>
            </div>
            <div className="mt-8 flex items-center text-sm font-medium text-gray-500 gap-6">
               <span className="flex items-center"><CheckCircle2 className="w-4 h-4 text-green-500 mr-1.5"/> Zero Commissioni Booking</span>
               <span className="flex items-center"><CheckCircle2 className="w-4 h-4 text-green-500 mr-1.5"/> Setup in 5 Minuti</span>
            </div>
          </div>
          
          <div className="relative lg:h-[600px] rounded-3xl bg-gray-900 shadow-2xl p-4 overflow-hidden hidden md:block border-[8px] border-gray-800">
             {/* Schermata Finta del Gestionale */}
             <div className="w-full h-full bg-white rounded-xl overflow-hidden flex flex-col">
                <div className="h-10 bg-gray-100 border-b flex items-center px-4 gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  <div className="ml-4 h-4 w-1/2 bg-gray-200 rounded-full"></div>
                </div>
                <div className="flex-1 p-6 flex gap-6">
                   <div className="w-48 hidden lg:flex flex-col gap-3">
                      <div className="h-8 bg-rose-100 rounded-lg w-full"></div>
                      <div className="h-8 bg-gray-100 rounded-lg w-3/4"></div>
                      <div className="h-8 bg-gray-100 rounded-lg w-5/6"></div>
                   </div>
                   <div className="flex-1 flex flex-col gap-4">
                      <div className="h-24 bg-rose-50 rounded-xl border border-rose-100 p-4">
                        <div className="h-4 w-32 bg-rose-200 rounded mb-2"></div>
                        <div className="h-8 w-24 bg-rose-600 rounded"></div>
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-xl border border-gray-100 p-4 grid grid-cols-3 gap-2">
                         {[...Array(9)].map((_, i) => (
                           <div key={i} className={`h-12 rounded ${i%4===0 ? 'bg-blue-200' : 'bg-gray-200'}`}></div>
                         ))}
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* FEATURES */}
      <section id="features" className="py-24 bg-white">
         <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto mb-16">
               <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 mb-4">Un intero team, racchiuso in un software.</h2>
               <p className="text-lg text-gray-600">Altamira PMS non offre solo un sito vetrina per vendere direttamente ai tuoi clienti, ma ti aiuta a gestire le operazioni quotidiane.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
               
               <div className="bg-gray-50 rounded-2xl p-8 hover:bg-rose-50 transition-colors border border-gray-100">
                  <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-6 text-rose-600">
                     <Home className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Vetrina & Booking Engine</h3>
                  <p className="text-gray-600">Un sito web moderno e ottimizzato per l'acquisizione diretta. I clienti visualizzano preventivi dinamici e prenotano inviando email automatiche al tuo Gestionale.</p>
               </div>

               <div className="bg-gray-50 rounded-2xl p-8 hover:bg-rose-50 transition-colors border border-gray-100">
                  <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-6 text-blue-600">
                     <CalendarCheck className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Multi-Calendario</h3>
                  <p className="text-gray-600">Visualizza a colpo d'occhio l'occupazione di tutte le tue strutture. Gestisci prezzi dinamici, Overrides (soggiorni minimi) e blocchi per manutenzione.</p>
               </div>

               <div className="bg-gray-50 rounded-2xl p-8 hover:bg-rose-50 transition-colors border border-gray-100">
                  <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-6 text-green-600">
                     <Paintbrush className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">App Mobile Operativa Staff</h3>
                  <p className="text-gray-600">Distribuisci incarichi di pulizia alle tue squadre. I dipendenti segnano transazioni di Cassa, rimborsi spese (scontrini) e stato lavori direttamente dal telefono, senza password.</p>
               </div>

            </div>
         </div>
      </section>

      {/* PRICING (SaaS) */}
      <section className="py-24 bg-gray-900 text-white">
         <div className="max-w-7xl mx-auto px-6 text-center">
            <h2 className="text-3xl lg:text-4xl font-bold mb-6">Scegli il piano giusto per la tua attività</h2>
            <p className="text-xl text-gray-400 mb-16 max-w-2xl mx-auto">Inizia con 7 giorni di prova gratuita su tutti i piani. Nessuna carta di credito richiesta.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto items-center">
               
               {/* BASIC PLAN */}
               <div className="bg-gray-800 text-white rounded-3xl p-8 shadow-xl border border-gray-700 text-left transition-transform hover:-translate-y-1">
                  <h3 className="text-2xl font-bold mb-2">Piano Basic</h3>
                  <div className="text-5xl font-extrabold mb-6 flex items-center">
                     <Euro className="w-8 h-8 text-gray-400 mr-1"/> 9 <span className="text-lg text-gray-500 font-medium ml-1"> /mese</span>
                  </div>
                  <ul className="space-y-4 mb-8 text-gray-300 font-medium">
                     <li className="flex items-center"><CheckCircle2 className="w-5 h-5 text-green-400 mr-3 shrink-0"/> Gestione 1 Immobile Singolo</li>
                     <li className="flex items-center"><CheckCircle2 className="w-5 h-5 text-green-400 mr-3 shrink-0"/> Sito Vetrina & Booking Engine</li>
                     <li className="flex items-center"><CheckCircle2 className="w-5 h-5 text-green-400 mr-3 shrink-0"/> Multi-Calendario & Prezzi Dinamici</li>
                     <li className="flex items-center text-gray-500 line-through"><CheckCircle2 className="w-5 h-5 text-gray-600 mr-3 shrink-0"/> Automazioni Marketing (Campagne)</li>
                  </ul>
                  <Link href="/login" className="block w-full py-4 text-center rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-bold transition shadow-md">
                     Avvia Trial
                  </Link>
               </div>

               {/* PREMIUM PLAN */}
               <div className="bg-white text-gray-900 rounded-3xl p-8 shadow-2xl border border-gray-100 text-left relative transform md:scale-105 z-10">
                  <div className="absolute -top-4 right-8 bg-rose-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg shadow-rose-500/30">
                     Il Più Richiesto
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Piano Premium</h3>
                  <div className="text-5xl font-extrabold mb-6 flex items-center">
                     <Euro className="w-8 h-8 text-gray-400 mr-1"/> 49 <span className="text-lg text-gray-500 font-medium ml-1"> /mese</span>
                  </div>
                  <ul className="space-y-4 mb-8 font-medium text-gray-600">
                     <li className="flex items-center"><CheckCircle2 className="w-5 h-5 text-green-500 mr-3 shrink-0"/> <b className="text-gray-900 mr-1">Fino a 5 Immobili</b> gestibili</li>
                     <li className="flex items-center"><CheckCircle2 className="w-5 h-5 text-green-500 mr-3 shrink-0"/> Sito Vetrina & Booking Engine</li>
                     <li className="flex items-center"><CheckCircle2 className="w-5 h-5 text-green-500 mr-3 shrink-0"/> Gestione Ledger & Staff App Mobile</li>
                     <li className="flex items-center"><CheckCircle2 className="w-5 h-5 text-rose-500 mr-3 shrink-0"/> <b className="text-gray-900 mr-1">Funzionalità Marketing e SEO</b></li>
                     <li className="flex items-center"><CheckCircle2 className="w-5 h-5 text-rose-500 mr-3 shrink-0"/> <b className="text-gray-900 mr-1">Agenti IA per descrizioni</b></li>
                  </ul>
                  <Link href="/login" className="block w-full py-4 text-center rounded-xl bg-gray-900 text-white hover:bg-gray-800 font-bold transition shadow-xl mt-4">
                     Avvia Trial
                  </Link>
               </div>

            </div>

            {/* ENTERPRISE BOX */}
            <div className="mt-16 bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50 max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between text-left">
               <div>
                 <h4 className="text-xl font-bold mb-1">Esigenze Enterprise? (&gt; 5 Immobili)</h4>
                 <p className="text-gray-400 text-sm">Contatta il nostro team per un piano dedicato al tuo ecosistema immobiliare.</p>
               </div>
               <Link href="mailto:sales@altamira-pms.it" className="mt-4 sm:mt-0 font-bold text-rose-400 hover:text-rose-300 underline underline-offset-4">
                 Contatta Vendite →
               </Link>
            </div>
         </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-50 py-12 border-t border-gray-200 text-center">
         <div className="max-w-7xl mx-auto px-6 text-gray-500 font-medium">
             © {new Date().getFullYear()} Altamira PMS Engine. Tutti i diritti riservati.<br/>
             <span className="text-sm">Costruito per scalare il Property Management in locale.</span>
         </div>
      </footer>

    </div>
  );
}
