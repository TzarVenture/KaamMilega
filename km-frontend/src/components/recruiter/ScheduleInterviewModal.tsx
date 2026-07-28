'use client';
import { useState } from 'react';
import api from '@/lib/axios';
import ModalWrapper from '@/components/ui/ModalWrapper';
import { toast } from 'react-toastify';
import { Calendar, Clock, MapPin, FileText, Video, Phone } from 'lucide-react';

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
            toast.success("Interview scheduled successfully!");
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error("Failed to schedule interview:", error);
            toast.error(error.message || "Failed to schedule interview");
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModalWrapper isOpen={isOpen} onClose={onClose} title="Schedule Interview">
            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            Date
                        </label>
                        <input
                            type="date"
                            required
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            value={formData.scheduled_at_date}
                            onChange={(e) => setFormData({ ...formData, scheduled_at_date: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-400" />
                            Time
                        </label>
                        <input
                            type="time"
                            required
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            value={formData.scheduled_at_time}
                            onChange={(e) => setFormData({ ...formData, scheduled_at_time: e.target.value })}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Interview Type</label>
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { value: 'Video', icon: Video },
                            { value: 'Phone', icon: Phone },
                            { value: 'In-person', icon: MapPin }
                        ].map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                onClick={() => setFormData({ ...formData, type: item.value })}
                                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${formData.type === item.value
                                    ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm"
                                    : "bg-white border-gray-100 text-gray-500 hover:border-gray-200"
                                    }`}
                            >
                                <item.icon className="w-5 h-5" />
                                <span className="text-xs font-bold uppercase">{item.value}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        {formData.type === 'Video' ? 'Meeting Link' : formData.type === 'Phone' ? 'Phone Number' : 'Meeting Address'}
                    </label>
                    <input
                        type="text"
                        required
                        placeholder={formData.type === 'Video' ? 'https://zoom.us/j/...' : formData.type === 'Phone' ? '+91 ...' : 'Office address...'}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    />
                </div>

                <div>
                    <label className="text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        Notes to Candidate (Optional)
                    </label>
                    <textarea
                        rows={3}
                        placeholder="Any preparation tips or details..."
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />
                </div>

                <div className="pt-4 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 text-gray-500 font-bold hover:text-gray-900 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-100"
                    >
                        {loading ? 'Scheduling...' : 'Schedule Interview'}
                    </button>
                </div>
            </form>
        </ModalWrapper>
    );
};

export default ScheduleInterviewModal;
