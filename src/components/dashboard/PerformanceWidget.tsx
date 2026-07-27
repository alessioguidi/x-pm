"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { TrendingUp, FileText } from "lucide-react";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/format";

export default function PerformanceWidget() {
  const [chartData, setChartData] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPerformanceData();
  }, [selectedProperty]);

  const fetchPerformanceData = async () => {
    setLoading(true);

    const today = new Date();
    const currentYearStr = today.getFullYear().toString();
    const prevYearStr = (today.getFullYear() - 1).toString();

    // Fetch Properties for dropdown
    if (properties.length === 0) {
        const { data: propsData } = await supabase.from('properties').select('id, name').order('name');
        if (propsData) setProperties(propsData);
    }

    // Prepare filter arrays
    let propertyIdsToFilter: string[] = [];
    if (selectedProperty === 'all' && properties.length > 0) {
       propertyIdsToFilter = properties.map(p => p.id);
    } else if (selectedProperty !== 'all') {
       propertyIdsToFilter = [selectedProperty];
    } else {
       // if properties are loaded for the first time
       const { data: fallbackProps } = await supabase.from('properties').select('id');
       propertyIdsToFilter = (fallbackProps || []).map(p => p.id);
    }

    // Fetch Bookings (Income)
    const { data: bookings } = await supabase.from('bookings').select('check_in_date, total_price, property_id')
       .in('status', ['confirmed', 'deposit_paid', 'completed'])
       .in('property_id', propertyIdsToFilter)
       .gte('check_in_date', `${prevYearStr}-01-01`);

    // Fetch Cash Transactions (Expenses & Extra Income)
    const { data: cashTxs } = await supabase.from('cash_transactions').select('created_at, amount, transaction_type, property_id')
       .eq('status', 'confirmed')
       .in('property_id', propertyIdsToFilter)
       .gte('created_at', `${prevYearStr}-01-01`);
    
    // Aggregation by Month (1 to 12)
    const monthlyAggregate: Record<number, { current: number, prev: number }> = {};
    for (let i = 1; i <= 12; i++) monthlyAggregate[i] = { current: 0, prev: 0 };

    // Process Bookings
    bookings?.forEach(b => {
        const d = new Date(b.check_in_date);
        const year = d.getFullYear().toString();
        const month = d.getMonth() + 1;
        const val = b.total_price || 0;
        if (monthlyAggregate[month]) {
           if (year === currentYearStr) monthlyAggregate[month].current += val;
           else if (year === prevYearStr) monthlyAggregate[month].prev += val;
        }
    });

    // Process Ledger Transactions (excluding manager handovers, these are neutral transfers)
    cashTxs?.forEach(tx => {
        if (tx.transaction_type === 'manager_handover') return;
        const d = new Date(tx.created_at);
        const year = d.getFullYear().toString();
        const month = d.getMonth() + 1;
        const val = tx.amount || 0; // Negative amounts reduce profit naturally, positive add to profit
        if (monthlyAggregate[month]) {
           if (year === currentYearStr) monthlyAggregate[month].current += val;
           else if (year === prevYearStr) monthlyAggregate[month].prev += val;
        }
    });

    const monthNames = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
    const finalData = monthNames.map((m, index) => ({
        name: m,
        "Anno Corrente": Math.round(monthlyAggregate[index + 1].current),
        "Anno Preced.": Math.round(monthlyAggregate[index + 1].prev),
    }));

    setChartData(finalData);
    setLoading(false);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-100 shadow-xl rounded-xl text-sm">
          <p className="font-bold text-gray-900 mb-2 border-b pb-1">{label}</p>
          {payload.map((p: any, i: number) => (
             <div key={i} className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></div>
                <span className="text-gray-600">{p.name}:</span>
                <span className="font-bold">{formatCurrency(p.value)}</span>
             </div>
          ))}
          {/* Delta computation */}
          {payload.length === 2 && (
             <div className="mt-2 pt-2 border-t border-dashed flex justify-between font-bold text-[10px] uppercase">
                <span className="text-gray-500">Variazione</span>
                {payload[1].value > 0 ? (
                    <span className={payload[0].value >= payload[1].value ? 'text-emerald-500' : 'text-red-500'}>
                       {formatPercent((((payload[0].value - payload[1].value) / payload[1].value) * 100))}
                    </span>
                ) : (
                    <span>~</span>
                )}
             </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
      <div className="p-5 h-full flex flex-col">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
             <div>
                 <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" /> Rendiconto Economico Mensile
                 </h3>
                 <p className="text-xs text-gray-400 font-medium">Utile pre-imposte: Incassi - Costi Contabili</p>
             </div>
             <select 
                value={selectedProperty} 
                onChange={(e) => setSelectedProperty(e.target.value)}
                className="text-sm p-2 border border-gray-200 rounded-lg shadow-sm font-medium focus:ring-2 focus:ring-blue-500 max-w-[200px]"
             >
                <option value="all">Tutte le Strutture</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
             </select>
         </div>

         {loading ? (
             <div className="flex-1 flex justify-center items-center"><div className="w-8 h-8 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div></div>
         ) : (
             <div className="flex-1 min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={chartData}
                        margin={{ top: 20, right: 10, left: -20, bottom: 5 }}
                        barGap={2}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} tickFormatter={(val) => `€${val}`} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                        <ReferenceLine y={0} stroke="#000" />
                        <Bar dataKey="Anno Corrente" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        <Bar dataKey="Anno Preced." fill="#93c5fd" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                </ResponsiveContainer>
             </div>
         )}
      </div>
  );
}
