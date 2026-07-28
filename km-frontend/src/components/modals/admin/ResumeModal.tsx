'use client';

import React from 'react';
import ModalWrapper from '@/components/ui/ModalWrapper';
import Image from 'next/image';
import { Download, Printer, Share2 } from 'lucide-react';

interface ResumeModalProps {
    isOpen: boolean;
    onClose: () => void;
    candidateName: string;
    resumeUrl: string;
}

const ResumeModal = ({ isOpen, onClose, candidateName, resumeUrl }: ResumeModalProps) => {
    return (
        <ModalWrapper
            isOpen={isOpen}
            onClose={onClose}
            title={`Resume - ${candidateName}`}
            size="xl"
        >
            <div className="flex flex-col gap-6 ">
                {/* Resume Image Container */}
                <div className="relative w-full aspect-[1/1.414] bg-white rounded-xl overflow-hidden shadow-2xl border border-gray-200">
                    <Image
                        src={resumeUrl}
                        alt={`${candidateName} Resume`}
                        fill
                        className="object-contain"
                    />
                </div>

                {/* Actions Footer */}
                <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-4">
                        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-sm">
                            <Download size={18} />
                            Download PDF
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-sm">
                            <Printer size={18} />
                            Print
                        </button>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-200">
                        <Share2 size={18} />
                        Forward to Hiring Team
                    </button>
                </div>
            </div>
        </ModalWrapper>
    );
};

export default ResumeModal;
