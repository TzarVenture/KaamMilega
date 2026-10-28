'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/axios';
import ModalWrapper from '@/components/ui/ModalWrapper';
import { notify } from "@/lib/notify";
import { ArrowSquareOutIcon, CalendarBlankIcon, ClockIcon, FileTextIcon, MapPinIcon, PhoneIcon, UserIcon, VideoCameraIcon } from '@phosphor-icons/react';
import UserAvatar from '@/components/ui/UserAvatar';

interface EditInterviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    interview: any | null;
    onSuccess: (updated: any) => void;
}

export default function EditInterviewModal({ isOpen, onClose, interview, onSuccess }: EditInterviewModalProps) {
    const [formData, setFormData] = useState({
        scheduled_at_date: '',
        scheduled_at_time: '',
        type: 'Video',
        location: '',
        notes: '',
        status: 'Scheduled',
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!interview) return;

        try {
            const d = new Date(interview.scheduled_at);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');

            setFormData({
                scheduled_at_date: `${year}-${month}-${day}`,
                scheduled_at_time: `${hours}:${minutes}`,
                type: interview.type || 'Video',
                location: interview.location || '',
                notes: interview.notes || '',
                status: interview.status || 'Scheduled',
            });
        } catch {
            // fallback
            setFormData({
                scheduled_at_date: '',
                scheduled_at_time: '',
                type: 'Video',
                location: '',
                notes: '',
                status: 'Scheduled',
            });
        }
    }, [interview]);

    if (!isOpen || !interview) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const scheduledAt = new Date(`${formData.scheduled_at_date}T${formData.scheduled_at_time}`);

            const payload = {
                scheduled_at: scheduledAt.toISOString(),
                type: formData.type,
                location: formData.location,
                notes: formData.notes,
                status: formData.status,
            };

            const updated: any = await api.patch(`/interviews/${interview.id}`, payload);
            notify.success("Interview updated successfully!", "Candidate was notified of any schedule changes.");
            onSuccess(updated);
            onClose();
        } catch (error: any) {
            console.error("Failed to update interview:", error);
            notify.error(error, "Failed to update interview");
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModalWrapper isOpen={isOpen} onClose={onClose} title="Edit Interview">
            <form onSubmit={handleSubmit} className="space-y-4 font-sans text-km-text-primary">
                {interview.candidate?.name && (
                    <div className="p-3.5 bg-km-surface rounded-xl border border-km-border text-xs flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-km-border">
                                <UserAvatar
                                    src={interview.candidate.profile_image}
                                    name={interview.candidate.name}
                                    sizeClass="w-full h-full"
                                />
                            </div>
                            <div className="min-w-0">
                                <p className="font-semibold text-km-text-primary truncate">{interview.candidate.name}</p>
                                {interview.job?.title && (
                                    <p className="text-km-text-secondary text-xs truncate mt-0.5">Applied for: <span className="font-medium text-km-text-primary">{interview.job.title}</span></p>
                                )}
                            </div>
                        </div>
                        {(interview.candidate_id || interview.candidate?.id) && (
                            <Link
                                href={`/profile/${interview.candidate_id || interview.candidate?.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 text-xs font-medium text-km-text-primary hover:text-km-blue bg-km-surface-card border border-km-border rounded-xl transition-colors flex items-center gap-1.5 shrink-0 shadow-2xs"
                            >
                                <span>Profile</span>
                                <ArrowSquareOutIcon size={11} weight="bold" aria-hidden="true" />
                            </Link>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3.5">
                    <div>
                        <label className="text-xs font-semibold text-km-text-primary mb-1 flex items-center gap-1.5">
                            <CalendarBlankIcon weight="regular" size={14} className="text-km-text-secondary" aria-hidden="true" />
                            <span>Interview Date</span>
                        </label>
                        <input
                            type="date"
                            required
                            className="w-full px-3 py-2 border border-km-border bg-km-surface-card rounded-xl text-xs text-km-text-primary focus:border-km-primary outline-none transition-colors"
                            value={formData.scheduled_at_date}
                            onChange={(e) => setFormData({ ...formData, scheduled_at_date: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-km-text-primary mb-1 flex items-center gap-1.5">
                            <ClockIcon weight="regular" size={14} className="text-km-text-secondary" aria-hidden="true" />
                            <span>Interview Time</span>
                        </label>
                        <input
                            type="time"
                            required
                            className="w-full px-3 py-2 border border-km-border bg-km-surface-card rounded-xl text-xs text-km-text-primary focus:border-km-primary outline-none transition-colors"
                            value={formData.scheduled_at_time}
                            onChange={(e) => setFormData({ ...formData, scheduled_at_time: e.target.value })}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-km-text-primary mb-1.5">Session Format</label>
                    <div className="grid grid-cols-3 gap-2.5">
                        {[
                            { value: "Video", label: "Video Call", icon: VideoCameraIcon },
                            { value: "Phone", label: "Phone Screen", icon: PhoneIcon },
                            { value: "In-person", label: "In-Person", icon: MapPinIcon }
                        ].map((item) => {
                            const isSelected = formData.type === item.value;
                            const IconComponent = item.icon;
                            return (
                                <button
                                    key={item.value}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: item.value })}
                                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs transition-colors ${
                                        isSelected
                                            ? "bg-blue-50/70 border-km-blue text-km-blue font-semibold dark:bg-[#131D3D] dark:border-blue-800 dark:text-km-link ring-1 ring-km-blue"
                                            : "bg-km-surface-card border-km-border text-km-text-secondary hover:bg-km-surface"
                                    }`}
                                >
                                    <IconComponent size={20} weight={isSelected ? "fill" : "regular"} aria-hidden="true" />
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div>
                    <label className="text-xs font-semibold text-km-text-primary mb-1 flex items-center gap-1.5">
                        <MapPinIcon weight="regular" size={14} className="text-km-text-secondary" aria-hidden="true" />
                        <span>{formData.type === "Video" ? "Meeting Link" : formData.type === "Phone" ? "Phone Contact" : "Office Address"}</span>
                    </label>
                    <input
                        type="text"
                        required
                        placeholder={formData.type === "Video" ? "e.g. https://meet.google.com/..." : formData.type === "Phone" ? "+91 ..." : "Full office address..."}
                        className="w-full px-3.5 py-2.5 border border-km-border bg-km-surface-card rounded-xl text-xs text-km-text-primary placeholder:text-km-text-secondary/70 focus:border-km-primary outline-none transition-colors"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    />
                </div>

                <div>
                    <label className="text-xs font-semibold text-km-text-primary mb-1 flex items-center gap-1.5">
                        <FileTextIcon weight="regular" size={14} className="text-km-text-secondary" aria-hidden="true" />
                        <span>Candidate Notes / Instructions <span className="text-km-text-secondary font-normal">(Optional)</span></span>
                    </label>
                    <textarea
                        rows={3}
                        placeholder="Provide details on agenda, round format, or preparation tips..."
                        className="w-full px-3.5 py-2.5 border border-km-border bg-km-surface-card rounded-xl text-xs text-km-text-primary placeholder:text-km-text-secondary/70 focus:border-km-primary outline-none transition-colors resize-none"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-xs font-semibold text-km-text-primary mb-1.5">Interview Status</label>
                    <div className="grid grid-cols-3 gap-2.5">
                        {[
                            { value: "Scheduled", label: "Scheduled", color: "text-km-blue bg-blue-50/80 border-blue-200 dark:bg-[#131D3D] dark:border-blue-900/40 dark:text-km-link" },
                            { value: "Completed", label: "Completed", color: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-[#0C1F2E] dark:border-emerald-900/40 dark:text-emerald-400" },
                            { value: "Cancelled", label: "Cancelled", color: "text-rose-700 bg-rose-50 border-rose-200 dark:bg-[#23142B] dark:border-rose-900/40 dark:text-rose-400" }
                        ].map((s) => {
                            const isSelected = formData.status === s.value;
                            return (
                                <button
                                    key={s.value}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, status: s.value })}
                                    className={`py-2 px-3 rounded-xl border text-xs font-medium transition-colors flex items-center justify-center ${
                                        isSelected
                                            ? `${s.color} font-semibold ring-1 ring-current`
                                            : "bg-km-surface-card border-km-border text-km-text-secondary hover:bg-km-surface"
                                    }`}
                                >
                                    <span>{s.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="pt-2 flex justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 border border-km-border text-km-text-secondary hover:bg-km-surface rounded-xl text-xs font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-5 py-2 bg-km-primary text-white rounded-xl text-xs font-semibold hover:bg-km-primary-dark disabled:opacity-50 transition-colors shadow-xs"
                    >
                        {loading ? "Saving Changes..." : "Save Changes"}
                    </button>
                </div>
            </form>
        </ModalWrapper>
    );
}
