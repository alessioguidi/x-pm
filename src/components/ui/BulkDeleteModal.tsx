import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function BulkDeleteModal({ 
    isOpen, 
    onClose, 
    onArchive, 
    onPermanentDelete, 
    selectedCount,
    itemName = "elementi"
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    onArchive?: () => void; 
    onPermanentDelete: () => void;
    selectedCount: number;
    itemName?: string;
}) {
    const [actionType, setActionType] = useState<'archive' | 'delete'>(onArchive ? 'archive' : 'delete');
    const [confirmText, setConfirmText] = useState('');

    if (!isOpen) return null;

    const isDelete = actionType === 'delete';
    const isConfirmValid = !isDelete || confirmText === 'ELIMINA';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-red-50/30">
                    <h3 className="font-bold text-red-700 flex items-center gap-2 text-lg">
                        <AlertTriangle className="w-5 h-5" /> Conferma Eliminazione Multipla
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    <p className="text-gray-700 font-medium leading-relaxed text-sm">
                        Hai selezionato <span className="font-bold">{selectedCount}</span> {itemName}. {onArchive ? 'Vuoi archiviarli o eliminarli definitivamente?' : 'Vuoi eliminarli definitivamente?'}
                    </p>

                    <div className="space-y-3">
                        {onArchive && (
                            <label className={`block border p-4 rounded-xl cursor-pointer transition ${!isDelete ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="radio" 
                                        name="deleteAction" 
                                        checked={!isDelete} 
                                        onChange={() => setActionType('archive')}
                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                    />
                                    <div>
                                        <div className="font-bold text-gray-900 text-sm">Archivia (Recuperabile)</div>
                                        <div className="text-xs text-gray-500 mt-0.5">L'elemento verrà spostato nel cestino e potrà essere ripristinato in seguito.</div>
                                    </div>
                                </div>
                            </label>
                        )}

                        <label className={`block border p-4 rounded-xl cursor-pointer transition ${isDelete ? 'border-red-500 bg-red-50/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                            <div className="flex items-center gap-3">
                                <input 
                                    type="radio" 
                                    name="deleteAction" 
                                    checked={isDelete} 
                                    onChange={() => setActionType('delete')}
                                    className="w-4 h-4 text-red-600 focus:ring-red-500"
                                />
                                <div>
                                    <div className="font-bold text-gray-900 text-sm">Elimina Definitivamente</div>
                                    <div className="text-xs text-gray-500 mt-0.5">L'elemento verrà rimosso dal database. <br/><span className="font-bold text-red-600">Attenzione:</span> Questa operazione non è annullabile.</div>
                                </div>
                            </div>
                        </label>
                    </div>

                    {isDelete && (
                        <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                            <label className="block text-xs font-medium text-red-800 mb-2">
                                Per confermare, digita <span className="font-black">ELIMINA</span>:
                            </label>
                            <input 
                                type="text"
                                placeholder="ELIMINA"
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                className="w-full p-2.5 border border-red-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400 font-mono tracking-widest text-red-700"
                            />
                        </div>
                    )}
                </div>

                <div className="p-5 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition text-sm">
                        Annulla
                    </button>
                    <button 
                        disabled={!isConfirmValid}
                        onClick={() => {
                            if (isDelete) onPermanentDelete();
                            else if (onArchive) onArchive();
                            onClose();
                            setConfirmText('');
                        }} 
                        className={`px-5 py-2.5 rounded-xl font-bold text-white transition text-sm flex items-center shadow-sm ${
                            !isConfirmValid ? 'bg-gray-300 cursor-not-allowed' :
                            isDelete ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                    >
                        {isDelete ? 'Conferma Eliminazione' : 'Archivia elementi'}
                    </button>
                </div>
            </div>
        </div>
    );
}
