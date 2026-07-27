"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, CalendarDays, Inbox, Users, Settings, MessageCircle, Eye, Megaphone, Building, CheckSquare, Contact2, Wallet, LayoutGrid, X } from "lucide-react";

const mainNav = [
  { href: "/dashboard", icon: Home, label: "Home" },
  { href: "/calendar", icon: CalendarDays, label: "Cal" },
  { href: "/bookings", icon: Inbox, label: "Booking" },
  { href: "/tasks", icon: CheckSquare, label: "Agenda" },
  { href: "/messages", icon: MessageCircle, label: "Msg" },
];

const moreItems = [
  { href: "/marketing/campaigns", icon: Megaphone, label: "Marketing" },
  { href: "/properties", icon: Building, label: "Immobili" },
  { href: "/contacts", icon: Contact2, label: "Contatti" },
  { href: "/cassa", icon: Wallet, label: "Cassa" },
  { href: "/staff", icon: Users, label: "Staff" },
  { href: "/settings", icon: Settings, label: "Impostazioni" },
];

export default function MobileNavbar({ orgSlug }: { orgSlug?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [showMore, setShowMore] = useState(false);

  const handleNav = (href: string) => {
    setShowMore(false);
    router.push(href);
  };

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 flex items-center justify-around z-50 h-[68px] px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
        {mainNav.map((item) => {
          const isActive = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center p-2 transition-colors relative w-16 ${isActive ? 'text-rose-600' : 'text-gray-500 hover:text-rose-600'}`}
            >
              {isActive && <div className="absolute inset-0 bg-rose-50/50 rounded-xl -z-10" />}
              <item.icon className={`w-6 h-6 mb-1 ${isActive ? 'stroke-[2.5px] scale-110' : ''} transition-transform`} />
              <span className="text-[10px] font-bold tracking-tight">{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setShowMore(true)}
          className="flex flex-col items-center justify-center p-2 transition-colors relative w-16 text-gray-500 hover:text-rose-600"
          title="Altre voci"
        >
          <LayoutGrid className="w-6 h-6 mb-1 transition-transform" />
          <span className="text-[10px] font-bold tracking-tight">Menu</span>
        </button>
      </nav>

      {showMore && (
        <div className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl max-h-[80vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 sticky top-0 z-10">
              <h3 className="text-lg font-bold text-gray-900">Tutte le voci</h3>
              <button onClick={() => setShowMore(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-3 gap-4">
              {[...mainNav, ...moreItems].map((item) => {
                const isActive = pathname?.startsWith(item.href);
                return (
                  <button
                    key={item.href}
                    onClick={() => handleNav(item.href)}
                    className={`flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl transition ${isActive ? 'bg-rose-50 text-rose-700' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
                  >
                    <item.icon className="w-6 h-6" />
                    <span className="text-[10px] font-bold text-center leading-tight">{item.label}</span>
                  </button>
                );
              })}
              {orgSlug && (
                <Link
                  href={`/b/${orgSlug}`}
                  target="_blank"
                  onClick={() => setShowMore(false)}
                  className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl bg-gray-50 text-gray-700 hover:bg-gray-100 transition"
                >
                  <Eye className="w-6 h-6" />
                  <span className="text-[10px] font-bold text-center leading-tight">Sito Pubblico</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
