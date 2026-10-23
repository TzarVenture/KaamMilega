"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import api from "@/lib/axios";
import { toast, ToastContainer } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import { 
    ArrowsClockwiseIcon, 
    BellIcon, 
    CheckCircleIcon, 
    DeviceMobileIcon, 
    EnvelopeSimpleIcon, 
    EyeIcon, 
    GlobeIcon, 
    KeyIcon, 
    LockIcon, 
    ShieldCheckIcon, 
    SlidersHorizontalIcon 
} from '@phosphor-icons/react';
import { FullPageSkeleton } from "@/components/ui/LoadingSkeleton";

interface SettingsViewProps {
    mode?: "candidate" | "recruiter";
}

interface UserSettingsState {
    email_job_alerts: boolean;
    email_application_updates: boolean;
    email_marketing: boolean;
    sms_alerts: boolean;
    push_notifications: boolean;
    profile_visibility: "public" | "connections" | "private";
    language: "en" | "hi" | "hinglish";
    enable_ai_recommendations: boolean;
    search_engine_indexing: boolean;
}

export default function SettingsView({ mode = "candidate" }: SettingsViewProps) {
    const isRecruiter = mode === "recruiter";
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState<"notifications" | "privacy" | "security" | "preferences">("notifications");

    useEffect(() => {
        const tab = searchParams?.get("tab");
        if (tab && ["notifications", "privacy", "security", "preferences"].includes(tab)) {
            setActiveTab(tab as any);
        }
    }, [searchParams]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [userProfile, setUserProfile] = useState<any>(null);

    const [settings, setSettings] = useState<UserSettingsState>({
        email_job_alerts: true,
        email_application_updates: true,
        email_marketing: false,
        sms_alerts: true,
        push_notifications: true,
        profile_visibility: "public",
        language: "en",
        enable_ai_recommendations: true,
        search_engine_indexing: true
    });

    const [passwordData, setPasswordData] = useState({
        current_password: "",
        new_password: "",
        confirm_password: ""
    });
    const [updatingPassword, setUpdatingPassword] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const [settingsRes, profileRes] = await Promise.all([
                    api.get("/user/settings").catch(() => null),
                    api.get("/user/profile").catch(() => null)
                ]);

                if (settingsRes) {
                    setSettings(prev => ({
                        ...prev,
                        ...settingsRes
                    }));
                }
                if (profileRes) {
                    setUserProfile(profileRes);
                }
            } catch (err) {
                console.error("Failed to load user settings:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    const handleToggle = (field: keyof UserSettingsState) => {
        const updated = {
            ...settings,
            [field]: typeof settings[field] === "boolean" ? !settings[field] : settings[field]
        };
        setSettings(updated);
        saveSettingsToBackend(updated);
    };

    const handleSelectChange = (field: keyof UserSettingsState, value: any) => {
        const updated = { ...settings, [field]: value };
        setSettings(updated);
        saveSettingsToBackend(updated);
    };

    const saveSettingsToBackend = async (dataToSave: UserSettingsState) => {
        setSaving(true);
        try {
            await api.put("/user/settings", dataToSave);
            toast.success("Preferences updated successfully", { autoClose: 1500 });
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordData.new_password !== passwordData.confirm_password) {
            toast.error("New passwords do not match");
            return;
        }
        if (passwordData.new_password.length < 6) {
            toast.error("Password must be at least 6 characters long");
            return;
        }

        setUpdatingPassword(true);
        try {
            await api.put("/user/password", {
                current_password: passwordData.current_password,
                new_password: passwordData.new_password
            });
            toast.success("Password updated successfully!");
            setPasswordData({ current_password: "", new_password: "", confirm_password: "" });
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Failed to update password");
        } finally {
            setUpdatingPassword(false);
        }
    };

    if (loading) {
        return <FullPageSkeleton />;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-16 font-sans text-km-text-primary">
            <ToastContainer />

            {/* Header Title */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-km-border">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold font-poppins text-km-text-primary flex items-center gap-2.5">
                        <SlidersHorizontalIcon size={24} weight="duotone" className="text-km-primary dark:text-km-link" aria-hidden="true" />
                        {isRecruiter ? "Employer Account Settings" : "Account & Preference Settings"}
                    </h1>
                    <p className="text-xs text-km-text-secondary mt-1">
                        {isRecruiter
                            ? "Configure applicant alerts, company page visibility, and hiring team security credentials."
                            : "Manage your notification preferences, privacy visibility, and account security controls."}
                    </p>
                </div>
                {saving && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-km-primary bg-blue-50 dark:bg-blue-950/40 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-900">
                        <ArrowsClockwiseIcon size={14} weight="bold" className="animate-spin" /> 
                        <span>Saving changes...</span>
                    </div>
                )}
            </div>

            {/* Main Tabs Header */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-km-border">
                <button
                    onClick={() => setActiveTab("notifications")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors border shrink-0 ${
                        activeTab === "notifications"
                            ? "bg-km-primary text-white border-km-primary shadow-xs"
                            : "bg-km-surface-card text-km-text-secondary border-km-border hover:bg-km-surface hover:text-km-text-primary"
                    }`}
                >
                    <BellIcon size={16} weight={activeTab === "notifications" ? "fill" : "regular"} aria-hidden="true" /> 
                    <span>Notifications</span>
                </button>
                <button
                    onClick={() => setActiveTab("privacy")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors border shrink-0 ${
                        activeTab === "privacy"
                            ? "bg-km-primary text-white border-km-primary shadow-xs"
                            : "bg-km-surface-card text-km-text-secondary border-km-border hover:bg-km-surface hover:text-km-text-primary"
                    }`}
                >
                    <EyeIcon size={16} weight={activeTab === "privacy" ? "fill" : "regular"} aria-hidden="true" /> 
                    <span>{isRecruiter ? "Company Visibility" : "Privacy & Visibility"}</span>
                </button>
                <button
                    onClick={() => setActiveTab("security")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors border shrink-0 ${
                        activeTab === "security"
                            ? "bg-km-primary text-white border-km-primary shadow-xs"
                            : "bg-km-surface-card text-km-text-secondary border-km-border hover:bg-km-surface hover:text-km-text-primary"
                    }`}
                >
                    <LockIcon size={16} weight={activeTab === "security" ? "fill" : "regular"} aria-hidden="true" /> 
                    <span>Security & Access</span>
                </button>
                <button
                    onClick={() => setActiveTab("preferences")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors border shrink-0 ${
                        activeTab === "preferences"
                            ? "bg-km-primary text-white border-km-primary shadow-xs"
                            : "bg-km-surface-card text-km-text-secondary border-km-border hover:bg-km-surface hover:text-km-text-primary"
                    }`}
                >
                    <GlobeIcon size={16} weight={activeTab === "preferences" ? "fill" : "regular"} aria-hidden="true" /> 
                    <span>Preferences</span>
                </button>
            </div>

            {/* TAB 1: NOTIFICATIONS */}
            {activeTab === "notifications" && (
                <div className="bg-km-surface-card rounded-2xl p-6 border border-km-border shadow-xs space-y-6">
                    <div>
                        <h2 className="text-sm font-bold font-poppins text-km-text-primary">
                            {isRecruiter ? "Applicant Alerts & Communication" : "Notification Channels & Alerts"}
                        </h2>
                        <p className="text-xs text-km-text-secondary mt-0.5">
                            {isRecruiter 
                                ? "Configure how your hiring team is alerted when new applications or candidate responses arrive."
                                : "Control how and when Kaam Milega sends job recommendations and application alerts."}
                        </p>
                    </div>

                    <div className="divide-y divide-km-border/70">
                        {/* Job Alerts / Application Alert */}
                        <div className="py-3.5 flex items-center justify-between gap-4">
                            <div>
                                <p className="text-xs font-semibold text-km-text-primary">
                                    {isRecruiter ? "New Candidate Application Alerts" : "Email Job Alerts"}
                                </p>
                                <p className="text-[11px] text-km-text-secondary mt-0.5 leading-relaxed">
                                    {isRecruiter 
                                        ? "Receive immediate emails as soon as qualified applicants submit resumes to your active jobs."
                                        : "Receive daily emails about new job openings matching your profile and skills."}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleToggle("email_job_alerts")}
                                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 ${
                                    settings.email_job_alerts ? "bg-km-primary" : "bg-km-border"
                                }`}
                                aria-label="Toggle email job alerts"
                            >
                                <div className={`w-5 h-5 bg-white rounded-full transition-transform shadow-xs ${settings.email_job_alerts ? "translate-x-5" : "translate-x-0"}`} />
                            </button>
                        </div>

                        {/* Application Updates */}
                        <div className="py-3.5 flex items-center justify-between gap-4">
                            <div>
                                <p className="text-xs font-semibold text-km-text-primary">
                                    {isRecruiter ? "Interview & Stage Confirmations" : "Application Status Notifications"}
                                </p>
                                <p className="text-[11px] text-km-text-secondary mt-0.5 leading-relaxed">
                                    {isRecruiter 
                                        ? "Get notified when candidates accept scheduled interviews or submit assessment responses."
                                        : "Get notified instantly when a recruiter reviews, shortlists, or schedules an interview."}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleToggle("email_application_updates")}
                                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 ${
                                    settings.email_application_updates ? "bg-km-primary" : "bg-km-border"
                                }`}
                                aria-label="Toggle application updates"
                            >
                                <div className={`w-5 h-5 bg-white rounded-full transition-transform shadow-xs ${settings.email_application_updates ? "translate-x-5" : "translate-x-0"}`} />
                            </button>
                        </div>

                        {/* SMS Alerts */}
                        <div className="py-3.5 flex items-center justify-between gap-4">
                            <div>
                                <p className="text-xs font-semibold text-km-text-primary">Urgent SMS Alerts</p>
                                <p className="text-[11px] text-km-text-secondary mt-0.5 leading-relaxed">
                                    {isRecruiter
                                        ? "Receive priority SMS notifications for candidate confirmations within 2 hours of scheduled interviews."
                                        : "Receive high-priority SMS messages for interview invitations and recruiter call requests."}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleToggle("sms_alerts")}
                                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 ${
                                    settings.sms_alerts ? "bg-km-primary" : "bg-km-border"
                                }`}
                                aria-label="Toggle urgent SMS alerts"
                            >
                                <div className={`w-5 h-5 bg-white rounded-full transition-transform shadow-xs ${settings.sms_alerts ? "translate-x-5" : "translate-x-0"}`} />
                            </button>
                        </div>

                        {/* Push Notifications */}
                        <div className="py-3.5 flex items-center justify-between gap-4">
                            <div>
                                <p className="text-xs font-semibold text-km-text-primary">Browser & Desktop Notifications</p>
                                <p className="text-[11px] text-km-text-secondary mt-0.5 leading-relaxed">
                                    Allow real-time push alerts on your desktop when active in the recruiter portal.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleToggle("push_notifications")}
                                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 ${
                                    settings.push_notifications ? "bg-km-primary" : "bg-km-border"
                                }`}
                                aria-label="Toggle push notifications"
                            >
                                <div className={`w-5 h-5 bg-white rounded-full transition-transform shadow-xs ${settings.push_notifications ? "translate-x-5" : "translate-x-0"}`} />
                            </button>
                        </div>

                        {/* Marketing Updates */}
                        <div className="py-3.5 flex items-center justify-between gap-4">
                            <div>
                                <p className="text-xs font-semibold text-km-text-primary">Product Updates & Hiring Market Reports</p>
                                <p className="text-[11px] text-km-text-secondary mt-0.5 leading-relaxed">
                                    Occasional salary benchmarks, industry hiring trends, and ATS feature release announcements.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleToggle("email_marketing")}
                                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 ${
                                    settings.email_marketing ? "bg-km-primary" : "bg-km-border"
                                }`}
                                aria-label="Toggle marketing emails"
                            >
                                <div className={`w-5 h-5 bg-white rounded-full transition-transform shadow-xs ${settings.email_marketing ? "translate-x-5" : "translate-x-0"}`} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: PRIVACY & VISIBILITY */}
            {activeTab === "privacy" && (
                <div className="bg-km-surface-card rounded-2xl p-6 border border-km-border shadow-xs space-y-6">
                    <div>
                        <h2 className="text-sm font-bold font-poppins text-km-text-primary">
                            {isRecruiter ? "Company Brand & Job Posting Visibility" : "Privacy & Profile Visibility"}
                        </h2>
                        <p className="text-xs text-km-text-secondary mt-0.5">
                            {isRecruiter 
                                ? "Manage how your organization profile and active listings appear to job seekers across India."
                                : "Determine who can discover your candidate profile and experience details."}
                        </p>
                    </div>

                    <div className="space-y-3">
                        <label className="text-xs font-semibold text-km-text-primary block">
                            {isRecruiter ? "Company Profile Discovery Mode" : "Profile Visibility Mode"}
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {[
                                { 
                                    id: "public", 
                                    title: "Public (Recommended)", 
                                    desc: isRecruiter 
                                        ? "Visible to all active job seekers, search engines, and candidate talent discovery."
                                        : "Visible to all verified employers, recruiters, and network connections." 
                                },
                                { 
                                    id: "connections", 
                                    title: isRecruiter ? "Direct Applicants Only" : "Connections Only", 
                                    desc: isRecruiter 
                                        ? "Detailed company contact data is visible only to candidates who apply to your jobs."
                                        : "Only recruiters you interact with or connect to can view your full details." 
                                },
                                { 
                                    id: "private", 
                                    title: "Private / Confidential", 
                                    desc: isRecruiter 
                                        ? "Company identity is masked on public boards. Ideal for discreet executive hiring."
                                        : "Hidden from general candidate searches. Only visible when you apply directly." 
                                }
                            ].map((opt) => (
                                <div
                                    key={opt.id}
                                    onClick={() => handleSelectChange("profile_visibility", opt.id)}
                                    className={`p-4 rounded-xl border transition-colors cursor-pointer space-y-1.5 ${
                                        settings.profile_visibility === opt.id
                                            ? "bg-blue-50/60 dark:bg-blue-950/30 border-km-primary"
                                            : "bg-km-surface border-km-border hover:border-km-text-secondary/40"
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-semibold text-km-text-primary font-poppins">{opt.title}</p>
                                        {settings.profile_visibility === opt.id && (
                                            <CheckCircleIcon size={16} weight="fill" className="text-km-primary dark:text-km-link" aria-hidden="true" />
                                        )}
                                    </div>
                                    <p className="text-[11px] text-km-text-secondary leading-relaxed">{opt.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="divide-y divide-km-border/70 pt-2">
                        {/* Automated Match */}
                        <div className="py-3.5 flex items-center justify-between gap-4">
                            <div>
                                <p className="text-xs font-semibold text-km-text-primary">
                                    {isRecruiter ? "Automated Candidate Matchmaking" : "Automated Skill Matching"}
                                </p>
                                <p className="text-[11px] text-km-text-secondary mt-0.5 leading-relaxed">
                                    {isRecruiter 
                                        ? "Automatically recommend top verified candidate profiles based on your active job descriptions."
                                        : "Match your verified profile and skills with relevant recruiter requirements."}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleToggle("enable_ai_recommendations")}
                                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 ${
                                    settings.enable_ai_recommendations ? "bg-km-primary" : "bg-km-border"
                                }`}
                                aria-label="Toggle automated candidate matchmaking"
                            >
                                <div className={`w-5 h-5 bg-white rounded-full transition-transform shadow-xs ${settings.enable_ai_recommendations ? "translate-x-5" : "translate-x-0"}`} />
                            </button>
                        </div>

                        {/* Search Indexing */}
                        <div className="py-3.5 flex items-center justify-between gap-4">
                            <div>
                                <p className="text-xs font-semibold text-km-text-primary">Search Engine & Google Jobs Indexing</p>
                                <p className="text-[11px] text-km-text-secondary mt-0.5 leading-relaxed">
                                    {isRecruiter
                                        ? "Allow Google Jobs and external job aggregators to crawl and display your active openings for organic traffic."
                                        : "Allow public search engines (Google Jobs) to index your candidate public profile link."}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleToggle("search_engine_indexing")}
                                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 ${
                                    settings.search_engine_indexing ? "bg-km-primary" : "bg-km-border"
                                }`}
                                aria-label="Toggle search engine indexing"
                            >
                                <div className={`w-5 h-5 bg-white rounded-full transition-transform shadow-xs ${settings.search_engine_indexing ? "translate-x-5" : "translate-x-0"}`} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: ACCOUNT SECURITY */}
            {activeTab === "security" && (
                <div className="space-y-5">
                    {/* Status Overview Card */}
                    <div className="bg-km-surface-card rounded-2xl p-6 border border-km-border shadow-xs space-y-4">
                        <div>
                            <h2 className="text-sm font-bold font-poppins text-km-text-primary">Security Credentials & Verification</h2>
                            <p className="text-xs text-km-text-secondary mt-0.5">Review verified contact credentials for account recovery.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-3.5 bg-km-surface rounded-xl border border-km-border flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <DeviceMobileIcon size={20} weight="regular" className="text-km-primary dark:text-km-link" aria-hidden="true" />
                                    <div>
                                        <p className="text-[10px] text-km-text-secondary font-semibold uppercase">Mobile Number</p>
                                        <p className="text-xs font-semibold text-km-text-primary font-mono">{userProfile?.mobile || "Not Linked"}</p>
                                    </div>
                                </div>
                                <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-semibold text-[10px] rounded-md border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1">
                                    <ShieldCheckIcon size={12} weight="bold" /> Verified
                                </span>
                            </div>

                            <div className="p-3.5 bg-km-surface rounded-xl border border-km-border flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <EnvelopeSimpleIcon size={20} weight="regular" className="text-km-primary dark:text-km-link" aria-hidden="true" />
                                    <div className="min-w-0">
                                        <p className="text-[10px] text-km-text-secondary font-semibold uppercase">Work Email</p>
                                        <p className="text-xs font-semibold text-km-text-primary truncate max-w-[140px] font-mono">{userProfile?.email || "Not Set"}</p>
                                    </div>
                                </div>
                                <span className={`px-2 py-0.5 font-semibold text-[10px] rounded-md border flex items-center gap-1 ${
                                    userProfile?.is_email_verified 
                                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60" 
                                        : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60"
                                }`}>
                                    <ShieldCheckIcon size={12} weight="bold" /> {userProfile?.is_email_verified ? "Verified" : "Pending"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Change Password Form */}
                    <div className="bg-km-surface-card rounded-2xl p-6 border border-km-border shadow-xs space-y-4">
                        <div className="flex items-center gap-2.5">
                            <KeyIcon size={20} weight="regular" className="text-km-primary dark:text-km-link" aria-hidden="true" />
                            <div>
                                <h3 className="text-sm font-bold font-poppins text-km-text-primary">Change Password</h3>
                                <p className="text-xs text-km-text-secondary mt-0.5">Update your account login password securely.</p>
                            </div>
                        </div>

                        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-xl pt-2">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-km-text-primary block">Current Password</label>
                                <input
                                    type="password"
                                    required
                                    placeholder="Enter current password"
                                    className="w-full px-3.5 py-2 rounded-xl border border-km-border bg-km-surface text-xs text-km-text-primary focus:border-km-primary outline-none transition-colors"
                                    value={passwordData.current_password}
                                    onChange={e => setPasswordData({ ...passwordData, current_password: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-km-text-primary block">New Password</label>
                                    <input
                                        type="password"
                                        required
                                        placeholder="Min 6 characters"
                                        className="w-full px-3.5 py-2 rounded-xl border border-km-border bg-km-surface text-xs text-km-text-primary focus:border-km-primary outline-none transition-colors"
                                        value={passwordData.new_password}
                                        onChange={e => setPasswordData({ ...passwordData, new_password: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-km-text-primary block">Confirm New Password</label>
                                    <input
                                        type="password"
                                        required
                                        placeholder="Re-type new password"
                                        className="w-full px-3.5 py-2 rounded-xl border border-km-border bg-km-surface text-xs text-km-text-primary focus:border-km-primary outline-none transition-colors"
                                        value={passwordData.confirm_password}
                                        onChange={e => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={updatingPassword}
                                className="px-5 py-2 rounded-xl bg-km-primary hover:bg-km-primary-dark text-white font-semibold text-xs shadow-xs transition-colors disabled:opacity-50"
                            >
                                {updatingPassword ? "Updating Password..." : "Update Password"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* TAB 4: PREFERENCES & LANGUAGE */}
            {activeTab === "preferences" && (
                <div className="bg-km-surface-card rounded-2xl p-6 border border-km-border shadow-xs space-y-6">
                    <div>
                        <h2 className="text-sm font-bold font-poppins text-km-text-primary">Regional & Language Preferences</h2>
                        <p className="text-xs text-km-text-secondary mt-0.5">Configure language display and portal localized settings.</p>
                    </div>

                    <div className="space-y-5 max-w-xl">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-km-text-primary block">Portal Display Language</label>
                            <select
                                className="w-full px-3.5 py-2.5 rounded-xl border border-km-border text-xs font-medium text-km-text-primary bg-km-surface focus:border-km-primary outline-none transition-colors"
                                value={settings.language}
                                onChange={e => handleSelectChange("language", e.target.value)}
                            >
                                <option value="en">English (Default)</option>
                                <option value="hi">हिंदी (Hindi)</option>
                                <option value="hinglish">Hinglish (Mix)</option>
                            </select>
                        </div>

                        <div className="p-4 bg-km-surface rounded-xl border border-km-border flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold text-km-text-primary">Color Theme Canvas</p>
                                <p className="text-[11px] text-km-text-secondary mt-0.5">High-contrast brand tokens applied across all dashboards.</p>
                            </div>
                            <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-km-primary dark:text-km-link text-xs font-semibold rounded-lg border border-blue-100 dark:border-blue-900">
                                System / Adaptive
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
