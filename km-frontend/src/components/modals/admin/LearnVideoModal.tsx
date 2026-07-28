'use client';

import React, { useState } from 'react';
import ModalWrapper from '@/components/ui/ModalWrapper';

interface LearnVideoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => void;
}

const LearnVideoModal = ({ isOpen, onClose, onSave }: LearnVideoModalProps) => {
    const [title, setTitle] = useState('');
    const [link, setLink] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ title, link });
        onClose();
        setTitle('');
        setLink('');
    };

    return (
        <ModalWrapper
            isOpen={isOpen}
            onClose={onClose}
            title="Add Learning Video"
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">Video Title</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Write here..."
                        required
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-500/5 focus:border-purple-300 transition-all text-sm italic"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">Video Link</label>
                    <input
                        type="url"
                        value={link}
                        onChange={(e) => setLink(e.target.value)}
                        placeholder="Write here..."
                        required
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-500/5 focus:border-purple-300 transition-all text-sm italic"
                    />
                </div>

                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        className="px-8 py-2 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-full transition-all shadow-lg shadow-purple-200 active:scale-95"
                    >
                        Add
                    </button>
                </div>
            </form>
        </ModalWrapper>
    );
};

export default LearnVideoModal;
