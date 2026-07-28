'use client';

import React from 'react';
import ModalWrapper from '@/components/ui/ModalWrapper';
import { FileText, ChevronRight } from 'lucide-react';

interface DocumentsListModalProps {
    isOpen: boolean;
    onClose: () => void;
    companyName: string;
    documents: { id: string; name: string; url: string }[];
    onViewDocument: (doc: { name: string; url: string }) => void;
}

const DocumentsListModal = ({ isOpen, onClose, companyName, documents, onViewDocument }: DocumentsListModalProps) => {
    return (
        <ModalWrapper
            isOpen={isOpen}
            onClose={onClose}
            title={`Documents - ${companyName}`}
        >
            <div className="space-y-2">
                {documents.map((doc) => (
                    <button
                        key={doc.id}
                        onClick={() => onViewDocument(doc)}
                        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-purple-50 rounded-xl transition-all group border border-transparent hover:border-purple-100"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-purple-600 shadow-sm border border-gray-100">
                                <FileText size={20} />
                            </div>
                            <span className="font-semibold text-gray-700 text-sm">{doc.name}</span>
                        </div>
                        <ChevronRight size={18} className="text-gray-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                    </button>
                ))}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 flex justify-center">
                <button className="text-purple-600 text-sm font-bold hover:underline">
                    View More Document Options
                </button>
            </div>
        </ModalWrapper>
    );
};

export default DocumentsListModal;
