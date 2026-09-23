'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/axios';
import ModalWrapper from '@/components/ui/ModalWrapper';

interface EducationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (updatedUser: any) => void;
    educationToEdit?: any;
}

const EducationModal = ({ isOpen, onClose, onSuccess, educationToEdit }: EducationModalProps) => {
    const [formData, setFormData] = useState({
        school_name: '',
        degree: '',
        field_of_study: '',
        start_date: '',
        end_date: '',
        grade: '',
        description: ''
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (educationToEdit) {
            setFormData({
                school_name: educationToEdit.school_name || '',
                degree: educationToEdit.degree || '',
                field_of_study: educationToEdit.field_of_study || '',
                start_date: educationToEdit.start_date || '',
                end_date: educationToEdit.end_date || '',
                grade: educationToEdit.grade || '',
                description: educationToEdit.description || ''
            });
        } else {
            setFormData({
                school_name: '',
                degree: '',
                field_of_study: '',
                start_date: '',
                end_date: '',
                grade: '',
                description: ''
            });
        }
    }, [educationToEdit, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            let response;
            if (educationToEdit?.id) {
                response = await api.put(`/user/education/${educationToEdit.id}`, formData);
            } else {
                response = await api.post('/user/education', formData);
            }
            onSuccess(response);
            onClose();
        } catch (error) {
            console.error("Failed to save education:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModalWrapper isOpen={isOpen} onClose={onClose} title={educationToEdit ? "Edit Education" : "Add Education"}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">School / University</label>
                    <input
                        type="text"
                        required
                        placeholder="Ex: Indian Institute of Technology"
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-km-primary/20 focus:border-km-primary outline-none"
                        value={formData.school_name}
                        onChange={(e) => setFormData({ ...formData, school_name: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Degree</label>
                    <input
                        type="text"
                        required
                        placeholder="Ex: Bachelor of Computer Science"
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-km-primary/20 focus:border-km-primary outline-none"
                        value={formData.degree}
                        onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Field of Study</label>
                    <input
                        type="text"
                        required
                        placeholder="Ex: Computer Science"
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-km-primary/20 focus:border-km-primary outline-none"
                        value={formData.field_of_study}
                        onChange={(e) => setFormData({ ...formData, field_of_study: e.target.value })}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                        <input
                            type="month"
                            required
                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-km-primary/20 focus:border-km-primary outline-none"
                            value={formData.start_date}
                            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Date (or expected)</label>
                        <input
                            type="month"
                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-km-primary/20 focus:border-km-primary outline-none"
                            value={formData.end_date}
                            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
                    <input
                        type="text"
                        placeholder="Ex: 8.5 CGPA"
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-km-primary/20 focus:border-km-primary outline-none"
                        value={formData.grade}
                        onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                        rows={3}
                        placeholder="Describe your achievements, societies, etc."
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-km-primary/20 focus:border-km-primary outline-none resize-none"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                </div>

                <div className="pt-6 border-t border-gray-100 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-2 bg-km-primary text-white rounded-xl font-medium hover:bg-km-primary-dark disabled:opacity-50 transition-colors shadow-sm"
                    >
                        {loading ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </form>
        </ModalWrapper>
    );
};

export default EducationModal;
