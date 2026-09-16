"use client";

import React, { useEffect, useState } from "react";
import api from "@/lib/axios";
import { toast, ToastContainer } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import {
    Bell,
    Shield,
    Lock,
    Globe,
    CheckCircle2,
    Save,
    Sparkles,
    Eye,
    Smartphone,
    Mail,
    Key,
    ShieldCheck,
    Check,
    RefreshCw,
    SlidersHorizontal
} from "lucide-react";
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
    const [activeTab, setActiveTab] = useState<"notifications" | "privacy" | "security" | "preferences">("notifications");
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
        <div className="max-w-5xl mx-auto space-y-8 pb-16">
            <ToastContainer />

            {/* Header Title */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/80">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <SlidersHorizontal className="w-8 h-8 text-km-primary" />
                        Account & Preference Settings
                    </h1>
                    <p className="text-sm font-semibold text-slate-500 mt-1">
                        Manage your notification preferences, privacy visibility, and account security controls.
                    </p>
                </div>
                {saving && (
                    <div className="flex items-center gap-2 text-xs font-extrabold text-km-primary bg-blue-50 px-3.5 py-2 rounded-xl border border-blue-100 animate-pulse">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving changes...
                    </div>
                )}
            </div>

            {/* Main Tabs Header */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-slate-200/60">
                <button
                    onClick={() => setActiveTab("notifications")}
                    className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-xs font-bold transition-all border shrink-0 ${
                        activeTab === "notifications"
                            ? "bg-km-primary text-white border-km-primary shadow-md shadow-blue-900/20"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                >
                    <Bell className="w-4 h-4" /> Notifications
                </button>
                <button
                    onClick={() => setActiveTab("privacy")}
                    className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-xs font-bold transition-all border shrink-0 ${
                        activeTab === "privacy"
                            ? "bg-km-primary text-white border-km-primary shadow-md shadow-blue-900/20"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                >
                    <Eye className="w-4 h-4" /> Privacy & Visibility
                </button>
                <button
                    onClick={() => setActiveTab("security")}
                    className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-xs font-bold transition-all border shrink-0 ${
                        activeTab === "security"
                            ? "bg-km-primary text-white border-km-primary shadow-md shadow-blue-900/20"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                >
                    <Lock className="w-4 h-4" /> Account Security
                </button>
                <button
                    onClick={() => setActiveTab("preferences")}
                    className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-xs font-bold transition-all border shrink-0 ${
                        activeTab === "preferences"
                            ? "bg-km-primary text-white border-km-primary shadow-md shadow-blue-900/20"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                >
                    <Globe className="w-4 h-4" /> Preferences & Language
                </button>
            </div>

            {/* TAB 1: NOTIFICATIONS */}
            {activeTab === "notifications" && (
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
                    <div>
                        <h2 className="text-lg font-black text-slate-900 tracking-tight">Notification Channels & Alerts</h2>
                        <p className="text-xs text-slate-500 font-semibold mt-1">Control how and when Kaam Milega sends job recommendations and application alerts.</p>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {/* Job Alerts */}
                        <div className="py-4 flex items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-bold text-slate-900">Email Job Alerts</p>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">Receive daily emails about new job openings matching your profile and skills.</p>
                            </div>
                            <button
                                onClick={() => handleToggle("email_job_alerts")}
                                className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 shrink-0 ${
                                    settings.email_job_alerts ? "bg-km-primary" : "bg-slate-300"
                                }`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${settings.email_job_alerts ? "translate-x-6" : "translate-x-0"}`} />
                            </button>
                        </div>

                        {/* Application Updates */}
                        <div className="py-4 flex items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-bold text-slate-900">Application Status Notifications</p>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">Get notified instantly when a recruiter reviews, shortlists, or schedules an interview for your application.</p>
                            </div>
                            <button
                                onClick={() => handleToggle("email_application_updates")}
                                className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 shrink-0 ${
                                    settings.email_application_updates ? "bg-km-primary" : "bg-slate-300"
                                }`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${settings.email_application_updates ? "translate-x-6" : "translate-x-0"}`} />
                            </button>
                        </div>

                        {/* SMS Alerts */}
                        <div className="py-4 flex items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-bold text-slate-900">Urgent SMS Alerts</p>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">Receive high-priority SMS messages for interview invitations and recruiter call requests.</p>
                            </div>
                            <button
                                onClick={() => handleToggle("sms_alerts")}
                                className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 shrink-0 ${
                                    settings.sms_alerts ? "bg-km-primary" : "bg-slate-300"
                                }`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${settings.sms_alerts ? "translate-x-6" : "translate-x-0"}`} />
                            </button>
                        </div>

                        {/* Push Notifications */}
                        <div className="py-4 flex items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-bold text-slate-900">Browser & Mobile Push Notifications</p>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">Allow real-time push alerts on your desktop or mobile device when active.</p>
                            </div>
                            <button
                                onClick={() => handleToggle("push_notifications")}
                                className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 shrink-0 ${
                                    settings.push_notifications ? "bg-km-primary" : "bg-slate-300"
                                }`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${settings.push_notifications ? "translate-x-6" : "translate-x-0"}`} />
                            </button>
                        </div>

                        {/* Marketing Updates */}
                        <div className="py-4 flex items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-bold text-slate-900">Product Updates & Career News</p>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">Occasional news regarding platform features, salary insights, and career fairs.</p>
                            </div>
                            <button
                                onClick={() => handleToggle("email_marketing")}
                                className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 shrink-0 ${
                                    settings.email_marketing ? "bg-km-primary" : "bg-slate-300"
                                }`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${settings.email_marketing ? "translate-x-6" : "translate-x-0"}`} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: PRIVACY & VISIBILITY */}
            {activeTab === "privacy" && (
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
                    <div>
                        <h2 className="text-lg font-black text-slate-900 tracking-tight">Privacy & Profile Visibility</h2>
                        <p className="text-xs text-slate-500 font-semibold mt-1">Determine who can discover your candidate profile and experience details.</p>
                    </div>

                    <div className="space-y-4">
                        <label className="text-xs font-black uppercase tracking-wider text-slate-400 block">Profile Visibility Mode</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                { id: "public", title: "Public (Recommended)", desc: "Visible to all verified employers, recruiters, and network connections." },
                                { id: "connections", title: "Connections Only", desc: "Only recruiters you interact with or connect to can view your full details." },
                                { id: "private", title: "Private / Hidden", desc: "Hidden from general candidate searches. Only visible when you apply directly." }
                            ].map((opt) => (
                                <div
                                    key={opt.id}
                                    onClick={() => handleSelectChange("profile_visibility", opt.id)}
                                    className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                                        settings.profile_visibility === opt.id
                                            ? "bg-blue-50/70 border-km-primary ring-2 ring-km-primary/20"
                                            : "bg-slate-50/50 border-slate-200 hover:border-slate-300"
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-bold text-slate-900">{opt.title}</p>
                                        {settings.profile_visibility === opt.id && <CheckCircle2 className="w-5 h-5 text-km-primary" />}
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium leading-relaxed">{opt.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="divide-y divide-slate-100 pt-4">
                        {/* AI Match */}
                        <div className="py-4 flex items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-km-accent" /> AI Job Matching & Recommendations
                                </p>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">Allow automated algorithms to match your resume skills with recruiter searches.</p>
                            </div>
                            <button
                                onClick={() => handleToggle("enable_ai_recommendations")}
                                className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 shrink-0 ${
                                    settings.enable_ai_recommendations ? "bg-km-primary" : "bg-slate-300"
                                }`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${settings.enable_ai_recommendations ? "translate-x-6" : "translate-x-0"}`} />
                            </button>
                        </div>

                        {/* Search Indexing */}
                        <div className="py-4 flex items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-bold text-slate-900">Search Engine Indexing</p>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">Allow public search engines (Google Jobs) to index your candidate public profile link.</p>
                            </div>
                            <button
                                onClick={() => handleToggle("search_engine_indexing")}
                                className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 shrink-0 ${
                                    settings.search_engine_indexing ? "bg-km-primary" : "bg-slate-300"
                                }`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${settings.search_engine_indexing ? "translate-x-6" : "translate-x-0"}`} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: ACCOUNT SECURITY */}
            {activeTab === "security" && (
                <div className="space-y-6">
                    {/* Status Overview Card */}
                    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
                        <div>
                            <h2 className="text-lg font-black text-slate-900 tracking-tight">Security Credentials & Verification</h2>
                            <p className="text-xs text-slate-500 font-semibold mt-1">Review authenticated devices and contact verification status.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-km-primary flex items-center justify-center font-bold">
                                        <Smartphone className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 font-extrabold uppercase">Mobile Verification</p>
                                        <p className="text-sm font-bold text-slate-900">{userProfile?.mobile || "Not Linked"}</p>
                                    </div>
                                </div>
                                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 font-extrabold text-[10px] rounded-full flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3" /> Verified
                                </span>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-orange-100 text-km-accent-dark flex items-center justify-center font-bold">
                                        <Mail className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 font-extrabold uppercase">Email Verification</p>
                                        <p className="text-sm font-bold text-slate-900 truncate max-w-40">{userProfile?.email || "Not Set"}</p>
                                    </div>
                                </div>
                                <span className={`px-2.5 py-1 font-extrabold text-[10px] rounded-full flex items-center gap-1 ${
                                    userProfile?.is_email_verified ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                }`}>
                                    <ShieldCheck className="w-3 h-3" /> {userProfile?.is_email_verified ? "Verified" : "Pending"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Change Password Form */}
                    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-km-primary flex items-center justify-center font-bold border border-blue-100">
                                <Key className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-900 tracking-tight">Change Password</h3>
                                <p className="text-xs text-slate-500 font-semibold">Update your account login credentials securely.</p>
                            </div>
                        </div>

                        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-xl">
                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">Current Password</label>
                                <input
                                    type="password"
                                    required
                                    placeholder="Enter current password"
                                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs font-bold focus:border-km-primary focus:ring-2 focus:ring-km-primary/20 outline-none transition-all"
                                    value={passwordData.current_password}
                                    onChange={e => setPasswordData({ ...passwordData, current_password: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">New Password</label>
                                    <input
                                        type="password"
                                        required
                                        placeholder="Min 6 characters"
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs font-bold focus:border-km-primary focus:ring-2 focus:ring-km-primary/20 outline-none transition-all"
                                        value={passwordData.new_password}
                                        onChange={e => setPasswordData({ ...passwordData, new_password: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Confirm New Password</label>
                                    <input
                                        type="password"
                                        required
                                        placeholder="Re-type new password"
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs font-bold focus:border-km-primary focus:ring-2 focus:ring-km-primary/20 outline-none transition-all"
                                        value={passwordData.confirm_password}
                                        onChange={e => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={updatingPassword}
                                className="px-6 py-3 rounded-2xl bg-km-primary hover:bg-km-primary-dark text-white font-bold text-xs shadow-md shadow-blue-900/20 transition-all active:scale-[0.98] disabled:opacity-50"
                            >
                                {updatingPassword ? "Updating Password..." : "Update Password"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* TAB 4: PREFERENCES & LANGUAGE */}
            {activeTab === "preferences" && (
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
                    <div>
                        <h2 className="text-lg font-black text-slate-900 tracking-tight">App Regional Preferences</h2>
                        <p className="text-xs text-slate-500 font-semibold mt-1">Configure language display and portal localized settings.</p>
                    </div>

                    <div className="space-y-6 max-w-xl">
                        <div>
                            <label className="text-xs font-bold text-slate-700 block mb-2">Display Language</label>
                            <select
                                className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-900 bg-white focus:border-km-primary focus:ring-2 focus:ring-km-primary/20 outline-none transition-all"
                                value={settings.language}
                                onChange={e => handleSelectChange("language", e.target.value)}
                            >
                                <option value="en">English (Default)</option>
                                <option value="hi">हिंदी (Hindi)</option>
                                <option value="hinglish">Hinglish (Mix)</option>
                            </select>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-bold text-slate-900">Color Theme Canvas</p>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">High-contrast brand canvas (#F8FAFC) enabled.</p>
                            </div>
                            <span className="px-3 py-1.5 bg-blue-100 text-km-primary text-xs font-black rounded-xl">Light Mode</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
