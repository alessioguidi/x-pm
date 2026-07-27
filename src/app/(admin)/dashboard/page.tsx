"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { Loader2, LayoutGrid, Settings2, GripHorizontal, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Importeremo i widget qui
import FinanceWidget from "@/components/dashboard/FinanceWidget";
import ActivitiesWidget from "@/components/dashboard/ActivitiesWidget";
import UpcomingArrivalsWidget from "@/components/dashboard/UpcomingArrivalsWidget";
import CollaborationWidget from "@/components/dashboard/CollaborationWidget";
import PerformanceWidget from "@/components/dashboard/PerformanceWidget";

const DEFAULT_LAYOUT = [
  { id: 'finance', component: FinanceWidget, visible: true, size: 'col-span-12' },
  { id: 'activities', component: ActivitiesWidget, visible: true, size: 'col-span-12' },
  { id: 'upcoming_arrivals', component: UpcomingArrivalsWidget, visible: true, size: 'col-span-12 md:col-span-6' },
  { id: 'collaboration', component: CollaborationWidget, visible: true, size: 'col-span-12 md:col-span-6' },
  { id: 'performance', component: PerformanceWidget, visible: true, size: 'col-span-12' },
];

function SortableWidget({ id, widgetEntry, isEditing, toggleVisibility, changeSize }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
  };

  const Component = widgetEntry.component;

  if (!widgetEntry.visible && !isEditing) return null;

  return (
    <div
       ref={setNodeRef}
       style={style}
       className={`${widgetEntry.size} relative bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col overflow-hidden transition-all duration-200 ${isEditing ? 'ring-2 ring-blue-500/50 scale-[0.98]' : ''} ${!widgetEntry.visible ? 'opacity-50 grayscale' : ''}`}
    >
      {isEditing && (
        <div className="absolute inset-0 z-20 bg-gray-900/5 backdrop-blur-[1px] flex flex-col">
           <div className="p-3 bg-white/90 border-b flex justify-between items-center shadow-sm">
              <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-gray-100 rounded text-gray-500 flex items-center gap-2">
                 <GripHorizontal className="w-5 h-5"/>
                 <span className="text-xs font-bold uppercase tracking-wider">{id.replace('_', ' ')}</span>
              </div>
              <div className="flex gap-2">
                 <select 
                   value={widgetEntry.size} 
                   onChange={(e) => changeSize(id, e.target.value)}
                   className="text-xs border rounded p-1"
                 >
                    <option value="col-span-12 md:col-span-6">1/2 Larghezza</option>
                    <option value="col-span-12">Intera</option>
                 </select>
                 <button onClick={() => toggleVisibility(id)} className="p-1.5 hover:bg-gray-100 rounded text-gray-600">
                    {widgetEntry.visible ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4 text-red-500"/>}
                 </button>
              </div>
           </div>
        </div>
      )}
      <div className="flex-1 overflow-auto pointer-events-auto">
        <Component />
      </div>
    </div>
  );
}


export default function DashboardPage() {
  const [layout, setLayout] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [orgId, setOrgId] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    loadLayout();
  }, []);

  const loadLayout = async () => {
    setLoading(true);
    let currentOrgId = "";
    const { data: { user } } = await supabase.auth.getUser();
    if(user) {
        // Attempt to fetch custom layout if column exists, else fallback to localStorage
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
        if(profile) {
            currentOrgId = profile.organization_id;
            if (profile.dashboard_layout && Array.isArray(profile.dashboard_layout)) {
               syncLayoutWithDefaults(profile.dashboard_layout);
            } else {
               const local = localStorage.getItem('enumera_dashboard_layout');
               if (local) syncLayoutWithDefaults(JSON.parse(local));
               else syncLayoutWithDefaults(DEFAULT_LAYOUT);
            }
        }
    }
    
    setOrgId(currentOrgId);
    setLoading(false);
  };

  const syncLayoutWithDefaults = (savedLayout: any[]) => {
      // Merge saved preferences with actual components (since components cannot be JSON serialized)
      const merged = savedLayout.map(saved => {
          const defaultRef = DEFAULT_LAYOUT.find(d => d.id === saved.id);
          if (defaultRef) return { ...defaultRef, ...saved, component: defaultRef.component };
          return null;
      }).filter(Boolean);

      // Add missing new widgets that were added after user saved layout
      DEFAULT_LAYOUT.forEach(def => {
          if (!merged.find(m => m.id === def.id)) {
             merged.push(def);
          }
      });
      setLayout(merged);
  }

  const saveLayout = async (newLayout: any[]) => {
    setLayout(newLayout);
    const simplified = newLayout.map(l => ({ id: l.id, visible: l.visible, size: l.size }));
    localStorage.setItem('enumera_dashboard_layout', JSON.stringify(simplified));
    
    // Attempt to save to DB (silently fail if column doesn't exist yet)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        try { await supabase.from('profiles').update({ dashboard_layout: simplified }).eq('id', user.id); } catch {};
    }
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
        const oldIndex = layout.findIndex((item) => item.id === active.id);
        const newIndex = layout.findIndex((item) => item.id === over.id);
        const newLayout = arrayMove(layout, oldIndex, newIndex);
        saveLayout(newLayout);
    }
  };

  const toggleVisibility = (id: string) => {
      const newLayout = layout.map(l => l.id === id ? { ...l, visible: !l.visible } : l);
      saveLayout(newLayout);
  };
  
  const changeSize = (id: string, newSize: string) => {
      const newLayout = layout.map(l => l.id === id ? { ...l, size: newSize } : l);
      saveLayout(newLayout);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600"/></div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div>
           <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
             <LayoutGrid className="w-8 h-8 text-blue-600" />
             Dashboard CRM
           </h1>
           <p className="text-gray-500 mt-1">Panoramica completa in tempo reale sulle performance e attività.</p>
        </div>
        
        <button 
           onClick={() => setIsEditing(!isEditing)}
           className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all shadow-sm ${isEditing ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
           <Settings2 className="w-5 h-5" />
           {isEditing ? 'Fine Modifica Layout' : 'Gestisci Layout Wiidget'}
        </button>
      </div>

      {isEditing && (
         <div className="bg-blue-50 text-blue-700 px-5 py-3 rounded-xl border border-blue-100 text-sm font-medium flex items-center justify-between">
            <span>Trascina i widget dalla barra superiore per riordinarli. Cambia dimensione o nascondili. Salvo in automatico.</span>
         </div>
      )}

      {/* WIDGETS GRID */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-12 gap-6 pb-20">
            <SortableContext items={layout.map(l => l.id)} strategy={rectSortingStrategy}>
              {layout.map(widget => (
                  <SortableWidget 
                     key={widget.id} 
                     id={widget.id} 
                     widgetEntry={widget} 
                     isEditing={isEditing} 
                     toggleVisibility={toggleVisibility}
                     changeSize={changeSize}
                  />
              ))}
            </SortableContext>
        </div>
      </DndContext>

    </div>
  );
}
