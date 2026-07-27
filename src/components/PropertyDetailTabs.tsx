"use client";

import { useState } from "react";
import PhotoUploader from "@/components/PhotoUploader";
import PropertyDetailsEditor from "@/components/PropertyDetailsEditor";
import PropertyRulesEditor from "@/components/PropertyRulesEditor";
import PropertyAmenitiesEditor from "@/components/PropertyAmenitiesEditor";
import PropertyStaffEditor from "@/components/PropertyStaffEditor";
import PropertyExtraServicesEditor from "@/components/PropertyExtraServicesEditor";

export default function PropertyDetailTabs({ property }: { property: any }) {
  const [activeTab, setActiveTab] = useState('generale');

  const tabs = [
    { id: 'generale', label: 'Impostazioni Generali' },
    { id: 'servizi', label: 'Servizi e Sicurezza' },
    { id: 'regole', label: 'Regole e Check-in' },
    { id: 'extra', label: 'Servizi Extra' },
    { id: 'staff', label: 'Assegnazione Staff' },
    { id: 'foto', label: 'Galleria' },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === tab.id 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-6">
        {activeTab === 'generale' && (
          <div className="max-w-4xl">
             <PropertyDetailsEditor property={property} />
          </div>
        )}
        {activeTab === 'servizi' && (
          <div className="max-w-4xl">
             <PropertyAmenitiesEditor property={property} />
          </div>
        )}
        {activeTab === 'regole' && (
          <div className="max-w-4xl">
             <PropertyRulesEditor property={property} />
          </div>
        )}
        {activeTab === 'extra' && (
          <div className="max-w-4xl">
             <PropertyExtraServicesEditor property={property} />
          </div>
        )}
        {activeTab === 'staff' && (
          <div className="max-w-4xl">
             <PropertyStaffEditor property={property} />
          </div>
        )}
        {activeTab === 'foto' && (
          <div className="max-w-4xl bg-white p-6 border border-gray-200 rounded-lg shadow-sm">
             <h3 className="text-xl font-bold mb-4 text-gray-900">Gestisci le foto per il sito</h3>
             <PhotoUploader propertyId={property.id} />
          </div>
        )}
      </div>
    </div>
  );
}
