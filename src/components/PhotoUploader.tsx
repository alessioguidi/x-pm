"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { UploadCloud, Loader2, Trash2, GripVertical, Image as ImageIcon, Video } from "lucide-react";
import toast from "react-hot-toast";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface PhotoUploaderProps {
  propertyId: string;
}

function SortablePhoto({ photo, index, onDelete }: { photo: any; index: number; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  const isVideo = photo.media_type === 'video';

  return (
    <div ref={setNodeRef} style={style} className="relative group bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="aspect-[4/3] bg-gray-100 relative">
        {isVideo ? (
          <video src={photo.image_url} className="w-full h-full object-cover" muted playsInline />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.image_url} alt="Cover" className="w-full h-full object-cover" />
        )}
        {index === 0 && (
          <div className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm">
            COPERTINA
          </div>
        )}
        {isVideo && (
          <div className="absolute top-2 right-10 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1">
            <Video className="w-3 h-3" /> VIDEO
          </div>
        )}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onDelete(photo.id)} className="bg-red-500 text-white p-1.5 rounded shadow hover:bg-red-600">
            <Trash2 className="w-4 h-4"/>
          </button>
        </div>
      </div>
      <div className="p-3 bg-gray-50 flex items-center justify-between border-t border-gray-100">
        <button {...attributes} {...listeners} className="text-gray-400 hover:text-gray-700 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-gray-200 transition">
          <GripVertical className="w-5 h-5" />
        </button>
        <span className="text-xs font-semibold text-gray-600 flex items-center">{isVideo ? <Video className="w-3 h-3 mr-1"/> : <ImageIcon className="w-3 h-3 mr-1"/>} {index + 1}</span>
      </div>
    </div>
  );
}

export default function PhotoUploader({ propertyId }: PhotoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

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
        const isVideo = file.type.startsWith('video/');

        const { error: uploadError } = await supabase.storage
          .from('property_images')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('property_images').getPublicUrl(fileName);
        
        newUploadedPhotos.push({
          property_id: propertyId,
          image_url: data.publicUrl,
          display_order: baseOrder++,
          media_type: isVideo ? 'video' : 'image'
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = photos.findIndex(p => p.id === active.id);
    const newIndex = photos.findIndex(p => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...photos];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    // Update display_order based on new position
    const updated = reordered.map((p, i) => ({ ...p, display_order: i }));
    setPhotos(updated);

    // Persist to DB
    try {
      for (const p of updated) {
        await supabase.from('property_photos').update({ display_order: p.display_order }).eq('id', p.id);
      }
      toast.success("Ordine aggiornato!");
    } catch {
      toast.error("Errore salvataggio ordine");
      fetchPhotos();
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-2 border-dashed border-blue-200 rounded-xl p-8 bg-blue-50/50 flex flex-col items-center justify-center text-center hover:bg-blue-50 hover:border-blue-300 transition-colors">
        <input 
          type="file" 
          multiple
          accept="image/*,video/*" 
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
          <span className="text-xs text-gray-500">Puoi selezionare file multipli (JPG, PNG, MP4, MOV)</span>
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-gray-300"/></div>
      ) : photos.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={photos.map(p => p.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mt-6">
              {photos.map((p, index) => (
                <SortablePhoto key={p.id} photo={p} index={index} onDelete={handleDelete} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="text-center p-8 border border-dashed rounded-xl bg-gray-50 text-gray-400">
           Nessuna foto caricata per questa struttura.
        </div>
      )}
    </div>
  );
}
