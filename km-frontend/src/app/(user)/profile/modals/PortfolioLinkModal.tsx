'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/axios';
import ModalWrapper from '@/components/ui/ModalWrapper';
import { Globe, Link as LinkIcon } from 'lucide-react';

interface PortfolioLinkModalProps {
    isOpen: boolean;
    user: any;
    onClose: () => void;
    onSuccess: (updatedUser: any) => void;
}

const PortfolioLinkModal = ({ isOpen, user, onClose, onSuccess }: PortfolioLinkModalProps) => {
    const [url, setUrl] = useState('');
    const [label, setLabel] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            setUrl(user.portfolio_url || '');
            setLabel(user.portfolio_label || '');
        }
    }, [user, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const cleanUrl = url.trim();
        const cleanLabel = label.trim();

        try {
            const response = await api.patch('/user/profile', {
                portfolio_url: cleanUrl,
                portfolio_label: cleanLabel || (cleanUrl ? 'Portfolio' : '')
            });
            onSuccess(response);
            onClose();
        } catch (err: any) {
            console.error('Failed to update portfolio link:', err);
            setError(err.response?.data?.error || err.message || 'Failed to update link. Please check the URL.');
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async () => {
        if (!confirm('Are you sure you want to remove your portfolio link?')) return;
        setError(null);
        setLoading(true);
        try {
            const response = await api.patch('/user/profile', {
                portfolio_url: '',
                portfolio_label: ''
            });
            onSuccess(response);
            onClose();
        } catch (err: any) {
            console.error('Failed to remove portfolio link:', err);
            setError(err.response?.data?.error || err.message || 'Failed to remove link.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModalWrapper isOpen={isOpen} onClose={onClose} title="Custom Portfolio Link">
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-semibold">
                        {error}
                    </div>
                )}

                <p className="text-xs text-gray-500">
                    Add a link to your personal website, portfolio, GitHub, Behance, or work samples to showcase directly on your profile header.
                </p>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Website / Portfolio URL <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <LinkIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="url"
                            required
                            placeholder="https://mywork.in or https://github.com/username"
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm text-gray-800"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Link Text (Optional)
                    </label>
                    <input
                        type="text"
                        placeholder="Ex: View Portfolio ↗, Personal Website, My Work"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm text-gray-800"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                        This text will be shown on your profile header instead of the full URL.
                    </p>
                </div>

                <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                    {user?.portfolio_url ? (
                        <button
                            type="button"
                            onClick={handleRemove}
                            disabled={loading}
                            className="px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 text-xs font-bold rounded-full transition-colors"
                        >
                            Remove Link
                        </button>
                    ) : <div />}
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-full text-xs font-semibold hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white rounded-full text-xs font-bold transition-colors flex items-center gap-1.5"
                        >
                            {loading ? 'Saving...' : 'Save Link'}
                        </button>
                    </div>
                </div>
            </form>
        </ModalWrapper>
    );
};

export default PortfolioLinkModal;
