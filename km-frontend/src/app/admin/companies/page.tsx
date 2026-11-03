'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import { ArrowCounterClockwiseIcon, BuildingOfficeIcon, CheckCircleIcon, FileTextIcon, PencilSimpleIcon, PlusIcon, TrashIcon, XCircleIcon } from '@phosphor-icons/react';
import Pagination from '@/components/ui/Pagination';
import { AdminPageHeader, AdminPanel, ConfirmDialog, EmptyState, FilterTabs, LogoTile, MenuItem, RowMenu, SearchInput, SkeletonRows, StatusBadge, btn, table, type BadgeTone } from '@/components/admin/ui';
import { notify } from "@/lib/notify";
import DocumentsListModal from '@/components/modals/admin/DocumentsListModal';
import DocumentViewerModal from '@/components/modals/admin/DocumentViewerModal';
import AddCompanyModal from '@/components/modals/admin/AddCompanyModal';
import EditCompanyModal from '@/components/modals/admin/EditCompanyModal';
import api from '@/lib/axios';

interface Document {
    name: string;
    url: string;
}

interface RecruiterInfo {
    name: string;
    designation: string;
    email?: string;
    mobile?: string;
    last_active: string;
}

interface Company {
    id: string;
    name: string; // Company Name
    industry?: string;
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
    const [statusFilter, setStatusFilter] = useState('');
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
    const [isEditCompanyOpen, setIsEditCompanyOpen] = useState(false);
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [selectedDoc, setSelectedDoc] = useState<any>(null);

    const [deleteModalCompany, setDeleteModalCompany] = useState<Company | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

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
            const res = await api.get<unknown, { data?: Company[]; total?: number }>('/admin/companies', {
                params: { page, limit: 10, search: debouncedSearch, status: statusFilter || undefined },
            });
            setCompanies(res?.data || []);
            setTotalPages(Math.max(1, Math.ceil((res?.total || res?.data?.length || 0) / 10)));
            setTotalCompaniesCount(res?.total ?? null);
        } catch (error) {
            console.error("Failed to fetch companies", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCompanies();
    }, [page, debouncedSearch, statusFilter]);

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
                notify.success('Company verified');
            } else if (newStatus === 'rejected') {
                notify.info('Company rejected');
            } else if (newStatus === 'pending') {
                notify.info('Company moved back to pending');
            } else {
                notify.info('Company status reset');
            }
        } catch (error: any) {
            console.error('Failed to update company verification status:', error);
            notify.error(error, "Couldn't update the company");
            throw error;
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
            notify.success(`${deleteModalCompany.name || 'Company'} deleted`);
            setDeleteModalCompany(null);
        } catch (error: any) {
            console.error('Failed to delete company:', error);
            notify.error(error, "Couldn't delete the company");
        } finally {
            setIsDeleting(false);
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
        <div>
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

            <EditCompanyModal
                isOpen={isEditCompanyOpen}
                onClose={() => {
                    setIsEditCompanyOpen(false);
                    setEditingCompany(null);
                }}
                company={editingCompany}
                onSuccess={() => {
                    fetchCompanies();
                }}
            />

            <AdminPageHeader
                title="Companies"
                description="Verify employer documents and manage company details"
                actions={
                    <button type="button" onClick={() => setIsAddCompanyOpen(true)} className={btn.primary}>
                        <PlusIcon size={16} weight="bold" aria-hidden="true" />
                        Add company
                    </button>
                }
            />

            <AdminPanel>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-5 py-4 border-b border-km-border-subtle">
                    <FilterTabs
                        value={statusFilter}
                        onChange={(v) => { setStatusFilter(v); setPage(1); }}
                        options={[
                            { value: '', label: 'All' },
                            { value: 'pending', label: 'Pending' },
                            { value: 'verified', label: 'Verified' },
                            { value: 'rejected', label: 'Rejected' },
                        ]}
                    />
                    <div className="flex items-center gap-3">
                        {totalCompaniesCount !== null && (
                            <span className="hidden sm:inline text-sm text-km-text-secondary whitespace-nowrap font-inter">{totalCompaniesCount} companies</span>
                        )}
                        <SearchInput value={search} onChange={setSearch} placeholder="Search company or recruiter" className="w-full lg:w-72" />
                    </div>
                </div>

                {loading ? (
                    <SkeletonRows rows={6} />
                ) : companies.length === 0 ? (
                    <EmptyState icon={BuildingOfficeIcon} title="No companies found" description="Try a different search or status." />
                ) : (
                    <div className={table.wrap}>
                        <table className={table.table}>
                            <thead>
                                <tr>
                                    <th className={table.th}>Company</th>
                                    <th className={table.th}>Status</th>
                                    <th className={table.th}>Documents</th>
                                    <th className={table.th}>Last active</th>
                                    <th className={table.th}>Added</th>
                                    <th className={`${table.th} text-right`}><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {companies.map((company) => {
                                    const status = companyStatus(company);
                                    const docCount = company.documents?.length || 0;
                                    return (
                                        <tr key={company.id} className={table.row}>
                                            <td className={table.td}>
                                                <div className="flex items-center gap-3 min-w-[240px]">
                                                    <LogoTile src={company.logo} name={company.name || company.recruiter?.name || ''} />
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-km-heading truncate">{company.name || 'Unnamed company'}</p>
                                                        <p className="text-xs text-km-text-secondary truncate">
                                                            {[company.recruiter?.name, company.recruiter?.designation].filter(Boolean).join(', ')}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className={table.td}>
                                                <StatusBadge tone={STATUS_META[status].tone}>{STATUS_META[status].label}</StatusBadge>
                                            </td>
                                            <td className={table.td}>
                                                <button type="button" onClick={() => handleAccessDocuments(company)} className="inline-flex items-center gap-1.5 text-sm font-medium text-km-link hover:underline cursor-pointer whitespace-nowrap">
                                                    <FileTextIcon size={16} aria-hidden="true" />
                                                    {docCount > 0 ? `${docCount} ${docCount === 1 ? 'file' : 'files'}` : 'View profile'}
                                                </button>
                                            </td>
                                            <td className={`${table.td} whitespace-nowrap text-km-text-secondary font-inter`}>{company.recruiter?.last_active}</td>
                                            <td className={`${table.td} whitespace-nowrap text-km-text-secondary font-inter`}>{new Date(company.created_at).toLocaleDateString('en-IN')}</td>
                                            <td className={`${table.td} text-right`}>
                                                <RowMenu label={`Actions for ${company.name || 'company'}`}>
                                                    {() => (
                                                        <>
                                                            <MenuItem icon={PencilSimpleIcon} onClick={() => { setEditingCompany(company); setIsEditCompanyOpen(true); }}>Edit details</MenuItem>
                                                            <MenuItem icon={FileTextIcon} onClick={() => handleAccessDocuments(company)}>View documents</MenuItem>
                                                            {company.status !== 'verified' && (
                                                                <MenuItem icon={CheckCircleIcon} onClick={() => handleUpdateStatus(company.id, 'verified')}>Approve</MenuItem>
                                                            )}
                                                            {company.status !== 'rejected' && (
                                                                <MenuItem icon={XCircleIcon} onClick={() => handleUpdateStatus(company.id, 'rejected')}>Reject</MenuItem>
                                                            )}
                                                            {(company.status === 'verified' || company.status === 'rejected') && (
                                                                <MenuItem icon={ArrowCounterClockwiseIcon} onClick={() => handleUpdateStatus(company.id, docCount > 0 ? 'pending' : 'no_appeal')}>
                                                                    {docCount > 0 ? 'Move back to pending' : 'Clear decision'}
                                                                </MenuItem>
                                                            )}
                                                            <div className="my-1 border-t border-km-border-subtle" />
                                                            <MenuItem icon={TrashIcon} danger onClick={() => setDeleteModalCompany(company)}>Delete company</MenuItem>
                                                        </>
                                                    )}
                                                </RowMenu>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="flex justify-end px-5 py-4">
                        <Pagination current={page} total={totalPages} onPageChange={setPage} />
                    </div>
                )}
            </AdminPanel>

            {deleteModalCompany && (
                <ConfirmDialog
                    title="Delete this company?"
                    description={`"${deleteModalCompany.name || 'Company'}" and its company records will be removed. This can't be undone.`}
                    confirmLabel="Delete company"
                    busy={isDeleting}
                    onCancel={() => setDeleteModalCompany(null)}
                    onConfirm={handleDeleteCompany}
                />
            )}
        </div>
    );
}

type CompanyStatus = 'verified' | 'pending' | 'rejected' | 'no_appeal';

const STATUS_META: Record<CompanyStatus, { label: string; tone: BadgeTone }> = {
    verified: { label: 'Verified', tone: 'green' },
    pending: { label: 'Pending', tone: 'amber' },
    rejected: { label: 'Rejected', tone: 'red' },
    no_appeal: { label: 'Not submitted', tone: 'neutral' },
};

// Companies saved before statuses existed have none: documents mean they're waiting for review
function companyStatus(c: Company): CompanyStatus {
    if (c.status === 'verified' || c.status === 'pending' || c.status === 'rejected' || c.status === 'no_appeal') return c.status;
    return c.documents && c.documents.length > 0 ? 'pending' : 'no_appeal';
}

export default function CompaniesPage() {
    return (
        <Suspense fallback={<SkeletonRows rows={6} />}>
            <CompaniesContent />
        </Suspense>
    );
}
