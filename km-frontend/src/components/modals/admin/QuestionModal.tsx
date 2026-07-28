'use client';

import React, { useState, useEffect } from 'react';
import ModalWrapper from '@/components/ui/ModalWrapper';
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
        <ModalWrapper
            isOpen={isOpen}
            onClose={onClose}
            title={question ? "Edit Question" : "Add Question"}
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                    <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl">
                        {error}
                    </div>
                )}

                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">Question</label>
                    <input
                        type="text"
                        required
                        placeholder="Write here..."
                        value={formData.question}
                        onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-500/5 focus:border-purple-500/50 transition-all text-slate-900 placeholder:text-slate-400 font-medium"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">Answer</label>
                    <textarea
                        required
                        placeholder="Write here..."
                        rows={6}
                        value={formData.answer}
                        onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-500/5 focus:border-purple-500/50 transition-all text-slate-900 placeholder:text-slate-400 font-medium resize-none"
                    />
                </div>

                <div className="flex justify-end pt-2">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-10 py-3.5 bg-purple-600 text-white font-bold rounded-2xl hover:bg-purple-700 transition-all disabled:opacity-50 shadow-xl shadow-purple-600/20 active:scale-95 flex items-center gap-2"
                    >
                        {isLoading && (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        )}
                        {isLoading ? 'Saving...' : (question ? 'Save' : 'Add')}
                    </button>
                </div>
            </form>
        </ModalWrapper>
    );
};

export default QuestionModal;
