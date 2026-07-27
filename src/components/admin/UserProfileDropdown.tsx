"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { LogOut, Users, ChevronUp, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function UserProfileDropdown({ isCollapsed = false }: { isCollapsed?: boolean }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
        if (p) {
          setProfile(p);
          const { data: o } = await supabase.from('organizations').select('*').eq('id', p.organization_id).maybeSingle();
          if (o) setOrg(o);
        }
      } else {
        // Fallback for local demo if no logged-in user
        const { data: o } = await supabase.from('organizations').select('*').limit(1).single();
        if (o) setOrg(o);
        setProfile({ full_name: "Admin Demo", role: "org_admin" });
      }
      setLoading(false);
    }
    loadUser();
  }, []);

  const handleLogout = async () => {
    const toastId = toast.loading("Arrivederci...");
    await supabase.auth.signOut();
    toast.dismiss(toastId);
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="p-4 border-t border-gray-800 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }

  // Derive initial/plan details
  const name = profile?.full_name || user?.email || "Admin";
  const initial = name.charAt(0).toUpperCase();
  const planName = org?.plan || "Piano Premium"; // Fallback to premium during trial
  const avatarUrl = profile?.avatar_url;

  return (
    <div className="border-t border-gray-800 relative">
      {isOpen && (
        <div className="absolute bottom-full left-0 w-full p-2 z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
            <Link 
              href="/profile" 
              onClick={() => setIsOpen(false)}
              className="flex items-center px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
            >
              <Users className="w-4 h-4 mr-3 text-gray-400" />
              Il Mio Account
            </Link>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center px-4 py-3 text-sm text-rose-400 hover:bg-rose-950/30 transition-colors border-t border-gray-700/50"
            >
              <LogOut className="w-4 h-4 mr-3" />
              Cambia Profilo / Esci
            </button>
          </div>
        </div>
      )}

      {/* Trigger Button */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`m-2 flex items-center ${isCollapsed ? "justify-center px-0 py-3" : "px-4 py-3"} bg-gray-800/50 hover:bg-gray-800 rounded-xl cursor-pointer transition-colors group relative`}
      >
        <div 
          className="w-10 h-10 rounded-full bg-rose-600 flex items-center justify-center text-white font-extrabold text-sm shadow-md shrink-0 ring-2 ring-transparent group-hover:ring-rose-400/30 transition-all bg-cover bg-center"
          style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : {}}
          title={isCollapsed ? name : undefined}
        >
          {!avatarUrl && initial}
        </div>
        {!isCollapsed && (
          <>
            <div className="ml-3 overflow-hidden flex-1 whitespace-nowrap">
              <div className="text-sm font-bold text-white truncate">{name}</div>
              <div className="text-xs text-rose-400 truncate">{planName}</div>
            </div>
            <ChevronUp className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </>
        )}
      </div>
    </div>
  );
}
