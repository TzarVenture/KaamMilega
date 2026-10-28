'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import { ArrowCounterClockwiseIcon, BuildingOfficeIcon, CaretLeftIcon, CaretRightIcon, CheckCircleIcon, CheckIcon, DotsThreeVerticalIcon, EyeIcon, FunnelSimpleIcon, InfoIcon, MagnifyingGlassIcon, PlusIcon, ProhibitIcon, SealCheckIcon, ShieldCheckIcon, TrashIcon, XCircleIcon, CircleNotchIcon } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { notify } from "@/lib/notify";
import DocumentsListModal from '@/components/modals/admin/DocumentsListModal';
import DocumentViewerModal from '@/components/modals/admin/DocumentViewerModal';
import AddCompanyModal from '@/components/modals/admin/AddCompanyModal';
import api from '@/lib/axios';

interface Document {
    name: string;
    url: string;
}

interface RecruiterInfo {
    name: string;
    designation: string;
    last_active: string;
}

interface Company {
    id: string;
    name: string; // Company Name
    gst?: string;
    logo?: string;
    website?: string;
    recruiter: RecruiterInfo;
    documents: Document[];
    status: string;
    created_at: string;
}

function CompaniesContent() {
    const searchParams = useSearchParams();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalPages, setTotalPages] = useState(1);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') || '');

    useEffect(() => {
        const q = searchParams.get('search');
        if (q !== null) {
            setSearch(q);
            setDebouncedSearch(q);
        }
    }, [searchParams]);

    const [isDocsListOpen, setIsDocsListOpen] = useState(false);
    const [isDocViewerOpen, setIsDocViewerOpen] = useState(false);
    const [isAddCompanyOpen, setIsAddCompanyOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [selectedDoc, setSelectedDoc] = useState<any>(null);

    // 3-Dots Action Menu State
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const [deleteModalCompany, setDeleteModalCompany] = useState<Company | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Close 3-dots menu on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('[data-menu-container]')) {
                setActiveMenuId(null);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    // Synced Top & Main Scrollbars for Table
    const topScrollRef = React.useRef<HTMLDivElement>(null);
    const tableScrollRef = React.useRef<HTMLDivElement>(null);
    const [tableScrollWidth, setTableScrollWidth] = useState(1000);

    const handleTopScroll = () => {
        if (topScrollRef.current && tableScrollRef.current) {
            tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
        }
    };

    const handleTableScroll = () => {
        if (topScrollRef.current && tableScrollRef.current) {
            topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
        }
    };

    useEffect(() => {
        const updateWidth = () => {
            if (tableScrollRef.current) {
                setTableScrollWidth(tableScrollRef.current.scrollWidth);
            }
        };
        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, [companies, loading]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1); // Reset to page 1 on new search
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const [totalCompaniesCount, setTotalCompaniesCount] = useState<number | null>(null);

    const fetchCompanies = async () => {
        setLoading(true);
        try {
            const [compRes, statsRes]: any = await Promise.allSettled([
                api.get('/admin/companies', {
                    params: {
                        page,
                        limit: 10,
                        search: debouncedSearch
                    }
                }),
                api.get('/platform/stats')
            ]);

            if (compRes.status === 'fulfilled' && compRes.value?.data) {
                setCompanies(compRes.value.data);
                setTotalPages(Math.ceil((compRes.value.total || compRes.value.data.length || 1) / 10));
                if (compRes.value.total !== undefined) {
                    setTotalCompaniesCount(compRes.value.total);
                }
            }

            if (statsRes.status === 'fulfilled') {
                const s = statsRes.value?.data?.stats || statsRes.value?.data || {};
                if (s.recruiters !== undefined) {
                    setTotalCompaniesCount(s.recruiters);
                }
            }
        } catch (error) {
            console.error("Failed to fetch companies", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCompanies();
    }, [page, debouncedSearch]);

    const handleUpdateStatus = async (companyId: string, newStatus: 'verified' | 'rejected' | 'pending' | 'no_appeal') => {
        try {
            await api.patch(`/admin/companies/${companyId}`, { status: newStatus });
            // Update local state immediately
            setCompanies((prev) =>
                prev.map((c) => (c.id === companyId ? { ...c, status: newStatus } : c))
            );
            if (selectedCompany && selectedCompany.id === companyId) {
                setSelectedCompany((prev) => (prev ? { ...prev, status: newStatus } : null));
            }
            if (newStatus === 'verified') {
                notify.success('Company approved & verified successfully!');
            } else if (newStatus === 'rejected') {
                notify.info('Company verification status set to rejected.');
            } else if (newStatus === 'pending') {
                notify.info('Status reverted back to Pending review.');
            } else {
                notify.info('Status reset to No Appeal.');
            }
        } catch (error: any) {
            console.error('Failed to update company verification status:', error);
            notify.error(error, 'Failed to update company status');
            throw error;
        } finally {
            setActiveMenuId(null);
        }
    };

    const handleDeleteCompany = async () => {
        if (!deleteModalCompany) return;
        setIsDeleting(true);
        try {
            await api.delete(`/admin/companies/${deleteModalCompany.id}`);
            setCompanies((prev) => prev.filter((c) => c.id !== deleteModalCompany.id));
            if (totalCompaniesCount !== null) {
                setTotalCompaniesCount((prev) => (prev ? prev - 1 : 0));
            }
            notify.success(`Company "${deleteModalCompany.name || 'Company'}" deleted successfully!`);
            setDeleteModalCompany(null);
        } catch (error: any) {
            console.error('Failed to delete company:', error);
            notify.error(error, 'Failed to delete company');
        } finally {
            setIsDeleting(false);
            setActiveMenuId(null);
        }
    };

    const handleAccessDocuments = (company: Company) => {
        setSelectedCompany(company);
        setIsDocsListOpen(true);
    };

    const handleViewDocument = (doc: any) => {
        setSelectedDoc(doc);
        setIsDocViewerOpen(true);
    };

    // Helper to map API documents to modal format if needed, adding ID
    const getCompanyDocs = (company: Company | null) => {
        if (!company || !company.documents) return [];
        return company.documents.map((d, idx) => ({
            id: String(idx),
            name: d.name,
            url: d.url
        }));
    };

    return (
        <div className="space-y-5 max-w-[1600px] mx-auto">
            {/* Modals */}
            <DocumentsListModal
                isOpen={isDocsListOpen}
                onClose={() => setIsDocsListOpen(false)}
                companyId={selectedCompany?.id}
                companyName={selectedCompany?.name || ''}
                companyGst={selectedCompany?.gst}
                status={
                    selectedCompany?.status ||
                    (selectedCompany?.documents && selectedCompany.documents.length > 0 ? 'pending' : 'no_appeal')
                }
                documents={getCompanyDocs(selectedCompany)}
                onViewDocument={handleViewDocument}
                onUpdateStatus={handleUpdateStatus}
            />

            <DocumentViewerModal
                isOpen={isDocViewerOpen}
                onClose={() => setIsDocViewerOpen(false)}
                documentName={selectedDoc?.name || ''}
                documentUrl={selectedDoc?.url || ''}
            />

            <AddCompanyModal
                isOpen={isAddCompanyOpen}
                onClose={() => setIsAddCompanyOpen(false)}
                onSuccess={() => {
                    fetchCompanies();
                }}
            />

            {/* Compact Real Operational Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
                {[
                    {
                        label: 'Total Companies',
                        value: totalCompaniesCount !== null ? totalCompaniesCount.toLocaleString() : (loading ? '...' : (companies.length > 0 ? String(companies.length) : '0')),
                        icon: BuildingOfficeIcon,
                        color: 'text-indigo-600 dark:text-indigo-400',
                        bg: 'bg-indigo-50/70 border-indigo-100/60'
                    },
                    {
                        label: 'Pending Review',
                        value: loading
                            ? '...'
                            : String(companies.filter(c => c.status === 'pending' || (!c.status && c.documents && c.documents.length > 0)).length),
                        icon: ShieldCheckIcon,
                        color: 'text-amber-600 dark:text-amber-400',
                        bg: 'bg-amber-50/70 border-amber-100/60'
                    },
                    {
                        label: 'Verified Partners',
                        value: loading ? '...' : String(companies.filter(c => c.status === 'verified').length),
                        icon: SealCheckIcon,
                        color: 'text-emerald-600 dark:text-emerald-400',
                        bg: 'bg-emerald-50/70 border-emerald-100/60'
                    },
                    {
                        label: 'No Appeal',
                        value: loading
                            ? '...'
                            : String(companies.filter(c => c.status === 'no_appeal' || (!c.status && (!c.documents || c.documents.length === 0))).length),
                        icon: InfoIcon,
                        color: 'text-slate-600 dark:text-slate-400',
                        bg: 'bg-slate-100/70 border-slate-200/70'
                    },
                    {
                        label: 'Rejected',
                        value: loading ? '...' : String(companies.filter(c => c.status === 'rejected').length),
                        icon: XCircleIcon,
                        color: 'text-rose-600 dark:text-rose-400',
                        bg: 'bg-rose-50/70 border-rose-100/60'
                    },
                ].map((stat, i) => (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.03 }}
                        key={stat.label}
                        className={`p-3 sm:p-3.5 bg-km-surface-card rounded-2xl border ${stat.bg} shadow-xs flex items-center justify-between gap-2.5`}
                    >
                        <div className="min-w-0">
                            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 truncate">{stat.label}</p>
                            <h3 className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">{stat.value}</h3>
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-white/80 dark:bg-black/20 flex items-center justify-center shrink-0 shadow-2xs">
                            <stat.icon size={20} weight="duotone" className={stat.color} aria-hidden="true" />
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Page Header & Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-km-surface-card px-5 py-3.5 rounded-2xl border border-purple-50 shadow-xs">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-900 to-indigo-700 bg-clip-text text-transparent">Companies & Recruiters</h1>
                    <p className="text-xs text-slate-500 font-medium">Verify documents, audits & manage employers</p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="relative group max-sm:w-full">
                        <MagnifyingGlassIcon weight="bold" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-600 transition-colors dark:group-focus-within:text-purple-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search company or recruiter..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full sm:w-72 pl-10 pr-3.5 py-2 bg-slate-50/80 border border-purple-100/80 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-all shadow-2xs"
                        />
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setIsAddCompanyOpen(true)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 transition-all shadow-sm shadow-purple-600/20 shrink-0"
                    >
                        <PlusIcon weight="bold" size={15} />
                        <span>Add Company</span>
                    </motion.button>
                </div>
            </div>

            {/* Table Section */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-km-surface-card rounded-2xl border border-purple-100/70 shadow-sm overflow-hidden"
            >
                {/* Top Toolbar with Right-Aligned Pagination */}
                <div className="px-5 py-2.5 bg-slate-50/70 border-b border-purple-50 flex flex-wrap items-center justify-between gap-3 text-xs">
                    {/* Left: Table Status / Total Count */}
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-600">
                            Companies Overview
                        </span>
                        {totalCompaniesCount !== null && (
                            <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold text-[11px] border border-purple-100">
                                {totalCompaniesCount} Total
                            </span>
                        )}
                    </div>

                    {/* Right: Pagination Controls */}
                    <div className="flex items-center gap-2 ml-auto">
                        <span className="font-semibold text-slate-500 text-xs mr-1">
                            Page <strong className="text-slate-800">{page}</strong> of <strong className="text-slate-800">{totalPages}</strong>
                        </span>

                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                className="p-1.5 rounded-lg border border-purple-100 bg-white hover:bg-purple-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                title="Previous Page"
                            >
                                <CaretLeftIcon size={14} weight="bold" />
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setPage(p)}
                                    className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${
                                        p === page
                                            ? 'bg-purple-600 text-white shadow-2xs'
                                            : 'bg-white border border-purple-100 text-slate-600 hover:bg-purple-50'
                                    }`}
                                >
                                    {p}
                                </button>
                            ))}
                            <button
                                type="button"
                                disabled={page >= totalPages}
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                className="p-1.5 rounded-lg border border-purple-100 bg-white hover:bg-purple-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                title="Next Page"
                            >
                                <CaretRightIcon size={14} weight="bold" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Top Synchronized Scrollbar */}
                <div
                    ref={topScrollRef}
                    onScroll={handleTopScroll}
                    className="overflow-x-auto bg-purple-50/20 border-b border-purple-50/60 scrollbar-thin scrollbar-thumb-purple-200"
                    style={{ height: '10px' }}
                >
                    <div style={{ width: `${tableScrollWidth}px`, height: '1px' }} />
                </div>

                {/* Main Table Scroll Container */}
                <div
                    ref={tableScrollRef}
                    onScroll={handleTableScroll}
                    className="overflow-x-auto"
                >
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-purple-50 bg-slate-50/40">
                                <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider min-w-[260px]">Company Information</th>
                                <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap min-w-[130px]">Action</th>
                                <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap min-w-[120px]">Last Activity</th>
                                <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap min-w-[120px]">Date Added</th>
                                <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider text-right whitespace-nowrap min-w-[180px]">Status & Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-purple-50/40">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-5 py-8 text-center text-xs text-slate-500 font-medium">Loading companies...</td>
                                </tr>
                            ) : companies.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-5 py-8 text-center text-xs text-slate-500 font-medium">No companies found.</td>
                                </tr>
                            ) : (
                                companies.map((company, i) => (
                                    <motion.tr
                                        initial={{ opacity: 0, x: -6 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.03 }}
                                        key={company.id}
                                        className="hover:bg-purple-50/25 transition-colors group cursor-default"
                                    >
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gradient-to-tr from-purple-100 to-indigo-100 rounded-xl flex items-center justify-center shrink-0 border border-purple-200/60 shadow-2xs overflow-hidden text-purple-700 font-bold text-sm">
                                                    {(company.name || company.recruiter?.name || '?').substring(0, 1).toUpperCase()}
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-slate-900 leading-snug group-hover:text-purple-700 transition-colors">
                                                        {company.name || 'Unnamed Company'}
                                                    </h4>
                                                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                                        {company.recruiter?.name} &bull; {company.recruiter?.designation || 'Recruiter'}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <button
                                                onClick={() => handleAccessDocuments(company)}
                                                className="text-purple-600 text-xs font-bold hover:underline underline-offset-4 flex items-center gap-1 dark:text-purple-400"
                                            >
                                                <EyeIcon weight="bold" size={15} />
                                                <span>Access Profile</span>
                                            </button>
                                        </td>
                                        <td className="px-5 py-3.5 text-xs font-medium text-slate-600">
                                            {company.recruiter?.last_active}
                                        </td>
                                        <td className="px-5 py-3.5 text-xs font-medium text-slate-600">
                                            {new Date(company.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                            <div className="inline-flex items-center justify-end gap-2.5 relative" data-menu-container>
                                                {company.status === 'verified' && (
                                                    <span className="inline-flex items-center justify-center px-3 py-1 text-xs font-semibold text-emerald-700 bg-emerald-100/90 rounded-lg border border-emerald-200/60 whitespace-nowrap shrink-0">
                                                        Verified
                                                    </span>
                                                )}
                                                {(company.status === 'pending' || (!company.status && company.documents && company.documents.length > 0)) && (
                                                    <span className="inline-flex items-center justify-center px-3 py-1 text-xs font-semibold text-amber-700 bg-amber-100/90 rounded-lg border border-amber-200/60 whitespace-nowrap shrink-0">
                                                        Pending
                                                    </span>
                                                )}
                                                {company.status === 'rejected' && (
                                                    <span className="inline-flex items-center justify-center px-3 py-1 text-xs font-semibold text-rose-700 bg-rose-100/90 rounded-lg border border-rose-200/60 whitespace-nowrap shrink-0">
                                                        Rejected
                                                    </span>
                                                )}
                                                {(company.status === 'no_appeal' || (!company.status && (!company.documents || company.documents.length === 0))) && (
                                                    <span className="inline-flex items-center justify-center px-3 py-1 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg border border-slate-200/80 whitespace-nowrap shrink-0">
                                                        No Appeal
                                                    </span>
                                                )}

                                                {/* 3-Dots Action Button */}
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveMenuId(activeMenuId === company.id ? null : company.id);
                                                    }}
                                                    className={`p-2.5 rounded-xl transition-all shadow-xs border ${
                                                        activeMenuId === company.id
                                                            ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/20'
                                                            : 'text-slate-400 hover:text-purple-600 hover:bg-purple-50 bg-km-surface-card border-purple-100/80'
                                                    }`}
                                                    title="Actions Menu"
                                                >
                                                    <DotsThreeVerticalIcon weight="bold" size={18} />
                                                </button>

                                                {/* Action Popover Menu */}
                                                <AnimatePresence>
                                                    {activeMenuId === company.id && (
                                                        <motion.div
                                                            initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                                            exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                                            transition={{ duration: 0.12 }}
                                                            className="absolute right-0 top-12 z-30 w-52 bg-white dark:bg-km-surface-card rounded-2xl shadow-xl border border-purple-100/80 dark:border-white/10 p-1.5 text-left text-xs font-medium space-y-0.5"
                                                        >
                                                            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-purple-50 dark:border-white/5 mb-1">
                                                                Manage Company
                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    handleAccessDocuments(company);
                                                                    setActiveMenuId(null);
                                                                }}
                                                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-purple-50 hover:text-purple-700 dark:text-slate-200 transition-colors"
                                                            >
                                                                <EyeIcon size={16} weight="bold" className="text-purple-600 shrink-0" />
                                                                <span>View Documents</span>
                                                            </button>

                                                            {company.status !== 'verified' && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleUpdateStatus(company.id, 'verified')}
                                                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                                                                >
                                                                    <CheckCircleIcon size={16} weight="bold" className="text-emerald-600 shrink-0" />
                                                                    <span>Approve & Verify</span>
                                                                </button>
                                                            )}

                                                            {company.status !== 'rejected' && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleUpdateStatus(company.id, 'rejected')}
                                                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                                                                >
                                                                    <XCircleIcon size={16} weight="bold" className="text-amber-600 shrink-0" />
                                                                    <span>Reject Verification</span>
                                                                </button>
                                                            )}

                                                            {/* Undo Action if status was approved or rejected */}
                                                            {(company.status === 'verified' || company.status === 'rejected') && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const originalFallback = (company.documents && company.documents.length > 0) ? 'pending' : 'no_appeal';
                                                                        handleUpdateStatus(company.id, originalFallback);
                                                                    }}
                                                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-purple-700 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-950/40 transition-colors"
                                                                >
                                                                    <ArrowCounterClockwiseIcon size={16} weight="bold" className="text-purple-600 shrink-0" />
                                                                    <span>
                                                                        Undo to {(company.documents && company.documents.length > 0) ? 'Pending' : 'No Appeal'}
                                                                    </span>
                                                                </button>
                                                            )}

                                                            <div className="border-t border-purple-50 dark:border-white/5 my-1" />

                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setDeleteModalCompany(company);
                                                                    setActiveMenuId(null);
                                                                }}
                                                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                                            >
                                                                <TrashIcon size={16} weight="bold" className="text-rose-600 shrink-0" />
                                                                <span>Delete Company</span>
                                                            </button>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Bottom Pagination */}
                {totalPages > 1 && (
                    <div className="px-5 py-3 bg-slate-50/60 border-t border-purple-50 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <p className="text-slate-500 font-medium">
                            Showing page <strong className="text-slate-800 font-bold">{page}</strong> of <strong className="text-slate-800 font-bold">{totalPages}</strong>
                        </p>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                className="p-1.5 rounded-lg border border-purple-100 bg-white hover:bg-purple-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                title="Previous Page"
                            >
                                <CaretLeftIcon size={14} weight="bold" />
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={`w-7 h-7 flex items-center justify-center rounded-lg font-bold text-xs transition-colors ${
                                        p === page
                                            ? 'bg-purple-600 text-white shadow-2xs'
                                            : 'text-slate-600 hover:bg-purple-50 bg-white border border-purple-100'
                                    }`}
                                >
                                    {p}
                                </button>
                            ))}
                            <button
                                type="button"
                                disabled={page >= totalPages}
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                className="p-1.5 rounded-lg border border-purple-100 bg-white hover:bg-purple-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                title="Next Page"
                            >
                                <CaretRightIcon size={14} weight="bold" />
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Delete Company Confirmation Modal */}
            <AnimatePresence>
                {deleteModalCompany && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-[#111827] rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl border border-purple-50 dark:border-white/10"
                        >
                            <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <TrashIcon size={24} weight="bold" />
                            </div>
                            <h4 className="text-base font-bold text-slate-900 dark:text-white">Delete This Company?</h4>
                            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                                Are you sure you want to permanently delete <strong className="text-slate-800 dark:text-slate-200">"{deleteModalCompany.name || 'Company'}"</strong>? This will remove all associated company records and documents.
                            </p>
                            <div className="mt-6 flex items-center gap-2 justify-center">
                                <button
                                    type="button"
                                    onClick={() => setDeleteModalCompany(null)}
                                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={isDeleting}
                                    onClick={handleDeleteCompany}
                                    className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
                                >
                                    {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function CompaniesPage() {
    return (
        <Suspense fallback={
            <div className="bg-km-surface-card rounded-[28px] p-20 flex flex-col items-center justify-center gap-4 shadow-sm border border-purple-100/60">
                <CircleNotchIcon className="w-10 h-10 text-purple-600 animate-spin dark:text-purple-400" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px]">Loading company directory...</p>
            </div>
        }>
            <CompaniesContent />
        </Suspense>
    );
}

