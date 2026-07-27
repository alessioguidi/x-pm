"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

// Liste predefinite come su Airbnb
const AMENITIES_LIST = [
  "Wi-Fi", "TV", "Cucina", "Lavatrice", "Parcheggio gratuito",
  "Aria condizionata", "Spazio di lavoro dedicato", "Piscina", "Palestra", "Asciugacapelli", "Macchina del caffè"
];

const SAFETY_FEATURES_LIST = [
  "Rilevatore di fumo", "Rilevatore di monossido di carbonio", "Estintore", "Kit di pronto soccorso", 
  "Telecamere di sicurezza nella proprietà", "Serratura intelligente"
];

export default function PropertyAmenitiesEditor({ property }: { property: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Fallback defaults se null o non-array
  const initialAmenities = Array.isArray(property.amenities) ? property.amenities : [];
  const initialSafety = Array.isArray(property.safety_features) ? property.safety_features : [];

  const [amenities, setAmenities] = useState<string[]>(initialAmenities);
  const [safetyFeatures, setSafetyFeatures] = useState<string[]>(initialSafety);

  const toggleItem = (list: string[], setList: (v: string[]) => void, item: string) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("properties")
      .update({
         amenities: amenities,
         safety_features: safetyFeatures
      })
      .eq("id", property.id);

    if (error) {
      toast.error("Errore salvataggio!");
      console.error(error);
    } else {
      router.refresh();
      toast.success("Servizi salvati correttamente!");
    }
    setLoading(false);
  };

  return (
    <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm space-y-8 animate-in fade-in">
      
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Servizi offerti</h3>
        <p className="text-sm text-gray-500 mb-6">Seleziona cosa gli ospiti troveranno a loro disposizione.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {AMENITIES_LIST.map(amenity => {
            const isSelected = amenities.includes(amenity);
            return (
              <label key={amenity} className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-blue-50 transition-colors">
                <input 
                   type="checkbox" 
                   className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                   checked={isSelected}
                   onChange={() => toggleItem(amenities, setAmenities, amenity)}
                />
                <span className="text-gray-800 font-medium">{amenity}</span>
              </label>
            )
          })}
        </div>
      </div>

      <div className="border-t pt-8">
        <h3 className="text-xl font-bold text-gray-900 mb-2">Sicurezza</h3>
        <p className="text-sm text-gray-500 mb-6">Dispositivi e misure di sicurezza presenti nella struttura.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SAFETY_FEATURES_LIST.map(feature => {
            const isSelected = safetyFeatures.includes(feature);
            return (
              <label key={feature} className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-blue-50 transition-colors">
                <input 
                   type="checkbox" 
                   className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                   checked={isSelected}
                   onChange={() => toggleItem(safetyFeatures, setSafetyFeatures, feature)}
                />
                <span className="text-gray-800 font-medium">{feature}</span>
              </label>
            )
          })}
        </div>
      </div>

      <div className="pt-6 border-t flex justify-end">
        <button 
          onClick={handleSave} 
          disabled={loading}
          className="flex items-center bg-blue-600 text-white px-6 py-2.5 rounded-lg shadow hover:bg-blue-700 transition"
        >
          <Save className="w-5 h-5 mr-2" /> {loading ? "Salvataggio..." : "Salva Servizi"}
        </button>
      </div>

    </div>
  );
}
