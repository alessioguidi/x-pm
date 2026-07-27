"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BoxSelect, Home, Settings, CalendarDays, CheckSquare, Users, Inbox, ChevronLeft, ChevronRight, Building, Wallet, Contact2, MessageCircle, Megaphone } from "lucide-react";
import UserProfileDropdown from "@/components/admin/UserProfileDropdown";

export default function AdminSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  const menuItems = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/calendar", label: "Calendario", icon: CalendarDays },
    { href: "/bookings", label: "Prenotazioni", icon: Inbox },
    { href: "/marketing/campaigns", label: "Marketing", icon: Megaphone },
    { href: "/messages", label: "Messaggi", icon: MessageCircle },
    { href: "/properties", label: "Immobili", icon: Building },
    { href: "/tasks", label: "Agenda", icon: CheckSquare },
    { href: "/contacts", label: "Contatti", icon: Contact2 },
    { href: "/cassa", label: "Cassa", icon: Wallet },
    { href: "/staff", label: "Staff", icon: Users },
  ];

  return (
    <aside className={`hidden md:flex ${isCollapsed ? "w-20" : "w-64"} bg-gray-900 border-r border-gray-800 flex-col text-gray-300 shrink-0 transition-all duration-300 relative z-20`}>
      {/* Toggle Button */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-8 w-6 h-6 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 z-50 transition-colors shadow-sm cursor-pointer"
        title={isCollapsed ? "Espandi Sidebar" : "Collassa Sidebar"}
      >
        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      <div className={`h-20 flex items-center ${isCollapsed ? "justify-center px-0" : "px-6"} border-b border-gray-800 transition-all`}>
        <div className={`rounded-lg bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center shrink-0 shadow-lg shadow-rose-900/50 ${isCollapsed ? "w-10 h-10" : "w-8 h-8 mr-3"}`}>
          <BoxSelect className="text-white w-5 h-5" />
        </div>
        {!isCollapsed && <span className="font-extrabold text-2xl tracking-tight text-white line-clamp-1">X-<span className="text-rose-500">PM</span></span>}
      </div>

      <nav className={`flex-1 ${isCollapsed ? "p-3" : "p-4"} space-y-1.5 overflow-y-auto overflow-x-hidden hide-scrollbar`}>
        {!isCollapsed && <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 px-4 mt-4 whitespace-nowrap">Menu Principale</div>}
        
        {menuItems.map(item => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} title={isCollapsed ? item.label : undefined} className={`flex items-center ${isCollapsed ? "justify-center px-0 py-3.5" : "px-4 py-2.5"} ${active ? "bg-gray-800 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"} rounded-xl transition-all group`}>
              <item.icon className="w-5 h-5 shrink-0 text-gray-500 group-hover:text-rose-400 transition-colors" />
              {!isCollapsed && <span className="font-medium ml-3 whitespace-nowrap">{item.label}</span>}
            </Link>
          );
        })}

        {!isCollapsed ? (
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 px-4 mt-8 whitespace-nowrap">Amministrazione</div>
        ) : <div className="mt-8 mb-4 border-t border-gray-800 mx-2" />}
        
        <Link href="/settings" title={isCollapsed ? "Impostazioni" : undefined} className={`flex items-center ${isCollapsed ? "justify-center px-0 py-3.5 mt-4" : "px-4 py-2.5"} text-gray-300 hover:bg-gray-800 hover:text-white rounded-xl transition-all group`}>
          <Settings className="w-5 h-5 shrink-0 text-gray-500 group-hover:text-rose-400 transition-colors" />
          {!isCollapsed && <span className="font-medium ml-3 whitespace-nowrap">Impostazioni</span>}
        </Link>
      </nav>
      
      <UserProfileDropdown isCollapsed={isCollapsed} />
    </aside>
  );
}
