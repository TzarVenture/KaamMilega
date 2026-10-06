"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Flag,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Shield,
  X,
  AlertCircle,
  User,
  MessageSquare,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Paperclip,
  Check,
} from "lucide-react";
import api from "@/lib/axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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
        console.error("Failed to load chat reports", error);
        toast.error(
          error?.response?.data?.error || "Failed to load chat reports",
        );
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return {
          label: "Needs Review",
          bg: "bg-amber-100 text-amber-800 border-amber-200",
          icon: Clock,
        };
      case "under_review":
        return {
          label: "Under Review",
          bg: "bg-blue-100 text-blue-800 border-blue-200",
          icon: Shield,
        };
      case "resolved":
        return {
          label: "Action Taken",
          bg: "bg-emerald-100 text-emerald-800 border-emerald-200",
          icon: CheckCircle2,
        };
      case "dismissed":
        return {
          label: "Dismissed",
          bg: "bg-slate-100 text-slate-700 border-slate-200",
          icon: XCircle,
        };
      default:
        return {
          label: status,
          bg: "bg-slate-100 text-slate-700 border-slate-200",
          icon: Clock,
        };
    }
  };

  const getActionLabel = (action?: string) => {
    switch (action) {
      case "warning":
        return "Warning Issued";
      case "user_suspended":
        return "Account Suspended";
      case "dismissed":
        return "Dismissed (No violation)";
      case "none":
        return "No action required";
      default:
        return action || "None";
    }
  };

  const openReviewModal = (report: ChatReport) => {
    setSelectedReport(report);
    setResolveStatus(
      report.status === "dismissed"
        ? "dismissed"
        : report.status === "resolved"
          ? "resolved"
          : "resolved",
    );
    setActionTaken(
      (report.action_taken as any) ||
        (report.status === "dismissed" ? "dismissed" : "warning"),
    );
    setAdminNotes(report.admin_notes || "");
  };

  const handleResolveSubmit = async () => {
    if (!selectedReport) return;
    setIsSubmitting(true);
    try {
      await api.put(`/admin/chat-reports/${selectedReport.id}/resolve`, {
        status: resolveStatus,
        action_taken: actionTaken,
        admin_notes: adminNotes,
      });

      toast.success("Chat report updated successfully");
      setSelectedReport(null);
      fetchReports(page, statusFilter);
    } catch (err: any) {
      console.error("Failed to resolve chat report", err);
      toast.error(
        err?.response?.data?.error || "Failed to update report decision",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter in-memory for search query
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

  // Calculate high-level stats
  const pendingCount = reports.filter((r) => r.status === "pending").length;
  const underReviewCount = reports.filter((r) => r.status === "under_review").length;
  const resolvedCount = reports.filter((r) => r.status === "resolved").length;

  return (
    <div className="space-y-6">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#071A4D] font-poppins flex items-center gap-2.5">
            <Flag className="text-[#FF6B00]" size={26} />
            Chat Reports & Safety
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review reported conversations, inspect immutable chat evidence, and keep KaamMilega safe.
          </p>
        </div>

        <button
          onClick={() => fetchReports(page, statusFilter)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[#071A4D] bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-xs transition-colors"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total In View
          </p>
          <p className="text-2xl font-bold text-[#071A4D] mt-1">{totalCount}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-xs bg-amber-50/20">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
            Needs Review
          </p>
          <p className="text-2xl font-bold text-amber-800 mt-1">{pendingCount}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-200/80 shadow-xs bg-blue-50/20">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
            Under Investigation
          </p>
          <p className="text-2xl font-bold text-blue-800 mt-1">{underReviewCount}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-xs bg-emerald-50/20">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
            Action Taken
          </p>
          <p className="text-2xl font-bold text-emerald-800 mt-1">{resolvedCount}</p>
        </div>
      </div>

      {/* Filter Tabs and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-xl">
            {(
              [
                { id: "all", label: "All Reports" },
                { id: "pending", label: "Needs Review" },
                { id: "under_review", label: "Under Review" },
                { id: "resolved", label: "Action Taken" },
                { id: "dismissed", label: "Dismissed" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleFilterChange(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === tab.id
                    ? "bg-white text-[#071A4D] shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search box */}
          <div className="relative min-w-[260px]">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, reason..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#071A4D] focus:bg-white transition-all text-slate-800"
            />
          </div>
        </div>

        {/* Reports Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <th className="py-3 px-4">Reported Person</th>
                <th className="py-3 px-4">Reported By</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4">Evidence</th>
                <th className="py-3 px-4">Date Submitted</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Loader2 size={24} className="animate-spin text-[#071A4D] mx-auto mb-2" />
                    Loading reports...
                  </td>
                </tr>
              ) : displayedReports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-2 text-slate-400">
                      <Flag size={20} />
                    </div>
                    No chat reports found for this filter.
                  </td>
                </tr>
              ) : (
                displayedReports.map((report) => {
                  const badge = getStatusBadge(report.status);
                  const BadgeIcon = badge.icon;
                  const evidenceCount = report.evidence?.length || 0;

                  return (
                    <tr
                      key={report.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      {/* Reported User */}
                      <td className="py-3 px-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-[11px] shrink-0">
                            {report.reported_user_name?.charAt(0) || "U"}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">
                              {report.reported_user_name}
                            </p>
                            <span className="text-[10px] text-slate-500 capitalize">
                              {report.reported_user_role || "User"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Reporter */}
                      <td className="py-3 px-4 text-slate-700">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[11px] shrink-0">
                            {report.reporter_name?.charAt(0) || "U"}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">
                              {report.reporter_name}
                            </p>
                            <span className="text-[10px] text-slate-500 capitalize">
                              {report.reporter_role || "User"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Reason */}
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-800 line-clamp-1">
                          {report.reason}
                        </p>
                        {report.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                            {report.description}
                          </p>
                        )}
                      </td>

                      {/* Evidence */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          <MessageSquare size={12} />
                          {evidenceCount} message{evidenceCount === 1 ? "" : "s"}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {formatDate(report.created_at)}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${badge.bg}`}
                        >
                          <BadgeIcon size={12} />
                          {badge.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openReviewModal(report)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#071A4D] bg-[#F4F7FB] hover:bg-slate-200 border border-[#D9E0EA] transition-colors"
                        >
                          Review Evidence
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500">
              Page {page} of {totalPages} ({totalCount} reports total)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── EVIDENCE & RESOLUTION MODAL ── */}
      {selectedReport && (
        <div
          onClick={() => !isSubmitting && setSelectedReport(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Flag size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#111827]">
                    Review Chat Report
                  </h3>
                  <p className="text-xs text-slate-500">
                    Report ID: {selectedReport.id.slice(-8)} &bull; Submitted {formatDate(selectedReport.created_at)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setSelectedReport(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              {/* Parties Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Reporter
                  </p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    {selectedReport.reporter_name}
                  </p>
                  <p className="text-xs text-slate-500 capitalize">
                    {selectedReport.reporter_role || "User"}
                  </p>
                </div>

                <div className="p-3 bg-red-50/50 rounded-xl border border-red-200">
                  <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">
                    Reported User
                  </p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    {selectedReport.reported_user_name}
                  </p>
                  <p className="text-xs text-slate-500 capitalize">
                    {selectedReport.reported_user_role || "User"}
                  </p>
                </div>
              </div>

              {/* Reported Reason & Description */}
              <div className="p-3.5 bg-amber-50/40 rounded-xl border border-amber-200">
                <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                  Reason: {selectedReport.reason}
                </p>
                {selectedReport.description ? (
                  <p className="text-xs text-slate-700 mt-1.5 leading-relaxed bg-white/70 p-2.5 rounded-lg border border-amber-100">
                    "{selectedReport.description}"
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 mt-1 italic">
                    No additional explanation provided by reporter.
                  </p>
                )}
              </div>

              {/* Chat Evidence Snapshot */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare size={14} className="text-[#071A4D]" />
                    Chat Evidence Snapshot ({selectedReport.evidence?.length || 0} messages)
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Captured at time of report
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 max-h-60 overflow-y-auto space-y-2.5 text-xs">
                  {(!selectedReport.evidence || selectedReport.evidence.length === 0) ? (
                    <p className="text-slate-400 italic text-center py-4">
                      No message history found in conversation.
                    </p>
                  ) : (
                    selectedReport.evidence.map((msg, idx) => {
                      const isReportedUser = msg.sender_id === selectedReport.reported_user_id;

                      return (
                        <div
                          key={msg.id || idx}
                          className={`p-2.5 rounded-xl border leading-relaxed ${
                            isReportedUser
                              ? "bg-red-50/70 border-red-200"
                              : "bg-white border-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span
                              className={`font-bold ${
                                isReportedUser ? "text-red-700" : "text-slate-800"
                              }`}
                            >
                              {msg.sender_name} {isReportedUser ? "(Reported)" : "(Reporter)"}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(msg.created_at).toLocaleTimeString([], {
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              })}
                            </span>
                          </div>

                          {msg.content && (
                            <p className="text-slate-800">{msg.content}</p>
                          )}

                          {msg.attachment_url && (
                            <a
                              href={msg.attachment_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline mt-1 font-semibold"
                            >
                              <Paperclip size={12} />
                              View Attachment
                              <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Action & Moderation Decision Panel */}
              <div className="pt-2 border-t border-slate-200 space-y-3.5">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Moderator Decision
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Status
                    </label>
                    <select
                      value={resolveStatus}
                      onChange={(e) => setResolveStatus(e.target.value as any)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-[#071A4D] focus:bg-white transition-all"
                    >
                      <option value="resolved">Resolved (Action completed)</option>
                      <option value="under_review">Keep Under Review</option>
                      <option value="dismissed">Dismissed (No violation)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Action on Reported User
                    </label>
                    <select
                      value={actionTaken}
                      onChange={(e) => setActionTaken(e.target.value as any)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-[#071A4D] focus:bg-white transition-all"
                    >
                      <option value="warning">Issue Warning to User</option>
                      <option value="user_suspended">Suspend Account (Block access)</option>
                      <option value="dismissed">Dismiss Report</option>
                      <option value="none">No Action Taken</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Internal Moderator Notes
                  </label>
                  <textarea
                    rows={2}
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Enter reason or notes for other moderators..."
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#071A4D] focus:bg-white resize-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors border border-slate-200"
              >
                Close
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleResolveSubmit}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#071A4D] hover:bg-[#0B1F52] transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-70"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Save Decision</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
