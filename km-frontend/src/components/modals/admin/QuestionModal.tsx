'use client';

import React, { useState, useEffect } from 'react';
import { CircleNotchIcon } from '@phosphor-icons/react';
import { AdminModal, btn, field } from '@/components/admin/ui';
import api from '@/lib/axios';

interface Question {
    id?: string;
    question: string;
    answer: string;
}

interface QuestionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    question?: Question | null;
}

const QuestionModal = ({ isOpen, onClose, onSuccess, question }: QuestionModalProps) => {
    const [formData, setFormData] = useState({
        question: '',
        answer: '',
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (question) {
            setFormData({
                question: question.question,
                answer: question.answer,
            });
        } else {
            setFormData({
                question: '',
                answer: '',
            });
        }
        setError(null);
    }, [question, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            if (question?.id) {
                await api.patch(`/admin/questions/${question.id}`, formData);
            } else {
                await api.post('/admin/questions', formData);
            }
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to save question');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AdminModal
            isOpen={isOpen}
            onClose={onClose}
            title={question ? "Edit question" : "Add question"}
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                    <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl">
                        {error}
                    </div>
                )}

                <div className="space-y-2">
                    <label className={field.label}>Question</label>
                    <input
                        type="text"
                        required
                        placeholder="For example: How do I apply for a job?"
                        value={formData.question}
                        onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                        className={field.input}
                    />
                </div>

                <div className="space-y-2">
                    <label className={field.label}>Answer</label>
                    <textarea
                        required
                        rows={6}
                        value={formData.answer}
                        onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                        className={`${field.textarea} resize-none`}
                    />
                </div>

                <div className="flex justify-end pt-2">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className={btn.primary}
                    >
                        {isLoading && (
                            <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />
                        )}
                        {question ? 'Save' : 'Add question'}
                    </button>
                </div>
            </form>
        </AdminModal>
    );
};

export default QuestionModal;
