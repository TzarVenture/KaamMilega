'use client';

import React, { useState } from 'react';
import ModalWrapper from '@/components/ui/ModalWrapper';
import { Camera, Trash2, Plus } from 'lucide-react';
import Image from 'next/image';

interface ProfessionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => void;
    initialData?: { name: string; icon?: string };
}

const ProfessionModal = ({ isOpen, onClose, onSave, initialData }: ProfessionModalProps) => {
    const [name, setName] = useState(initialData?.name || '');
    const [previewIcon, setPreviewIcon] = useState(initialData?.icon || '');

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ name, icon: previewIcon });
        onClose();
    };

    return (
        <ModalWrapper
            isOpen={isOpen}
            onClose={onClose}
            title="Profession Profile"
        >
            <form onSubmit={handleSave} className="space-y-8 flex flex-col items-center">
                {/* Image Upload Area */}
                <div className="relative group">
                    <div className="w-48 h-48 bg-[#2D0A31] rounded-full flex items-center justify-center overflow-hidden border-8 border-purple-50 shadow-xl group-hover:bg-[#3D0F41] transition-all">
                        {previewIcon ? (
                            <Image src={previewIcon} alt="Preview" fill className="object-cover" />
                        ) : (
                            <span className="text-white text-6xl font-bold tracking-tighter">▲▲</span>
                        )}
                    </div>

                    {/* Floating Controls */}
                    <div className="absolute bottom-2 left-0 flex gap-2">
                        <button type="button" className="p-2.5 bg-white rounded-full shadow-lg border border-purple-100 text-purple-600 hover:bg-purple-50 transition-all">
                            <Camera size={18} />
                        </button>
                        <button type="button" className="p-2.5 bg-white rounded-full shadow-lg border border-purple-100 text-purple-600 hover:bg-purple-50 transition-all">
                            <Plus size={18} />
                        </button>
                    </div>

                    <button type="button" className="absolute bottom-2 right-0 p-2.5 bg-white rounded-full shadow-lg border border-red-100 text-red-500 hover:bg-red-50 transition-all">
                        <Trash2 size={18} />
                    </button>
                </div>

                {/* Name Input */}
                <div className="w-full space-y-2">
                    <label className="text-sm font-bold text-slate-500 ml-1">Profession Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Write here..."
                        className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl focus:outline-none focus:bg-white focus:border-purple-200 focus:ring-4 focus:ring-purple-500/5 transition-all text-slate-700 font-medium italic"
                        required
                    />
                </div>

                <div className="w-full flex justify-end">
                    <button
                        type="submit"
                        className="px-8 py-2.5 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-full transition-all shadow-lg shadow-purple-200 active:scale-95"
                    >
                        {initialData ? 'Update' : 'Add'}
                    </button>
                </div>
            </form>
        </ModalWrapper>
    );
};

export default ProfessionModal;
