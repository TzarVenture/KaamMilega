'use client';

import React, { useState, useEffect } from 'react';
import { Search, Filter, Plus, MoreVertical, Eye, Building2, ShieldCheck, FileCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import DocumentsListModal from '@/components/modals/admin/DocumentsListModal';
import DocumentViewerModal from '@/components/modals/admin/DocumentViewerModal';
import api from '@/lib/axios'; // Make sure this path is correct based on your aliases

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
    recruiter: RecruiterInfo;
    documents: Document[];
    status: string;
    created_at: string;
}

export default function CompaniesPage() {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalPages, setTotalPages] = useState(1);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    const [isDocsListOpen, setIsDocsListOpen] = useState(false);
    const [isDocViewerOpen, setIsDocViewerOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null); // Use Company interface
    const [selectedDoc, setSelectedDoc] = useState<any>(null);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1); // Reset to page 1 on new search
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const fetchCompanies = async () => {
        setLoading(true);
        try {
            const res: any = await api.get('/admin/companies', {
                params: {
                    page,
                    limit: 10,
                    search: debouncedSearch
                }
            });
            // The API returns { data: [], total: num, page: num, limit: num }
            // Assuming response interceptor returns `response.data` so `res` is the object directly
            if (res.data) {
                setCompanies(res.data);
                setTotalPages(Math.ceil(res.total / 10)); // limit is 10
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
        <div className="space-y-8">
            {/* Modals */}
            <DocumentsListModal
                isOpen={isDocsListOpen}
                onClose={() => setIsDocsListOpen(false)}
                companyName={selectedCompany?.name || ''}
                documents={getCompanyDocs(selectedCompany)}
                onViewDocument={handleViewDocument}
            />

            <DocumentViewerModal
                isOpen={isDocViewerOpen}
                onClose={() => setIsDocViewerOpen(false)}
                documentName={selectedDoc?.name || ''}
                documentUrl={selectedDoc?.url || ''}
            />

            {/* Quick Stats - could be fetched from API/stats endpoint later */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Companies', value: '428', icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { label: 'Pending Verification', value: '12', icon: ShieldCheck, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Verified Partners', value: '382', icon: FileCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Rejected Applications', value: '34', icon: MoreVertical, color: 'text-rose-600', bg: 'bg-rose-50' },
                ].map((stat, i) => (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        key={stat.label}
                        className="p-6 bg-white rounded-3xl border border-purple-50 shadow-sm hover:shadow-md transition-all group"
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-500 mb-1">{stat.label}</p>
                                <h3 className="text-2xl font-bold text-slate-900">{stat.value}</h3>
                            </div>
                            <div className={`${stat.bg} ${stat.color} p-3 rounded-2xl group-hover:scale-110 transition-transform`}>
                                <stat.icon size={22} />
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-900 to-indigo-700 bg-clip-text text-transparent">Recruiter & Company</h1>
                    <p className="text-slate-500 mt-1 font-medium">Verify documents and manage employer relations</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative group max-sm:w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-600 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Search by company name..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full sm:w-80 pl-11 pr-4 py-2.5 bg-white border border-purple-100 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-purple-500/5 focus:border-purple-300 transition-all shadow-sm"
                        />
                    </div>
                    <button className="flex items-center gap-2 px-5 py-2.5 text-slate-600 bg-white border border-purple-100 rounded-2xl text-sm font-bold hover:bg-purple-50 transition-all shadow-sm active:scale-95">
                        <Filter size={18} />
                        <span>Filter</span>
                    </button>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-2xl text-sm font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-200"
                    >
                        <Plus size={18} />
                        <span>Add Profile</span>
                    </motion.button>
                </div>
            </div>

            {/* Table Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[32px] border border-purple-50 shadow-xl shadow-purple-900/5 overflow-hidden"
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-purple-50 bg-slate-50/50">
                                <th className="px-8 py-5 text-[13px] font-bold text-slate-600 uppercase tracking-wider">Company Information</th>
                                <th className="px-8 py-5 text-[13px] font-bold text-slate-600 uppercase tracking-wider">Action</th>
                                <th className="px-8 py-5 text-[13px] font-bold text-slate-600 uppercase tracking-wider">Last Activity</th>
                                <th className="px-8 py-5 text-[13px] font-bold text-slate-600 uppercase tracking-wider">Date Added</th>
                                <th className="px-8 py-5 text-[13px] font-bold text-slate-600 uppercase tracking-wider"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-purple-50/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-8 py-10 text-center text-slate-500">Loading companies...</td>
                                </tr>
                            ) : companies.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-8 py-10 text-center text-slate-500">No companies found.</td>
                                </tr>
                            ) : (
                                companies.map((company, i) => (
                                    <motion.tr
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        key={company.id}
                                        className="hover:bg-purple-50/30 transition-colors group cursor-default"
                                    >
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-14 h-14 bg-gradient-to-tr from-purple-100 to-indigo-100 rounded-2xl flex items-center justify-center shrink-0 border-2 border-white shadow-sm overflow-hidden text-purple-700 font-bold">
                                                    {(company.name || company.recruiter?.name || '?').substring(0, 1)}
                                                </div>
                                                <div>
                                                    <h4 className="text-[15px] font-bold text-slate-900 leading-tight group-hover:text-purple-700 transition-colors">
                                                        {company.name || 'Unnamed Company'}
                                                    </h4>
                                                    <p className="text-xs text-slate-500 font-medium mt-1">
                                                        {company.recruiter?.name} • {company.recruiter?.designation || 'Recruiter'}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <button
                                                onClick={() => handleAccessDocuments(company)}
                                                className="text-purple-600 text-[13px] font-bold hover:underline underline-offset-4 flex items-center gap-1.5"
                                            >
                                                <Eye size={16} />
                                                Access Profile
                                            </button>
                                        </td>
                                        <td className="px-8 py-5 text-[13px] font-semibold text-slate-700">
                                            {company.recruiter?.last_active}
                                        </td>
                                        <td className="px-8 py-5 text-[13px] font-semibold text-slate-700">
                                            {new Date(company.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2">
                                                {company.status === 'verified' && <span className="px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-100 rounded-lg">Verified</span>}
                                                {company.status === 'pending' && <span className="px-2 py-1 text-xs font-medium text-amber-700 bg-amber-100 rounded-lg">Pending</span>}
                                                {company.status === 'rejected' && <span className="px-2 py-1 text-xs font-medium text-rose-700 bg-rose-100 rounded-lg">Rejected</span>}

                                                <button className="p-2.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all shadow-sm bg-white border border-purple-50 ml-2">
                                                    <MoreVertical size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-8 py-6 bg-slate-50/50 border-t border-purple-50 flex items-center justify-between">
                        <p className="text-[13px] text-slate-500 font-medium">Page <span className="text-slate-900 font-bold">{page}</span> of <span className="text-slate-900 font-bold">{totalPages}</span></p>
                        <div className="flex items-center gap-2">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={`w-10 h-10 flex items-center justify-center rounded-xl font-bold shadow-lg transition-colors text-xs ${p === page
                                            ? 'bg-purple-600 text-white shadow-purple-600/20'
                                            : 'text-slate-600 hover:bg-purple-50 bg-white'
                                        }`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
