import { ReactNode } from "react";
import Link from "next/link";
import { BoxSelect, Home, Settings, CalendarDays, CheckSquare, Users, Eye, Sparkles, Inbox } from "lucide-react";
import { supabase } from "@/utils/supabase/client";
import AdminSidebar from "@/components/admin/AdminSidebar";
import MobileNavbar from "@/components/admin/MobileNavbar";
import NotificationPrompt from "@/components/NotificationPrompt";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Simuliamo il fetch dell'organizzazione per recuperare lo slug (temporaneo per mono-tenant local)
  const { data: org } = await supabase.from('organizations').select('slug').limit(1).single();
  const orgSlug = org?.slug || 'altamira-case';
  return (
    <div className="h-[100dvh] overflow-hidden bg-gray-50 flex flex-col md:flex-row font-sans selection:bg-rose-100 pb-[68px] md:pb-0">
      <AdminSidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative z-0">
        <header className="h-[72px] bg-white/95 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-4 md:px-8 sticky flex-shrink-0 top-0 z-10 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
             <div className="w-8 h-8 md:hidden shadow-md bg-gradient-to-br from-rose-500 to-rose-700 rounded-lg flex items-center justify-center mr-1 pb-px">
               <BoxSelect className="w-4 h-4 text-white" />
             </div>
             <h2 className="text-xl md:text-2xl font-extrabold text-gray-900 tracking-tight">Backoffice</h2>
             <span className="hidden md:flex items-center text-xs font-bold bg-rose-100 text-rose-700 px-3 py-1.5 rounded-full border border-rose-200 shadow-sm gap-1 ml-4 animate-in fade-in duration-500">
                <Sparkles className="w-3.5 h-3.5" /> IN PROVA (Mancano 7 Giorni)
             </span>
          </div>
          <div className="flex items-center space-x-2 md:space-x-6 shrink-0">
             <span className="md:hidden flex items-center text-[10px] font-bold bg-rose-100 text-rose-700 px-2.5 py-1.5 rounded-full border border-rose-200 shadow-sm gap-1 animate-in fade-in duration-500 w-max leading-tight text-center">
               7 GG PROVA
            </span>
            <Link 
              href={`/b/${orgSlug}`} 
              target="_blank"
              className="flex items-center justify-center gap-1 text-sm font-bold text-gray-700 bg-white w-auto h-10 px-2.5 md:w-auto md:h-auto md:px-5 md:py-2.5 rounded-xl border-2 border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all shadow-sm hover:shadow-md group shrink-0"
              title="Visualizza Sito Pubblico"
            >
              <Eye className="w-4 h-4 md:mr-2 text-gray-400 group-hover:text-rose-500 transition-colors shrink-0" />
              <span className="text-[10px] md:text-sm md:inline">Pubblico</span>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto min-h-0 w-full">
          <NotificationPrompt />
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation (App-like) */}
      <MobileNavbar orgSlug={orgSlug} />
    </div>
  );
}
