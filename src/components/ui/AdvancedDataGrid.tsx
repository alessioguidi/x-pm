"use client";

import React, { useState, useMemo } from 'react';
import { Search, Filter, Plus, Trash2, X, ChevronDown } from 'lucide-react';

export type ColumnDef<T = any> = {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
};

export type FilterableColumn = {
  key: string;
  label: string;
  type?: 'string' | 'number' | 'date'; // added 'date'
};

export type BulkAction = {
  label: string;
  onClick: (selectedIds: string[]) => void;
  variant?: 'danger' | 'default';
};

interface AdvancedDataGridProps {
  data: any[];
  columns: ColumnDef[];
  filterableColumns?: FilterableColumn[];
  title?: string;
  onAddClick?: () => void;
  addButtonLabel?: string;
  bulkActions?: BulkAction[];
  onRowClick?: (row: any) => void;
  loading?: boolean;
  renderFooter?: (filteredData: any[]) => React.ReactNode;
}

export function AdvancedDataGrid({
  data,
  columns,
  filterableColumns = [],
  title,
  onAddClick,
  addButtonLabel = 'Nuovo',
  bulkActions = [],
  onRowClick,
  loading = false,
  renderFooter,
}: AdvancedDataGridProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Array of applied filters: { column, operator, value, value2 }
  const [filters, setFilters] = useState<{ id: string; column: string; operator: string; value: string; value2?: string }[]>([]);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // New filter form state
  const [newFilter, setNewFilter] = useState({ column: filterableColumns[0]?.key || '', operator: filterableColumns[0]?.type === 'date' ? 'between' : 'contains', value: '', value2: '' });

  // Add a filter rule
  const addFilterRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFilter.column) return;
    
    if (newFilter.operator === 'between' && !newFilter.value && !newFilter.value2) return;
    if (newFilter.operator !== 'between' && !newFilter.value.trim()) return;
    
    setFilters([...filters, { 
      id: Math.random().toString(36).substr(2, 9),
      ...newFilter
    }]);
    setNewFilter({ ...newFilter, value: '', value2: '' });
  };

  // Remove a filter rule
  const removeFilter = (id: string) => {
    setFilters(filters.filter(f => f.id !== id));
  };

  // Helper to extract nested properties via "dot.notation" (e.g. "properties.name")
  const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  };

  // Filter application (Client-side AND logic)
  const filteredData = useMemo(() => {
    return data.filter(item => {
      // Must pass ALL filters
      return filters.every(f => {
        const itemVal = getNestedValue(item, f.column);
        if (itemVal === undefined || itemVal === null) return false;
        
        // Handle dates
        if (f.operator === 'between') {
          const itemDate = new Date(itemVal).getTime();
          if (isNaN(itemDate)) return false;
          const min = f.value ? new Date(f.value).getTime() : -Infinity;
          const max = f.value2 ? new Date(f.value2).setHours(23,59,59,999) : Infinity;
          return itemDate >= min && itemDate <= max;
        }

        if (f.operator === 'gte' || f.operator === 'lte') {
          const itemDate = new Date(itemVal).getTime();
          const searchDate = new Date(f.value).getTime();
          if (isNaN(itemDate) || isNaN(searchDate)) return false;
          return f.operator === 'gte' ? itemDate >= searchDate : itemDate <= searchDate;
        }

        const stringVal = String(itemVal).toLowerCase();
        const searchVal = f.value.toLowerCase();

        switch (f.operator) {
          case 'contains': return stringVal.includes(searchVal);
          case 'equals': return stringVal === searchVal;
          case 'startsWith': return stringVal.startsWith(searchVal);
          default: return true;
        }
      });
    });
  }, [data, filters]);

  // Selection
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedIds(filteredData.map(d => d.id));
    else setSelectedIds([]);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-4">
      {/* HEADER & TOOLBAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-4">
           {title && <h2 className="text-xl font-bold text-gray-800">{title}</h2>}
           
           {filterableColumns.length > 0 && (
             <button 
               onClick={() => setShowFilterPanel(!showFilterPanel)}
               className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold border transition ${showFilterPanel || filters.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
             >
               <Filter className="w-4 h-4" />
               Filtri Avanzati {filters.length > 0 && `(${filters.length})`}
             </button>
           )}
        </div>

        <div>
           {onAddClick && (
             <button onClick={onAddClick} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center shadow-sm transition">
                <Plus className="w-4 h-4 mr-2" />
                {addButtonLabel}
             </button>
           )}
        </div>
      </div>

      {/* FILTER BUILDER PANEL */}
      {showFilterPanel && filterableColumns.length > 0 && (
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm animate-in fade-in slide-in-from-top-2">
           
           {/* Active Rules */}
           {filters.length > 0 && (
             <div className="mb-4 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Regole Attive (AND)</div>
                {filters.map(f => (
                   <div key={f.id} className="inline-flex items-center bg-blue-50 border border-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium mr-2">
                      <span className="opacity-70 mr-1">{filterableColumns.find(c => c.key === f.column)?.label || f.column}</span>
                      <span className="font-bold mx-1">{f.operator === 'between' ? 'tra' : f.operator === 'equals' ? '=' : f.operator === 'startsWith' ? 'inizia con' : f.operator === 'gte' ? '>=' : f.operator === 'lte' ? '<=' : 'contiene'}</span>
                      <span className="italic mr-2">"{f.operator === 'between' ? `${f.value || 'sempre'} e ${f.value2 || 'sempre'}` : f.value}"</span>
                      <button onClick={() => removeFilter(f.id)} className="hover:bg-blue-200 rounded-full p-0.5"><X className="w-3 h-3" /></button>
                   </div>
                ))}
             </div>
           )}

           <form onSubmit={addFilterRule} className="flex flex-col sm:flex-row gap-3 items-end border-t pt-4">
              <div className="flex-1 w-full">
                 <label className="block text-xs font-bold text-gray-600 mb-1">Colonna</label>
                 <select value={newFilter.column} onChange={e => {
                    const colType = filterableColumns.find(c => c.key === e.target.value)?.type;
                    setNewFilter({...newFilter, column: e.target.value, operator: colType === 'date' ? 'between' : 'contains', value: '', value2: ''});
                 }} className="w-full border-gray-300 rounded-lg text-sm p-2 bg-gray-50">
                    {filterableColumns.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                 </select>
              </div>
              <div className="w-full sm:w-48">
                 <label className="block text-xs font-bold text-gray-600 mb-1">Operatore</label>
                 <select value={newFilter.operator} onChange={e => setNewFilter({...newFilter, operator: e.target.value})} className="w-full border-gray-300 rounded-lg text-sm p-2 bg-gray-50">
                    {filterableColumns.find(c => c.key === newFilter.column)?.type === 'date' ? (
                       <>
                         <option value="between">Tra le date</option>
                       </>
                    ) : (
                       <>
                         <option value="contains">Contiene</option>
                         <option value="equals">È uguale a</option>
                         <option value="startsWith">Inizia con</option>
                       </>
                    )}
                 </select>
              </div>
              <div className="flex-1 w-full">
                 <label className="block text-xs font-bold text-gray-600 mb-1">Valore</label>
                 {filterableColumns.find(c => c.key === newFilter.column)?.type === 'date' ? (
                     <div className="flex w-full gap-2">
                        <input type="date" value={newFilter.value} onChange={e => setNewFilter({...newFilter, value: e.target.value})} className="w-1/2 border-gray-300 rounded-lg text-sm p-2" />
                        <input type="date" value={newFilter.value2 || ''} onChange={e => setNewFilter({...newFilter, value2: e.target.value})} className="w-1/2 border-gray-300 rounded-lg text-sm p-2" />
                     </div>
                 ) : (
                     <input 
                        type="text" 
                        value={newFilter.value} 
                        onChange={e => setNewFilter({...newFilter, value: e.target.value})} 
                        className="w-full border-gray-300 rounded-lg text-sm p-2" 
                        placeholder="Digita valore..." 
                     />
                 )}
              </div>
              <div className="w-full sm:w-auto">
                 <button type="submit" disabled={newFilter.operator === 'between' ? (!newFilter.value && !newFilter.value2) : !newFilter.value.trim()} className="w-full bg-gray-900 disabled:bg-gray-400 hover:bg-gray-800 text-white font-bold py-2 px-4 rounded-lg text-sm transition">
                    + Aggiungi Regola
                 </button>
              </div>
           </form>
        </div>
      )}

      {/* BULK ACTIONS BAR */}
      {selectedIds.length > 0 && bulkActions.length > 0 && (
         <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between shadow-sm animate-in fade-in zoom-in-95">
            <div className="text-sm font-bold text-blue-800 flex items-center">
               <span className="bg-white text-blue-600 rounded-full w-6 h-6 inline-flex items-center justify-center mr-2 shadow-sm">{selectedIds.length}</span>
               selezionati
            </div>
            <div className="flex gap-2">
               {bulkActions.map((action, idx) => (
                  <button 
                     key={idx} 
                     onClick={() => action.onClick(selectedIds)}
                     className={`px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm transition border ${action.variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-700 border-red-700' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'}`}
                  >
                     {action.label}
                  </button>
               ))}
            </div>
         </div>
      )}

      {/* DATAGRID / TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative min-h-[200px]">
         {loading ? (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
         ) : filteredData.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
               Nessun record trovato.
            </div>
         ) : (
            <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                  <thead>
                     <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-bold">
                        <th className="p-4 w-12 text-center border-r border-gray-100">
                           <input 
                              type="checkbox" 
                              className="rounded border-gray-300 w-4 h-4 text-blue-600 focus:ring-blue-500"
                              checked={filteredData.length > 0 && selectedIds.length === filteredData.length}
                              onChange={handleSelectAll}
                           />
                        </th>
                        {columns.map((col, idx) => (
                           <th key={col.key || idx} className={`p-4 ${col.width || ''}`} style={{ textAlign: col.align || 'left' }}>
                              {col.label}
                           </th>
                        ))}
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                     {filteredData.map((row) => (
                        <tr 
                           key={row.id} 
                           onClick={() => onRowClick && onRowClick(row)}
                           className={`hover:bg-gray-50 transition-colors group ${onRowClick ? 'cursor-pointer' : ''} ${selectedIds.includes(row.id) ? 'bg-blue-50/30' : ''}`}
                        >
                           <td className="p-4 text-center border-r border-gray-100 align-middle" onClick={(e) => e.stopPropagation()}>
                              <input 
                                 type="checkbox" 
                                 checked={selectedIds.includes(row.id)}
                                 onChange={() => toggleSelect(row.id)}
                                 className="rounded border-gray-300 w-4 h-4 text-blue-600 focus:ring-blue-500"
                              />
                           </td>
                           {columns.map((col, idx) => (
                              <td key={col.key || idx} className="p-4 align-middle" style={{ textAlign: col.align || 'left' }}>
                                 {col.render ? col.render(row) : getNestedValue(row, col.key)}
                              </td>
                           ))}
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         )}
         {renderFooter && filteredData.length > 0 && !loading && (
            <div className="bg-gray-50 border-t border-gray-200 p-4">
               {renderFooter(filteredData)}
            </div>
         )}
      </div>
    </div>
  );
}
