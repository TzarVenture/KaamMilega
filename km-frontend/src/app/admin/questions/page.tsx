'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit3, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import QuestionModal from '@/components/modals/admin/QuestionModal';
import Pagination from '@/components/ui/Pagination';
import api from '@/lib/axios';

interface Question {
    id: string;
    question: string;
    answer: string;
}

export default function QuestionsPage() {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchQuestions = async () => {
        setIsLoading(true);
        try {
            // Adjusting to a likely API response structure. 
            // In many systems, it might be { data: [], totalPages: 1 } or just []
            const response: any = await api.get(`/admin/questions?page=${currentPage}`);

            if (response && Array.isArray(response)) {
                setQuestions(response);
                setTotalPages(1);
            } else if (response && response.data) {
                setQuestions(response.data);
                setTotalPages(response.totalPages || 1);
            }
        } catch (error) {
            console.error('Failed to fetch questions:', error);
            // Fallback for demo/development if API is not ready
            // setQuestions([
            //     { id: '1', question: 'Lorem Ipsum Dolor Sit Amet Consectetur.', answer: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.' }
            // ]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchQuestions();
    }, [currentPage]);

    const toggleExpand = (id: string) => {
        const newExpandedIds = new Set(expandedIds);
        if (newExpandedIds.has(id)) {
            newExpandedIds.delete(id);
        } else {
            newExpandedIds.add(id);
        }
        setExpandedIds(newExpandedIds);
    };

    const handleAdd = () => {
        setSelectedQuestion(null);
        setIsModalOpen(true);
    };

    const handleEdit = (q: Question) => {
        setSelectedQuestion(q);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to remove this question?')) {
            try {
                await api.delete(`/admin/questions/${id}`);
                fetchQuestions();
            } catch (error) {
                console.error('Failed to delete question:', error);
            }
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Questions</h1>
                    <p className="text-slate-500 font-medium mt-1">Manage knowledge base content and FAQs.</p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleAdd}
                    className="flex items-center justify-center gap-2 px-6 py-3.5 bg-purple-600 text-white font-bold rounded-2xl shadow-xl shadow-purple-600/20 hover:bg-purple-700 transition-all"
                >
                    <Plus size={20} strokeWidth={3} />
                    <span>Add New Question</span>
                </motion.button>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                    <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Synchronizing knowledge base</p>
                </div>
            ) : questions.length === 0 ? (
                <div className="bg-white rounded-[32px] p-20 border border-dashed border-purple-200 flex flex-col items-center text-center shadow-sm">
                    <div className="w-24 h-24 bg-purple-50 rounded-[40px] flex items-center justify-center text-5xl mb-6">
                        📚
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">Knowledge Base Empty</h2>
                    <p className="text-slate-500 mt-2 max-w-sm font-medium">Your question list is currently empty. Click the button above to create your first question.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {questions.map((q) => (
                        <motion.div
                            layout
                            key={q.id}
                            className={`bg-white border rounded-[24px] overflow-hidden transition-all duration-500 ${expandedIds.has(q.id)
                                ? 'border-purple-200 shadow-xl shadow-purple-900/5 ring-1 ring-purple-50/50'
                                : 'border-slate-100 shadow-sm hover:border-purple-100'
                                }`}
                        >
                            <div
                                className="p-6 flex items-start justify-between gap-4 cursor-pointer group"
                                onClick={() => toggleExpand(q.id)}
                            >
                                <div className="flex-1">
                                    <h3 className={`text-lg font-bold transition-colors duration-300 ${expandedIds.has(q.id) ? 'text-purple-600' : 'text-slate-800'}`}>
                                        {q.question}
                                    </h3>
                                </div>
                                <div className="flex items-center gap-6 shrink-0">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleEdit(q);
                                        }}
                                        className="text-purple-600 hover:text-purple-700 font-bold text-sm transition-colors"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(q.id);
                                        }}
                                        className="text-rose-500 hover:text-rose-600 font-bold text-sm transition-colors"
                                    >
                                        Delete
                                    </button>
                                    <div className={`transition-transform duration-300 ${expandedIds.has(q.id) ? 'rotate-180 text-purple-600' : 'text-slate-300'}`}>
                                        <ChevronDown size={24} />
                                    </div>
                                </div>
                            </div>

                            <AnimatePresence>
                                {expandedIds.has(q.id) && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }}
                                    >
                                        <div className="px-6 pb-8 pt-2 border-t border-purple-50/50">
                                            <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100/50">
                                                <p className="text-slate-600 leading-relaxed whitespace-pre-wrap font-medium">
                                                    {q.answer}
                                                </p>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ))}

                    {totalPages > 1 && (
                        <div className="flex justify-center mt-12 py-10">
                            <Pagination
                                current={currentPage}
                                total={totalPages}
                                onPageChange={setCurrentPage}
                            />
                        </div>
                    )}
                </div>
            )}

            <QuestionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchQuestions}
                question={selectedQuestion}
            />
        </div>
    );
}

