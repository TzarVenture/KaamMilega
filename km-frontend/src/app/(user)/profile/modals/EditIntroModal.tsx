import React, { useState, useEffect } from 'react';
import ModalWrapper from '@/components/ui/ModalWrapper';
import api from '@/lib/axios';

interface EditIntroModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: any;
    onSuccess: (updatedUser: any) => void;
}

const EditIntroModal = ({ isOpen, onClose, user, onSuccess }: EditIntroModalProps) => {
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        additional_name: '',
        pronouns: '',
        headline: '',
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user && isOpen) {
            setFormData({
                first_name: user.first_name || '',
                last_name: user.last_name || '',
                additional_name: user.additional_name || '',
                pronouns: user.pronouns || '',
                headline: user.headline || '',
            });
        }
    }, [user, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await api.patch('/user/profile', formData);
            onSuccess(response);
            onClose();
        } catch (error) {
            console.error('Failed to update intro:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModalWrapper isOpen={isOpen} onClose={onClose} title="Edit Intro">
            <form onSubmit={handleSubmit} className="space-y-6">
                <p className="text-xs text-gray-500 font-medium">* Indicates required</p>

                {/* Name Row */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-sm text-gray-600">First Name*</label>
                        <input
                            type="text"
                            required
                            value={formData.first_name}
                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm text-gray-600">Last Name*</label>
                        <input
                            type="text"
                            required
                            value={formData.last_name}
                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        />
                    </div>
                </div>

                {/* Additional Name */}
                <div className="space-y-1">
                    <label className="text-sm text-gray-600">Additional Name</label>
                    <input
                        type="text"
                        value={formData.additional_name}
                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                        onChange={(e) => setFormData({ ...formData, additional_name: e.target.value })}
                    />
                </div>

                {/* Pronouns */}
                <div className="space-y-1">
                    <label className="text-sm text-gray-600">Pronouns</label>
                    <select
                        className="w-full border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-purple-500 outline-none appearance-none cursor-pointer"
                        value={formData.pronouns}
                        onChange={(e) => setFormData({ ...formData, pronouns: e.target.value })}
                    >
                        <option value="">Please Select</option>
                        <option value="he/him">He/Him</option>
                        <option value="she/her">She/Her</option>
                        <option value="they/them">They/Them</option>
                    </select>
                    <p className="text-xs text-gray-500 pt-1">
                        Let others know how to refer to you. <span className="text-purple-700 font-semibold cursor-pointer hover:underline">Learn More About Gender Pronouns.</span>
                    </p>
                </div>

                {/* Headline */}
                <div className="space-y-1">
                    <label className="text-sm text-gray-600">Headline*</label>
                    <textarea
                        required
                        rows={2}
                        value={formData.headline}
                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 outline-none transition-all resize-none"
                        onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                    />
                </div>

                {/* Footer Action */}
                <div className="flex justify-end pt-4 border-t border-gray-100">
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-full transition-colors shadow-md disabled:opacity-50"
                    >
                        {loading ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </form>
        </ModalWrapper>
    );
};

export default EditIntroModal;