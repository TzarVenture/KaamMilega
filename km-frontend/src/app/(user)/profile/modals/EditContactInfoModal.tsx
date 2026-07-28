import React, { useState, useEffect } from 'react';
import ModalWrapper from '@/components/ui/ModalWrapper';
import api from '@/lib/axios';

interface EditContactInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: any;
    onSuccess: (updatedUser: any) => void;
}

const EditContactInfoModal = ({ isOpen, onClose, user, onSuccess }: EditContactInfoModalProps) => {
    const [formData, setFormData] = useState({
        mobile: '',
        address: '',
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user && isOpen) {
            setFormData({
                mobile: user.mobile || '',
                address: user.address || '',
            });
        }
    }, [user, isOpen]);

    const handleSave = async () => {
        setLoading(true);
        try {
            const response = await api.patch('/user/profile', formData);
            onSuccess(response);
            onClose();
        } catch (error) {
            console.error("Failed to update contact info:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModalWrapper isOpen={isOpen} onClose={onClose} title="Edit Contact Info">
            <div className="space-y-6">

                {/* Profile URL (Read Only / Link Style) */}
                <div className="space-y-1">
                    <label className="text-sm text-gray-500">Profile URL</label>
                    <p className="text-sm text-purple-600 font-medium break-all cursor-pointer hover:underline">
                        {typeof window !== 'undefined' ? `${window.location.origin}/profile/${user.id}` : ''}
                    </p>
                </div>

                {/* Email (Read Only / Link Style) */}
                {user.email && (
                    <div className="space-y-1">
                        <label className="text-sm text-gray-500">Email</label>
                        <p className="text-sm text-purple-600 font-medium cursor-pointer hover:underline">
                            {user.email}
                        </p>
                    </div>
                )}

                {/* Phone Number */}
                <div className="space-y-1">
                    <label className="text-sm text-gray-500">Phone Number</label>
                    <input
                        type="tel"
                        value={formData.mobile}
                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                        placeholder="Enter your phone number"
                        onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    />
                </div>

                {/* Address */}
                <div className="space-y-1">
                    <label className="text-sm text-gray-500">Address</label>
                    <textarea
                        rows={2}
                        value={formData.address}
                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 outline-none transition-all resize-none"
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                </div>

                {/* Action Button */}
                <div className="flex justify-end pt-4">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="bg-[#A67DB0] hover:bg-[#9669A0] text-white font-semibold py-2 px-8 rounded-full transition-colors shadow-sm disabled:opacity-50"
                    >
                        {loading ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </ModalWrapper>
    );
};

export default EditContactInfoModal;