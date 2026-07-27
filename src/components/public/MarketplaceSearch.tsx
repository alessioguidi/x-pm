"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

export default function MarketplaceSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [destination, setDestination] = useState(searchParams.get("destination") || "");
  const [dates, setDates] = useState("");
  const [guests, setGuests] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (destination) params.set("destination", destination);
    if (dates) params.set("dates", dates); // Stub per implementazioni future
    if (guests) params.set("guests", guests);
    
    router.push(`/?${params.toString()}`);
  };

  return (
    <div className="w-full max-w-4xl mx-auto -mt-8 relative z-10 hidden md:block">
      <form 
        onSubmit={handleSearch}
        className="bg-white rounded-full shadow-[0_8px_28px_rgba(0,0,0,0.08)] border border-gray-200 flex items-center p-2 divide-x divide-gray-200"
      >
        
        {/* Destinazione */}
        <div className="flex-1 px-6 py-2 hover:bg-gray-100/50 rounded-l-full cursor-text transition group relative">
          <label className="block text-[11px] font-extrabold text-gray-800 uppercase tracking-widest mb-0.5">
            Dove
          </label>
          <input 
            type="text" 
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Cerca destinazioni"
            className="w-full bg-transparent text-sm font-medium text-gray-900 focus:outline-none placeholder-gray-500 truncate"
          />
        </div>

        {/* Date */}
        <div className="flex-1 px-6 py-2 hover:bg-gray-100/50 cursor-text transition group relative">
          <label className="block text-[11px] font-extrabold text-gray-800 uppercase tracking-widest mb-0.5">
            Check in - Check out
          </label>
          <input 
            type="text" 
            value={dates}
            onChange={(e) => setDates(e.target.value)}
            placeholder="Aggiungi date"
            className="w-full bg-transparent text-sm font-medium text-gray-900 focus:outline-none placeholder-gray-500 truncate"
          />
        </div>

        {/* Ospiti */}
        <div className="flex-1 px-6 py-2 hover:bg-gray-100/50 rounded-r-full cursor-text transition group relative flex justify-between items-center">
          <div className="w-full pr-4">
            <label className="block text-[11px] font-extrabold text-gray-800 uppercase tracking-widest mb-0.5">
              Chi
            </label>
            <input 
              type="text" 
              value={guests}
              onChange={(e) => setGuests(e.target.value)}
              placeholder="Aggiungi ospiti"
              className="w-full bg-transparent text-sm font-medium text-gray-900 focus:outline-none placeholder-gray-500 truncate"
            />
          </div>
          
          <button 
            type="submit" 
            className="bg-rose-600 hover:bg-rose-700 text-white rounded-full p-3.5 shadow-md transition flex items-center justify-center shrink-0"
          >
            <Search className="w-5 h-5 stroke-[2.5px]" />
          </button>
        </div>

      </form>
    </div>
  );
}
