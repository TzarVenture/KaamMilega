"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { BellIcon, CheckIcon, GlobeIcon, LockIcon, ShieldCheckIcon, UserCircleIcon } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import api from "@/lib/axios";
import { errorMessage } from "@/lib/account";
import { FEATURES } from "@/config/features";
import { FullPageSkeleton } from "@/components/ui/LoadingSkeleton";
import ThemeToggle from "@/components/km/ThemeToggle";
import { Badge, SettingRow, SettingsCard, Toggle, inputClass } from "@/components/settings/SettingsPrimitives";
import SecuritySection from "@/components/settings/SecuritySection";
import AccountSection from "@/components/settings/AccountSection";

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

// Matches DefaultUserSettings in the backend (km-backend/internal/features/user/domain.go)
const DEFAULT_SETTINGS: UserSettingsState = {
    email_job_alerts: true,
    email_application_updates: true,
    email_marketing: false,
    sms_alerts: true,
    push_notifications: true,
    profile_visibility: "public",
    language: "en",
    enable_ai_recommendations: true,
    search_engine_indexing: true,
};

interface SettingsProfile {
    email?: string;
    is_email_verified?: boolean;
    mobile?: string;
    otp_verified_at?: string | null;
    has_password?: boolean;
}

type Tab = "notifications" | "privacy" | "security" | "preferences" | "account";

const SoonBadge = () => <Badge tone="soon">Coming soon</Badge>;

export default function SettingsView({ mode = "candidate" }: SettingsViewProps) {
    const isRecruiter = mode === "recruiter";
    const router = useRouter();
    const searchParams = useSearchParams();

    const tabs: { id: Tab; label: string; Icon: Icon }[] = [
        { id: "notifications", label: "Notifications", Icon: BellIcon },
        ...(!isRecruiter ? [{ id: "privacy" as Tab, label: "Privacy", Icon: ShieldCheckIcon }] : []),
        { id: "security", label: "Sign-in & security", Icon: LockIcon },
        { id: "preferences", label: "Preferences", Icon: GlobeIcon },
        { id: "account", label: "Account", Icon: UserCircleIcon },
    ];

    const requested = searchParams?.get("tab") as Tab | null;
    const activeTab: Tab = requested && tabs.some((t) => t.id === requested) ? requested : "notifications";

    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<SettingsProfile | null>(null);
    const [settings, setSettings] = useState<UserSettingsState>(DEFAULT_SETTINGS);
    const [savedAt, setSavedAt] = useState(0);
    // Saves are sent in order so a slower earlier request can't overwrite a later choice
    const saveQueue = useRef<Promise<void>>(Promise.resolve());

    const loadProfile = useCallback(
        () => api.get("/user/profile").then((p) => setProfile(p as SettingsProfile)).catch(() => null),
        []
    );

    useEffect(() => {
        Promise.all([
            api.get("/user/settings").then((s) => setSettings({ ...DEFAULT_SETTINGS, ...(s as Partial<UserSettingsState>) })).catch(() => {
                toast.error("Couldn’t load your saved settings. Showing defaults.");
            }),
            loadProfile(),
        ]).finally(() => setLoading(false));
    }, [loadProfile]);

    const update = <K extends keyof UserSettingsState>(field: K, value: UserSettingsState[K]) => {
        const previous = settings;
        const next = { ...settings, [field]: value };
        setSettings(next);
        saveQueue.current = saveQueue.current.then(async () => {
            try {
                const saved = (await api.put("/user/settings", next)) as Partial<UserSettingsState> | null;
                if (saved && typeof saved === "object") setSettings((s) => ({ ...s, ...saved }));
                setSavedAt(Date.now());
            } catch (err) {
                setSettings(previous);
                toast.error(errorMessage(err, "Couldn’t save that change. Please try again."));
            }
        });
    };

    useEffect(() => {
        if (!savedAt) return;
        const t = setTimeout(() => setSavedAt(0), 2000);
        return () => clearTimeout(t);
    }, [savedAt]);

    const selectTab = (id: Tab) => {
        const params = new URLSearchParams(searchParams?.toString());
        params.set("tab", id);
        router.replace(`?${params.toString()}`, { scroll: false });
    };

    if (loading) return <FullPageSkeleton />;

    const emailVerified = Boolean(profile?.is_email_verified);
    const toggle = (field: keyof UserSettingsState, label: string) => (
        <Toggle checked={Boolean(settings[field])} onChange={(v) => update(field, v as never)} label={label} />
    );

    return (
        <div className="max-w-5xl mx-auto pb-16">
            <ToastContainer position="top-center" autoClose={2500} hideProgressBar />

            <div className="flex items-end justify-between gap-4 pb-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-km-heading">{isRecruiter ? "Employer account settings" : "Settings"}</h1>
                    <p className="mt-1 text-sm text-km-text-secondary">
                        {isRecruiter ? "Alerts, sign-in security and your employer account." : "Notifications, privacy, sign-in and your account."}
                    </p>
                </div>
                <p aria-live="polite" className={`text-sm font-medium text-emerald-700 inline-flex items-center gap-1 transition-opacity ${savedAt ? "opacity-100" : "opacity-0"}`}>
                    <CheckIcon size={14} weight="bold" aria-hidden="true" /> Saved
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
                {/* Section nav: column on desktop, scrolling row on mobile */}
                <nav aria-label="Settings sections" className="md:sticky md:top-24 self-start">
                    <ul className="flex md:flex-col gap-1 overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
                        {tabs.map(({ id, label, Icon }) => {
                            const active = id === activeTab;
                            return (
                                <li key={id} className="shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => selectTab(id)}
                                        aria-current={active ? "page" : undefined}
                                        className={`w-full flex items-center gap-2.5 h-10 px-3 rounded-xl text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                                            active ? "bg-km-surface-card text-km-heading border border-km-border shadow-xs" : "text-km-text-secondary hover:text-km-text-primary hover:bg-km-surface-card/60 border border-transparent"
                                        }`}
                                    >
                                        <Icon size={18} weight={active ? "fill" : "regular"} aria-hidden="true" />
                                        {label}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                <div className="min-w-0 space-y-5">
                    {activeTab === "notifications" && (
                        <>
                            <SettingsCard title="Email" description={emailVerified ? `Sent to ${profile?.email}` : undefined}>
                                {!isRecruiter && (
                                    <>
                                        <SettingRow
                                            title="Job alerts"
                                            description={
                                                emailVerified
                                                    ? "A daily email with new jobs that match your city, skills and job title."
                                                    : "A daily email with new matching jobs. Verify your email in Sign-in & security to receive it."
                                            }
                                            control={toggle("email_job_alerts", "Job alerts")}
                                        />
                                        <SettingRow
                                            title="Application updates"
                                            description="When an employer shortlists you, schedules an interview or changes your application status."
                                            control={toggle("email_application_updates", "Application updates")}
                                        />
                                    </>
                                )}
                                <SettingRow
                                    title="Product news & career tips"
                                    description="Occasional emails about new features, salary insights and hiring events. Off unless you turn it on."
                                    control={toggle("email_marketing", "Product news and career tips")}
                                />
                            </SettingsCard>

                            <SettingsCard title="SMS & push" description="Your choice is saved now and applied as soon as these channels launch.">
                                <SettingRow
                                    title="Urgent SMS alerts"
                                    badge={<SoonBadge />}
                                    description={isRecruiter
                                        ? "Priority texts when candidates confirm or reschedule interviews."
                                        : "Interview invitations and employer call requests by text message."}
                                    control={toggle("sms_alerts", "Urgent SMS alerts")}
                                />
                                <SettingRow
                                    title="Push notifications"
                                    badge={<SoonBadge />}
                                    description="Real-time alerts in the KaamMilega app and your browser."
                                    control={toggle("push_notifications", "Push notifications")}
                                />
                            </SettingsCard>
                        </>
                    )}

                    {activeTab === "privacy" && !isRecruiter && (
                        <>
                            <SettingsCard title="Who can see your profile">
                                <fieldset className="pt-4">
                                    <legend className="sr-only">Profile visibility</legend>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        {[
                                            { id: "public", title: "Everyone", desc: "Employers and members can find and view your profile." },
                                            { id: "connections", title: "Connections only", desc: "People can find you, but only connections and employers you apply to see your full profile." },
                                            { id: "private", title: "Only employers I apply to", desc: "Hidden from search and suggestions. Employers see you only when you apply." },
                                        ].map((opt) => {
                                            const selected = settings.profile_visibility === opt.id;
                                            return (
                                                <label
                                                    key={opt.id}
                                                    className={`relative p-4 rounded-xl border cursor-pointer transition-colors ${
                                                        selected ? "border-[#0B5ED7] bg-blue-50 ring-1 ring-[#0B5ED7]" : "border-km-border hover:border-slate-400"
                                                    }`}
                                                >
                                                    <input
                                                        type="radio"
                                                        name="profile_visibility"
                                                        value={opt.id}
                                                        checked={selected}
                                                        onChange={() => update("profile_visibility", opt.id as UserSettingsState["profile_visibility"])}
                                                        className="sr-only"
                                                    />
                                                    <span className="flex items-center justify-between gap-2">
                                                        <span className="text-sm font-semibold text-km-text-primary">{opt.title}</span>
                                                        <span
                                                            aria-hidden="true"
                                                            className={`h-4 w-4 rounded-full border-2 ${selected ? "border-[#0B5ED7] bg-[#0B5ED7] shadow-[inset_0_0_0_2px_white]" : "border-slate-300"}`}
                                                        />
                                                    </span>
                                                    <span className="mt-1.5 block text-xs text-km-text-secondary leading-relaxed">{opt.desc}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </fieldset>
                            </SettingsCard>

                            <SettingsCard title="Discovery">
                                <SettingRow
                                    title="Suggest my profile to others"
                                    description="Show you in “People you may know” and skill-based suggestions to other members and employers."
                                    control={toggle("enable_ai_recommendations", "Suggest my profile to others")}
                                />
                                <SettingRow
                                    title="Search engines"
                                    badge={<Badge tone="neutral">Applies when public profiles launch</Badge>}
                                    description="Let Google and other search engines show your public profile. Only applies while your profile is visible to everyone."
                                    control={toggle("search_engine_indexing", "Search engines")}
                                />
                            </SettingsCard>
                        </>
                    )}

                    {activeTab === "security" && <SecuritySection profile={profile || {}} onPasswordSet={loadProfile} />}

                    {activeTab === "preferences" && (
                        <SettingsCard title="Display">
                            <SettingRow
                                title="Language"
                                badge={<SoonBadge />}
                                description="Saved now. Hindi and Hinglish screens are on the way."
                                control={
                                    <select
                                        aria-label="Language"
                                        value={settings.language}
                                        onChange={(e) => update("language", e.target.value as UserSettingsState["language"])}
                                        className={`${inputClass} w-40`}
                                    >
                                        <option value="en">English</option>
                                        <option value="hi">हिन्दी</option>
                                        <option value="hinglish">Hinglish</option>
                                    </select>
                                }
                            />
                            {FEATURES.DARK_MODE && (
                                <div className="py-4">
                                    <p className="text-sm font-semibold text-km-text-primary">Theme</p>
                                    <p className="mt-0.5 mb-3 text-sm text-km-text-secondary">System follows your device’s light or dark setting.</p>
                                    <ThemeToggle className="max-w-sm" />
                                </div>
                            )}
                        </SettingsCard>
                    )}

                    {activeTab === "account" && <AccountSection />}
                </div>
            </div>
        </div>
    );
}
