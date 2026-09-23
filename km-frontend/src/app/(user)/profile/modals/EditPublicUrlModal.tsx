'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle, AlertCircle, Loader2, Globe, Copy, Check } from 'lucide-react';
import api from '@/lib/axios';
import { toast } from 'react-toastify';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    currentUsername: string;
    onUpdated: (newUsername: string) => void;
}

export const EditPublicUrlModal: React.FC<Props> = ({
    isOpen,
    onClose,
    currentUsername,
    onUpdated,
}) => {
    const [username, setUsername] = useState(currentUsername || '');
    const [checking, setChecking] = useState(false);
    const [saving, setSaving] = useState(false);
    const [availability, setAvailability] = useState<{
        available: boolean;
        message: string;
    } | null>(null);
    const [copied, setCopied] = useState(false);
    const checkTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (isOpen) {
            setUsername(currentUsername || '');
            setAvailability(null);
            setCopied(false);
        }
    }, [isOpen, currentUsername]);

    // Live debounced availability check
    useEffect(() => {
        if (!isOpen) return;

        const trimmed = username.trim().toLowerCase();
        if (checkTimerRef.current) {
            clearTimeout(checkTimerRef.current);
        }

        if (trimmed.length < 3) {
            setAvailability({
                available: false,
                message: 'Must be between 3 and 30 characters'
            });
            setChecking(false);
            return;
        }

        const validRegex = /^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])?$/;
        if (!validRegex.test(trimmed)) {
            setAvailability({
                available: false,
                message: 'Only lowercase letters, numbers, and hyphens allowed (cannot start/end with a hyphen)'
            });
            setChecking(false);
            return;
        }

        if (trimmed === currentUsername?.toLowerCase()) {
            setAvailability({
                available: true,
                message: 'This is your current URL'
            });
            setChecking(false);
            return;
        }

        setChecking(true);
        checkTimerRef.current = setTimeout(async () => {
            try {
                const res = (await api.get(`/user/username/check?username=${encodeURIComponent(trimmed)}`)) as {
                    available?: boolean;
                    message?: string;
                };
                setAvailability({
                    available: Boolean(res?.available),
                    message: res?.message || (res?.available ? 'Available' : 'Unavailable')
                });
            } catch (err: unknown) {
                const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : 'Error checking availability';
                setAvailability({
                    available: false,
                    message: msg
                });
            } finally {
                setChecking(false);
            }
        }, 400);

        return () => {
            if (checkTimerRef.current) {
                clearTimeout(checkTimerRef.current);
            }
        };
    }, [username, isOpen, currentUsername]);

    if (!isOpen) return null;

    const handleCopy = () => {
        const fullUrl = `${window.location.origin}/profile/${username.trim()}`;
        navigator.clipboard.writeText(fullUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = username.trim().toLowerCase();

        if (!availability?.available && trimmed !== currentUsername?.toLowerCase()) {
            return;
        }

        if (trimmed === currentUsername?.toLowerCase()) {
            onClose();
            return;
        }

        setSaving(true);
        try {
            const res = (await api.patch('/user/username', { username: trimmed })) as {
                message?: string;
            };
            toast.success(res?.message || 'Custom profile URL updated successfully');
            onUpdated(trimmed);
            onClose();
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : 'Failed to update URL';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const isSaveDisabled = saving || checking || (!availability?.available && username.trim().toLowerCase() !== currentUsername?.toLowerCase());

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
            <div 
                className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 text-km-primary flex items-center justify-center border border-blue-100">
                            <Globe size={18} />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-900">Edit Custom URL</h3>
                            <p className="text-xs text-slate-500 font-medium">Personalize your public profile link</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        aria-label="Close modal"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSave} className="p-6 space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                            Public Profile Link
                        </label>
                        
                        <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50/80 focus-within:border-km-primary focus-within:ring-2 focus-within:ring-blue-100 transition-all overflow-hidden p-1">
                            <span className="pl-3.5 pr-1 text-xs font-semibold text-slate-400 shrink-0 select-none">
                                kaammilega.com/profile/
                            </span>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                placeholder="your-name"
                                maxLength={30}
                                className="w-full py-2.5 pr-3 text-sm font-bold text-slate-900 bg-transparent outline-hidden placeholder:text-slate-300"
                                autoFocus
                            />
                            {checking && (
                                <Loader2 size={16} className="text-slate-400 animate-spin mr-3 shrink-0" />
                            )}
                        </div>

                        {/* Availability / Error Feedback */}
                        {availability && !checking && (
                            <div className="mt-2.5 flex items-center gap-1.5 text-xs font-medium">
                                {availability.available ? (
                                    <>
                                        <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                                        <span className="text-emerald-600 font-semibold">{availability.message}</span>
                                    </>
                                ) : (
                                    <>
                                        <AlertCircle size={14} className="text-rose-500 shrink-0" />
                                        <span className="text-rose-500 font-medium">{availability.message}</span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Preview Box */}
                    <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-100/80 flex items-center justify-between">
                        <div className="min-w-0 pr-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-900/70">Your Public URL</p>
                            <p className="text-xs font-bold text-km-primary truncate mt-0.5">
                                kaammilega.com/profile/{username.trim() || 'your-name'}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="px-3 py-1.5 rounded-xl bg-white text-slate-700 hover:text-km-primary border border-blue-200 text-xs font-bold flex items-center gap-1 transition-all shadow-2xs hover:shadow-xs cursor-pointer shrink-0"
                        >
                            {copied ? (
                                <>
                                    <Check size={12} className="text-emerald-500" />
                                    <span>Copied</span>
                                </>
                            ) : (
                                <>
                                    <Copy size={12} />
                                    <span>Copy</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Guidelines */}
                    <div className="rounded-xl p-3 bg-slate-50 border border-slate-200/70 text-[11px] text-slate-500 space-y-1">
                        <p className="font-bold text-slate-700">URL Guidelines:</p>
                        <p>• Must be between 3 and 30 characters.</p>
                        <p>• Use lowercase letters, numbers, and hyphens only.</p>
                        <p>• Cannot start or end with a hyphen.</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaveDisabled}
                            className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-km-primary hover:bg-km-primary-dark transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                        >
                            {saving && <Loader2 size={14} className="animate-spin" />}
                            <span>Save URL</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
