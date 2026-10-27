'use client';
import { useState } from 'react';
import api from '@/lib/axios';
import ModalWrapper from '@/components/ui/ModalWrapper';
import { notify } from "@/lib/notify";
import { CalendarBlankIcon, ClockIcon, FileTextIcon, MapPinIcon, PhoneIcon, VideoCameraIcon } from '@phosphor-icons/react';

interface ScheduleInterviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    applicationId: string;
    onSuccess: () => void;
}

const ScheduleInterviewModal = ({ isOpen, onClose, applicationId, onSuccess }: ScheduleInterviewModalProps) => {
    const [formData, setFormData] = useState({
        scheduled_at_date: '',
        scheduled_at_time: '',
        type: 'Video',
        location: '',
        notes: ''
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const scheduledAt = new Date(`${formData.scheduled_at_date}T${formData.scheduled_at_time}`);

            const payload = {
                application_id: applicationId,
                scheduled_at: scheduledAt.toISOString(),
                type: formData.type,
                location: formData.location,
                notes: formData.notes
            };

            await api.post('/interviews', payload);
            notify.success("Interview scheduled successfully!");
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error("Failed to schedule interview:", error);
            notify.error(error.message || "Failed to schedule interview");
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModalWrapper isOpen={isOpen} onClose={onClose} title="Schedule Interview">
            <form onSubmit={handleSubmit} className="space-y-4 font-sans text-km-text-primary">
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
                                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-xs transition-colors ${
                                        isSelected
                                            ? "bg-blue-50/80 border-blue-200 text-km-blue font-semibold dark:bg-blue-950/30 dark:border-blue-900/50 dark:text-km-link"
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
                        <span>{formData.type === "Video" ? "Meeting Link" : formData.type === "Phone" ? "Dial-in Phone Number" : "Office Address"}</span>
                    </label>
                    <input
                        type="text"
                        required
                        placeholder={formData.type === "Video" ? "e.g. https://meet.google.com/..." : formData.type === "Phone" ? "+91 ..." : "Full office address..."}
                        className="w-full px-3.5 py-2 border border-km-border bg-km-surface-card rounded-xl text-xs text-km-text-primary placeholder:text-km-text-secondary/70 focus:border-km-primary outline-none transition-colors"
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
                        className="w-full px-3.5 py-2 border border-km-border bg-km-surface-card rounded-xl text-xs text-km-text-primary placeholder:text-km-text-secondary/70 focus:border-km-primary outline-none transition-colors resize-none"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />
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
                        {loading ? "Scheduling..." : "Schedule Interview"}
                    </button>
                </div>
            </form>
        </ModalWrapper>
    );
};

export default ScheduleInterviewModal;
