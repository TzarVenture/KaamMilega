'use client';

import React from 'react';
import ModalWrapper from '@/components/ui/ModalWrapper';
import Image from 'next/image';
import { Download, Printer, Share2 } from 'lucide-react';

interface DocumentViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    documentName: string;
    documentUrl: string;
}

const DocumentViewerModal = ({ isOpen, onClose, documentName, documentUrl }: DocumentViewerModalProps) => {
    return (
        <ModalWrapper
            isOpen={isOpen}
            onClose={onClose}
            title={documentName}
            size="xl"
        >
            <div className="flex flex-col gap-6">
                {/* PDF/Image Container */}
                <div className="relative w-full aspect-[1/1.414] bg-gray-100 rounded-xl overflow-hidden shadow-inner border border-gray-200">
                    <Image
                        src={documentUrl}
                        alt={documentName}
                        fill
                        className="object-contain"
                    />

                    {/* Watermark or Overlay if needed */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.03]">
                        <span className="text-9xl font-black rotate-45 select-none uppercase tracking-widest">Verified</span>
                    </div>
                </div>

                {/* Actions Footer */}
                <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-4">
                        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-sm">
                            <Download size={18} />
                            Download
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-sm">
                            <Printer size={18} />
                            Print
                        </button>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-xl text-sm font-bold hover:bg-purple-200 transition-all">
                        <Share2 size={18} />
                        Share Document
                    </button>
                </div>
            </div>
        </ModalWrapper>
    );
};

export default DocumentViewerModal;
