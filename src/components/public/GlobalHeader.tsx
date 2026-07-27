"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Menu, User, LogOut, Settings, Heart, MessageCircle, Navigation, Map } from "lucide-react";

export function GlobalHeader() {
  const [user, setUser] = useState<any>(null);
  const [hasOrg, setHasOrg] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser(user);
        supabase.from('profiles').select('organization_id').eq('id', user.id).maybeSingle()
          .then(({ data }) => {
            if (data?.organization_id) setHasOrg(true);
          });
      }
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setHasOrg(false);
    setIsMenuOpen(false);
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        
        {/* LOGO */}
        <Link href="/" className="flex items-center space-x-2 text-rose-600">
          <Map className="w-8 h-8" />
          <span className="font-bold text-2xl hidden md:block tracking-tight text-gray-900 border-l border-gray-300 ml-3 pl-3">
            PMS Marketplace
          </span>
        </Link>

        {/* CONTROLLI A DESTRA */}
        <div className="flex items-center space-x-4">
          
          {/* Tasto Passa a Modalità Host (Visibile solo se sei org/manager) */}
          {user && hasOrg ? (
            <Link 
              href="/dashboard" 
              className="hidden md:flex items-center px-4 py-2 hover:bg-gray-100 rounded-full font-bold text-sm text-gray-800 transition"
            >
              Passa alla modalità host
            </Link>
          ) : (
            <Link 
              href="/login" 
              className="hidden md:flex items-center px-4 py-2 hover:bg-gray-100 rounded-full font-bold text-sm text-gray-800 transition"
            >
              Inizia a ospitare
            </Link>
          )}

          {/* User Menu Trigger */}
          <div className="relative">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center space-x-2 border border-gray-300 hover:shadow-md transition bg-white p-1.5 pl-3 rounded-full"
            >
              <Menu className="w-4 h-4 text-gray-600" />
              <div className="bg-gray-500 rounded-full w-8 h-8 flex items-center justify-center text-white overflow-hidden">
                {user ? <span className="font-bold text-sm">{user.email?.charAt(0).toUpperCase()}</span> : <User className="w-5 h-5 text-white" />}
              </div>
            </button>

            {/* Dropdown Opzioni */}
            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-[0_8px_28px_rgba(0,0,0,0.1)] py-2 border border-gray-100 font-medium z-50">
                {user ? (
                  <>
                    <Link href="#" className="flex items-center px-4 py-3 hover:bg-gray-50 text-gray-800 text-sm">
                      <Heart className="w-4 h-4 mr-3" /> Preferiti
                    </Link>
                    <Link href="#" className="flex items-center px-4 py-3 hover:bg-gray-50 text-gray-800 text-sm">
                      <Navigation className="w-4 h-4 mr-3" /> Viaggi
                    </Link>
                    <Link href="#" className="flex items-center px-4 py-3 hover:bg-gray-50 text-gray-800 text-sm border-b border-gray-200">
                      <MessageCircle className="w-4 h-4 mr-3" /> Messaggi
                    </Link>
                    
                    <Link href="#" className="flex items-center px-4 py-3 hover:bg-gray-50 text-gray-800 text-sm">
                      <User className="w-4 h-4 mr-3" /> Profilo
                    </Link>
                    <Link href="#" className="flex items-center px-4 py-3 hover:bg-gray-50 text-gray-800 text-sm">
                      <Settings className="w-4 h-4 mr-3" /> Impostazioni account
                    </Link>
                    
                    {!hasOrg && (
                       <Link href="/login" className="flex items-center px-4 py-3 hover:bg-gray-50 text-gray-800 text-sm border-t border-gray-200">
                         Inizia a ospitare
                       </Link>
                    )}

                    <div className="border-t border-gray-200 mt-1 pt-1">
                      <button onClick={handleLogout} className="flex items-center w-full text-left px-4 py-3 hover:bg-gray-50 text-gray-800 text-sm">
                         <LogOut className="w-4 h-4 mr-3" /> Esci
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <Link href="/login" className="block px-4 py-3 hover:bg-gray-50 text-gray-800 text-sm font-bold">
                      Accedi
                    </Link>
                    <Link href="/login" className="block px-4 py-3 hover:bg-gray-50 text-gray-800 text-sm border-b border-gray-200">
                      Registrati
                    </Link>
                    <Link href="/login" className="block px-4 py-3 hover:bg-gray-50 text-gray-800 text-sm">
                      Inizia a ospitare
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
