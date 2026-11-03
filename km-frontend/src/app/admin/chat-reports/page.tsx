"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ArrowsClockwiseIcon, CircleNotchIcon, FlagIcon, PaperclipIcon, XIcon } from '@phosphor-icons/react';
import api from "@/lib/axios";
import { notify } from "@/lib/notify";
import Pagination from "@/components/ui/Pagination";
import { AdminPageHeader, AdminPanel, BadgeTone, EmptyState, FilterTabs, SearchInput, SkeletonRows, StatusBadge, btn, cx, field, table } from "@/components/admin/ui";

interface ReportedMessageSnapshot {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  attachment_url?: string;
  created_at: string;
}

interface ChatReport {
  id: string;
  reporter_id: string;
  reporter_name: string;
  reporter_role: string;
  reported_user_id: string;
  reported_user_name: string;
  reported_user_role: string;
  conversation_id: string;
  reason: string;
  description: string;
  evidence: ReportedMessageSnapshot[];
  status: "pending" | "under_review" | "resolved" | "dismissed";
  action_taken?: string;
  admin_notes?: string;
  resolved_by?: string;
  resolved_by_name?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

export default function AdminChatReportsPage() {
  const [reports, setReports] = useState<ChatReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "under_review" | "resolved" | "dismissed"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Selected report for review modal
  const [selectedReport, setSelectedReport] = useState<ChatReport | null>(null);
  const [resolveStatus, setResolveStatus] = useState<
    "resolved" | "under_review" | "dismissed"
  >("resolved");
  const [actionTaken, setActionTaken] = useState<
    "warning" | "user_suspended" | "dismissed" | "none"
  >("warning");
  const [adminNotes, setAdminNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchReports = useCallback(
    async (targetPage = 1, filter = statusFilter) => {
      setLoading(true);
      try {
        const params: Record<string, any> = {
          page: targetPage,
          limit: 15,
        };
        if (filter !== "all") {
          params.status = filter;
        }

        const res: any = await api.get("/admin/chat-reports", { params });
        if (res && res.reports) {
          setReports(res.reports);
          setTotalPages(res.total_pages || 1);
          setTotalCount(res.total || 0);
        } else {
          setReports([]);
          setTotalPages(1);
          setTotalCount(0);
        }
      } catch (error: any) {
        notify.error(error, "Couldn't load chat reports");
        setReports([]);
        setTotalPages(1);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    },
    [statusFilter],
  );

  useEffect(() => {
    fetchReports(page, statusFilter);
  }, [fetchReports, page, statusFilter]);

  const handleFilterChange = (
    filter: "all" | "pending" | "under_review" | "resolved" | "dismissed",
  ) => {
    setStatusFilter(filter);
    setPage(1);
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return "";
    return new Date(isoString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const STATUS_META: Record<ChatReport["status"], { label: string; tone: BadgeTone }> = {
    pending: { label: "Needs review", tone: "amber" },
    under_review: { label: "Under review", tone: "blue" },
    resolved: { label: "Action taken", tone: "green" },
    dismissed: { label: "Dismissed", tone: "neutral" },
  };

  const ACTION_LABELS: Record<string, string> = {
    warning: "Warning sent",
    user_suspended: "Account suspended",
    dismissed: "No violation",
    none: "No action",
  };

  const openReviewModal = (report: ChatReport) => {
    setSelectedReport(report);
    setResolveStatus(report.status === "dismissed" ? "dismissed" : "resolved");
    setActionTaken(
      (report.action_taken as typeof actionTaken) ||
        (report.status === "dismissed" ? "dismissed" : "warning"),
    );
    setAdminNotes(report.admin_notes || "");
  };

  const closeReviewModal = () => {
    if (!isSubmitting) setSelectedReport(null);
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;
    setIsSubmitting(true);
    try {
      await api.put(`/admin/chat-reports/${selectedReport.id}/resolve`, {
        status: resolveStatus,
        action_taken: actionTaken,
        admin_notes: adminNotes,
      });
      notify.success("Report updated");
      setSelectedReport(null);
      fetchReports(page, statusFilter);
    } catch (err) {
      notify.error(err, "Couldn't save the decision");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Search runs over the loaded page only; the API filters by status.
  const displayedReports = reports.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.reported_user_name?.toLowerCase().includes(q) ||
      r.reporter_name?.toLowerCase().includes(q) ||
      r.reason?.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q)
    );
  });

  const roleLabel = (role?: string) => (role ? role.charAt(0).toUpperCase() + role.slice(1) : "User");

  return (
    <div>
      <AdminPageHeader
        title="Chat reports"
        description="Conversations people reported, with the messages saved at the time"
        actions={
          <button type="button" onClick={() => fetchReports(page, statusFilter)} disabled={loading} className={btn.secondary}>
            <ArrowsClockwiseIcon size={16} className={loading ? "animate-spin" : ""} aria-hidden="true" />
            Refresh
          </button>
        }
      />

      <AdminPanel>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-5 py-4 border-b border-km-border-subtle">
          <div className="overflow-x-auto -mx-1 px-1">
            <FilterTabs
              value={statusFilter}
              onChange={handleFilterChange}
              options={[
                { value: "all", label: "All" },
                { value: "pending", label: "Needs review" },
                { value: "under_review", label: "Under review" },
                { value: "resolved", label: "Action taken" },
                { value: "dismissed", label: "Dismissed" },
              ]}
            />
          </div>
          <div className="flex items-center gap-3">
            <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search name or reason" className="w-full lg:w-72" />
            {!loading && <span className="hidden sm:inline shrink-0 text-sm text-km-text-secondary font-inter">{totalCount} total</span>}
          </div>
        </div>

        {loading ? (
          <SkeletonRows rows={6} />
        ) : displayedReports.length === 0 ? (
          <EmptyState
            icon={FlagIcon}
            title={searchQuery.trim() ? "No matching reports" : "No reports"}
            description={searchQuery.trim() ? "Try a different search." : "Chats people report appear here."}
          />
        ) : (
          <div className={table.wrap}>
            <table className={table.table}>
              <thead>
                <tr>
                  <th className={table.th}>Reported person</th>
                  <th className={table.th}>Reported by</th>
                  <th className={table.th}>Reason</th>
                  <th className={`${table.th} text-right`}>Messages</th>
                  <th className={table.th}>Reported</th>
                  <th className={table.th}>Status</th>
                  <th className={`${table.th} text-right`}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {displayedReports.map((report) => {
                  const meta = STATUS_META[report.status] || { label: report.status, tone: "neutral" as BadgeTone };
                  return (
                    <tr key={report.id} className={table.row}>
                      <td className={table.td}>
                        <p className="font-medium text-km-heading">{report.reported_user_name}</p>
                        <p className="text-xs text-km-text-secondary">{roleLabel(report.reported_user_role)}</p>
                      </td>
                      <td className={table.td}>
                        <p className="font-medium text-km-heading">{report.reporter_name}</p>
                        <p className="text-xs text-km-text-secondary">{roleLabel(report.reporter_role)}</p>
                      </td>
                      <td className={`${table.td} max-w-xs`}>
                        <p className="font-medium text-km-heading truncate">{report.reason}</p>
                        {report.description && <p className="text-xs text-km-text-secondary truncate">{report.description}</p>}
                      </td>
                      <td className={`${table.td} text-right font-inter tabular-nums`}>{report.evidence?.length || 0}</td>
                      <td className={`${table.td} whitespace-nowrap text-km-text-secondary font-inter`}>{formatDate(report.created_at)}</td>
                      <td className={table.td}><StatusBadge tone={meta.tone}>{meta.label}</StatusBadge></td>
                      <td className={`${table.td} text-right`}>
                        <button type="button" onClick={() => openReviewModal(report)} className={`${btn.secondary} h-9 px-3`}>
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center px-5 py-4 border-t border-km-border-subtle">
            <Pagination current={page} total={totalPages} onPageChange={setPage} />
          </div>
        )}
      </AdminPanel>

      {selectedReport && (
        <div onClick={closeReviewModal} className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleResolveSubmit}
            className="w-full max-w-2xl max-h-[92vh] flex flex-col bg-km-surface-raised rounded-2xl border border-km-border shadow-lg overflow-hidden"
          >
            <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-km-border-subtle shrink-0">
              <div>
                <h2 id="report-title" className="text-base font-semibold text-km-heading">Review report</h2>
                <p className="text-xs text-km-text-secondary mt-0.5 font-inter">
                  #{selectedReport.id.slice(-8)} · {formatDate(selectedReport.created_at)}
                </p>
              </div>
              <button type="button" disabled={isSubmitting} onClick={closeReviewModal} className={btn.icon} aria-label="Close">
                <XIcon size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-km-border-subtle p-3">
                  <dt className="text-xs text-km-text-secondary">Reported by</dt>
                  <dd className="mt-0.5 font-medium text-km-heading">{selectedReport.reporter_name}</dd>
                  <dd className="text-xs text-km-text-secondary">{roleLabel(selectedReport.reporter_role)}</dd>
                </div>
                <div className="rounded-xl border border-km-border-subtle p-3">
                  <dt className="text-xs text-km-text-secondary">Reported person</dt>
                  <dd className="mt-0.5 font-medium text-km-heading">{selectedReport.reported_user_name}</dd>
                  <dd className="text-xs text-km-text-secondary">{roleLabel(selectedReport.reported_user_role)}</dd>
                </div>
              </dl>

              <div>
                <p className={field.label}>Reason</p>
                <p className="text-sm font-medium text-km-heading">{selectedReport.reason}</p>
                <p className="mt-1 text-sm text-km-text-primary leading-relaxed whitespace-pre-line">
                  {selectedReport.description || "No details given."}
                </p>
              </div>

              <div>
                <div className="flex items-baseline justify-between gap-3 mb-1.5">
                  <p className={field.label}>Messages ({selectedReport.evidence?.length || 0})</p>
                  <span className="text-xs text-km-text-muted">Saved when the report was made</span>
                </div>
                <div className="rounded-xl border border-km-border-subtle bg-km-surface p-3 max-h-64 overflow-y-auto space-y-2">
                  {!selectedReport.evidence?.length ? (
                    <p className="py-4 text-center text-sm text-km-text-secondary">No messages were saved.</p>
                  ) : (
                    selectedReport.evidence.map((msg, idx) => {
                      const isReported = msg.sender_id === selectedReport.reported_user_id;
                      return (
                        <div
                          key={msg.id || idx}
                          className={cx(
                            "rounded-xl border p-2.5 text-sm",
                            isReported ? "border-red-200 bg-red-50" : "border-km-border-subtle bg-km-surface-card",
                          )}
                        >
                          <div className="flex items-center justify-between gap-3 text-xs mb-1">
                            <span className={cx("font-medium", isReported ? "text-red-700" : "text-km-heading")}>
                              {msg.sender_name}{isReported ? ", reported" : ""}
                            </span>
                            <span className="text-km-text-muted font-inter">
                              {new Date(msg.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                            </span>
                          </div>
                          {msg.content && <p className="text-km-text-primary whitespace-pre-line">{msg.content}</p>}
                          {msg.attachment_url && (
                            <a href={msg.attachment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-km-link hover:underline">
                              <PaperclipIcon size={14} aria-hidden="true" />
                              Open attachment
                            </a>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {selectedReport.resolved_at && (
                <p className="text-xs text-km-text-secondary">
                  Last decision: {ACTION_LABELS[selectedReport.action_taken || ""] || "No action"}
                  {selectedReport.resolved_by_name ? ` by ${selectedReport.resolved_by_name}` : ""}, {formatDate(selectedReport.resolved_at)}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-km-border-subtle">
                <label className="block">
                  <span className={field.label}>Status</span>
                  <select value={resolveStatus} onChange={(e) => setResolveStatus(e.target.value as typeof resolveStatus)} className={field.input}>
                    <option value="resolved">Action taken</option>
                    <option value="under_review">Keep under review</option>
                    <option value="dismissed">Dismiss, no violation</option>
                  </select>
                </label>
                <label className="block">
                  <span className={field.label}>Action on the reported person</span>
                  <select value={actionTaken} onChange={(e) => setActionTaken(e.target.value as typeof actionTaken)} className={field.input}>
                    <option value="warning">Send a warning</option>
                    <option value="user_suspended">Suspend the account</option>
                    <option value="dismissed">None, no violation</option>
                    <option value="none">None</option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className={field.label}>Internal note</span>
                <textarea
                  rows={2}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Only admins see this"
                  className={field.textarea}
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-km-border-subtle shrink-0">
              <button type="button" disabled={isSubmitting} onClick={closeReviewModal} className={btn.secondary}>
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting} className={actionTaken === "user_suspended" ? btn.danger : btn.primary}>
                {isSubmitting && <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />}
                {actionTaken === "user_suspended" ? "Suspend and save" : "Save decision"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
