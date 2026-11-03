'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CaretDownIcon, PencilSimpleIcon, PlusIcon, QuestionIcon, TrashIcon } from '@phosphor-icons/react';
import QuestionModal from '@/components/modals/admin/QuestionModal';
import Pagination from '@/components/ui/Pagination';
import api from '@/lib/axios';
import { notify } from "@/lib/notify";
import { AdminPageHeader, AdminPanel, ConfirmDialog, EmptyState, SkeletonRows, btn } from '@/components/admin/ui';

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
    const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);
    const [deleting, setDeleting] = useState(false);

    const fetchQuestions = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await api.get<unknown, Question[] | { data?: Question[]; totalPages?: number }>(`/admin/questions?page=${currentPage}`);
            if (Array.isArray(response)) {
                setQuestions(response);
                setTotalPages(1);
            } else if (response?.data) {
                setQuestions(response.data);
                setTotalPages(response.totalPages || 1);
            }
        } catch (error) {
            console.error('Failed to fetch questions:', error);
            notify.error("Couldn't load questions");
        } finally {
            setIsLoading(false);
        }
    }, [currentPage]);

    useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

    const toggleExpand = (id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const openModal = (q: Question | null) => {
        setSelectedQuestion(q);
        setIsModalOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await api.delete(`/admin/questions/${deleteTarget.id}`);
            notify.success('Question removed');
            setDeleteTarget(null);
            fetchQuestions();
        } catch (error) {
            console.error('Failed to delete question:', error);
            notify.error(error, "Couldn't remove this question");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div>
            <AdminPageHeader
                title="Questions"
                description="Frequently asked questions shown on the help pages"
                actions={
                    <button type="button" onClick={() => openModal(null)} className={btn.primary}>
                        <PlusIcon size={16} weight="bold" aria-hidden="true" />
                        Add question
                    </button>
                }
            />

            <AdminPanel>
                {isLoading ? (
                    <SkeletonRows rows={5} />
                ) : questions.length === 0 ? (
                    <EmptyState icon={QuestionIcon} title="No questions yet" description="Add the first question for the help pages." />
                ) : (
                    <ul className="divide-y divide-km-border-subtle">
                        {questions.map((q) => {
                            const open = expandedIds.has(q.id);
                            return (
                                <li key={q.id}>
                                    <div className="flex items-start gap-3 px-5 py-4">
                                        <button
                                            type="button"
                                            onClick={() => toggleExpand(q.id)}
                                            aria-expanded={open}
                                            className="flex-1 flex items-start gap-3 text-left cursor-pointer group"
                                        >
                                            <CaretDownIcon size={16} weight="bold" className={`mt-1 shrink-0 text-km-text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
                                            <span className="text-sm font-medium text-km-heading group-hover:text-km-link">{q.question}</span>
                                        </button>
                                        <button type="button" onClick={() => openModal(q)} className={btn.icon} aria-label="Edit question">
                                            <PencilSimpleIcon size={18} aria-hidden="true" />
                                        </button>
                                        <button type="button" onClick={() => setDeleteTarget(q)} className={`${btn.icon} hover:text-red-600`} aria-label="Delete question">
                                            <TrashIcon size={18} aria-hidden="true" />
                                        </button>
                                    </div>
                                    {open && (
                                        <p className="px-5 pb-5 pl-12 text-sm text-km-text-secondary leading-relaxed whitespace-pre-wrap">{q.answer}</p>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}

                {totalPages > 1 && (
                    <div className="flex justify-end px-5 py-4 border-t border-km-border-subtle">
                        <Pagination current={currentPage} total={totalPages} onPageChange={setCurrentPage} />
                    </div>
                )}
            </AdminPanel>

            <QuestionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchQuestions}
                question={selectedQuestion}
            />

            {deleteTarget && (
                <ConfirmDialog
                    title="Delete this question?"
                    description="It's removed from the help pages straight away."
                    confirmLabel="Delete question"
                    busy={deleting}
                    onCancel={() => setDeleteTarget(null)}
                    onConfirm={handleDelete}
                />
            )}
        </div>
    );
}
