'use client';

import React from 'react';
import { AdminModal, btn } from '@/components/admin/ui';
import Image from 'next/image';
import { DownloadSimpleIcon, PrinterIcon, ShareNetworkIcon } from '@phosphor-icons/react';

interface DocumentViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    documentName: string;
    documentUrl: string;
}

const DocumentViewerModal = ({ isOpen, onClose, documentName, documentUrl }: DocumentViewerModalProps) => {
    return (
        <AdminModal
            isOpen={isOpen}
            onClose={onClose}
            title={documentName}
            size="xl"
        >
            <div className="flex flex-col gap-6">
                {/* PDF/Image Container */}
                <div className="relative w-full aspect-[1/1.414] bg-km-surface rounded-xl overflow-hidden border border-km-border">
                    <Image
                        src={documentUrl}
                        alt={documentName}
                        fill
                        className="object-contain"
                    />

                    {/* Watermark or Overlay if needed */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.03]">
                        <span className="text-9xl font-bold rotate-45 select-none">Verified</span>
                    </div>
                </div>

                {/* Actions Footer */}
                <div className="flex items-center justify-between bg-km-surface p-4 rounded-2xl border border-km-border-subtle">
                    <div className="flex items-center gap-4">
                        <button className={btn.secondary}>
                            <DownloadSimpleIcon weight="bold" size={18} />
                            Download
                        </button>
                        <button className={btn.secondary}>
                            <PrinterIcon weight="bold" size={18} />
                            Print
                        </button>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-km-surface text-km-link rounded-xl text-sm font-bold hover:bg-km-border-subtle transition-all">
                        <ShareNetworkIcon weight="bold" size={18} />
                        Share document
                    </button>
                </div>
            </div>
        </AdminModal>
    );
};

export default DocumentViewerModal;
