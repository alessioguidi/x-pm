"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { UploadCloud, Loader2, Trash2, GripVertical, Image as ImageIcon } from "lucide-react";
import toast from "react-hot-toast";

interface PhotoUploaderProps {
  propertyId: string;
}

export default function PhotoUploader({ propertyId }: PhotoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch photos on mount
  useEffect(() => {
    fetchPhotos();
  }, [propertyId]);

  const fetchPhotos = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('property_photos')
      .select('*')
      .eq('property_id', propertyId)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });
    
    if (data) setPhotos(data);
    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      
      const files = Array.from(e.target.files);
      setUploading(true);

      const newUploadedPhotos = [];
      const currentHighestOrder = photos.length > 0 ? Math.max(...photos.map(p => p.display_order)) : -1;
      
      let baseOrder = currentHighestOrder + 1;

      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${propertyId}-${Math.random()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('property_images')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('property_images').getPublicUrl(fileName);
        
        newUploadedPhotos.push({
          property_id: propertyId,
          image_url: data.publicUrl,
          display_order: baseOrder++
        });
      }
      
      const { error: dbError } = await supabase.from('property_photos').insert(newUploadedPhotos);
      if (dbError) throw dbError;
      
      toast.success(`${files.length} foto caricate con successo!`);
      fetchPhotos();
      
    } catch (error) {
      console.error(error);
      toast.error("Errore durante il caricamento delle immagini.");
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleDelete = async (photoId: string) => {
    if (!confirm("Sicuro di voler eliminare questa foto?")) return;
    try {
      const { error } = await supabase.from('property_photos').delete().eq('id', photoId);
      if (error) throw error;
      toast.success("Foto eliminata.");
      setPhotos(photos.filter(p => p.id !== photoId));
    } catch (error) {
      toast.error("Errore nell'eliminazione della foto");
    }
  };

  const updateOrder = async (photoId: string, newOrder: number) => {
    try {
      await supabase.from('property_photos').update({ display_order: newOrder }).eq('id', photoId);
      toast.success("Posizione aggiornata!");
      fetchPhotos(); // reset state correctly
    } catch(e) {
      toast.error("Errore modifica ordine");
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-2 border-dashed border-blue-200 rounded-xl p-8 bg-blue-50/50 flex flex-col items-center justify-center text-center hover:bg-blue-50 hover:border-blue-300 transition-colors">
        <input 
          type="file" 
          multiple
          accept="image/*" 
          onChange={handleUpload} 
          disabled={uploading}
          className="hidden" 
          id={`photo-upload-${propertyId}`}
        />
        <label htmlFor={`photo-upload-${propertyId}`} className="cursor-pointer flex flex-col items-center w-full">
          {uploading ? (
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-3" />
          ) : (
            <div className="bg-white p-3 rounded-full shadow-sm mb-3 text-blue-500 border border-blue-100">
               <UploadCloud className="w-8 h-8" />
            </div>
          )}
          <span className="text-base font-bold text-blue-600 mb-1">
            {uploading ? "Caricamento in corso..." : "Clicca per caricare fino a 20 foto insieme"}
          </span>
          <span className="text-xs text-gray-500">Puoi selezionare file multipli contemporaneamente (JPG, PNG)</span>
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-gray-300"/></div>
      ) : photos.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mt-6">
          {photos.map((p, index) => (
            <div key={p.id} className="relative group bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              
              <div className="aspect-[4/3] bg-gray-100 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image_url} alt="Cover" className="w-full h-full object-cover" />
                {index === 0 && (
                  <div className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm">
                    COPERTINA
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleDelete(p.id)} className="bg-red-500 text-white p-1.5 rounded shadow hover:bg-red-600">
                    <Trash2 className="w-4 h-4"/>
                  </button>
                </div>
              </div>
              
              <div className="p-3 bg-gray-50 flex items-center justify-between border-t border-gray-100">
                <span className="text-xs font-semibold text-gray-600 flex items-center"><ImageIcon className="w-3 h-3 mr-1"/> Posizione:</span>
                <input 
                  type="number" 
                  min="0"
                  value={p.display_order} 
                  onChange={(e) => {
                    const newSorted = [...photos];
                    newSorted[index].display_order = Number(e.target.value);
                    setPhotos(newSorted);
                  }}
                  onBlur={(e) => updateOrder(p.id, Number(e.target.value))}
                  className="w-16 p-1 text-sm border rounded text-center focus:ring-blue-500"
                />
              </div>

            </div>
          ))}
        </div>
      ) : (
        <div className="text-center p-8 border border-dashed rounded-xl bg-gray-50 text-gray-400">
           Nessuna foto caricata per questa struttura.
        </div>
      )}
    </div>
  );
}
