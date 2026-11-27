'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CircleNotchIcon, PencilSimpleIcon, PlusIcon, ReceiptIcon, ShieldCheckIcon, TagIcon } from '@phosphor-icons/react';
import { AdminModal, AdminPageHeader, AdminPanel, EmptyState, SkeletonRows, StatCard, StatusBadge, btn, cx, field, table } from '@/components/admin/ui';
import { Toggle } from '@/components/settings/SettingsPrimitives';
import { inr } from '@/lib/money';
import { notify } from '@/lib/notify';
import {
    recruiterPlansApi,
    type AdminPlanSubscription,
    type Limit,
    type PlanInput,
    type PlanSettings,
    type RecruiterPlan,
} from '@/lib/api/recruiterPlans';

const EMPTY_PLAN: PlanInput = {
    name: '', description: '', price: 499, period_days: 30,
    job_posts: 5, new_chats: 50, resume_downloads: null,
    ai_job_writer: false, sort_order: 0, is_active: true,
};

const day = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

const limitText = (n: Limit) => (n === null ? 'Unlimited' : n.toLocaleString('en-IN'));

/** A whole-number limit; empty means unlimited */
function LimitInput({ id, label, value, onChange, hint }: { id: string; label: string; value: Limit; onChange: (v: Limit) => void; hint?: string }) {
    return (
        <div>
            <label htmlFor={id} className={field.label}>{label}</label>
            <input
                id={id}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={value ?? ''}
                placeholder="Unlimited"
                onChange={(e) => {
                    const raw = e.target.value.trim();
                    onChange(raw === '' ? null : Math.max(0, Math.floor(Number(raw))));
                }}
                className={cx(field.input, 'font-inter tabular-nums')}
            />
            {hint && <p className={field.hint}>{hint}</p>}
        </div>
    );
}

/** Recruiter plans: the prices and limits the admin sells, the free monthly allowance, and the switch that makes limits block */
export default function RecruiterPlansAdminPage() {
    const [plans, setPlans] = useState<RecruiterPlan[] | null>(null);
    const [settings, setSettings] = useState<PlanSettings | null>(null);
    const [savingSettings, setSavingSettings] = useState(false);
    const [editing, setEditing] = useState<{ id: string | null; input: PlanInput } | null>(null);
    const [savingPlan, setSavingPlan] = useState(false);
    const [subs, setSubs] = useState<{ items: AdminPlanSubscription[]; total: number } | null>(null);
    const [page, setPage] = useState(1);

    const loadPlans = useCallback(async () => {
        try {
            setPlans((await recruiterPlansApi.adminPlans()).plans);
        } catch (err) {
            notify.error(err, "Couldn't load plans");
            setPlans([]);
        }
    }, []);

    useEffect(() => {
        void loadPlans();
        recruiterPlansApi.settings().then(setSettings).catch((err) => notify.error(err, "Couldn't load plan settings"));
    }, [loadPlans]);

    useEffect(() => {
        setSubs(null);
        recruiterPlansApi.subscriptions(page)
            .then((res) => setSubs({ items: res.items, total: res.total }))
            .catch((err) => {
                notify.error(err, "Couldn't load purchases");
                setSubs({ items: [], total: 0 });
            });
    }, [page]);

    const saveSettings = async (next: PlanSettings) => {
        setSavingSettings(true);
        try {
            setSettings(await recruiterPlansApi.saveSettings(next));
            notify.success('Plan settings saved');
        } catch (err) {
            notify.error(err, "Couldn't save plan settings");
        } finally {
            setSavingSettings(false);
        }
    };

    const savePlan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;
        setSavingPlan(true);
        try {
            if (editing.id) await recruiterPlansApi.updatePlan(editing.id, editing.input);
            else await recruiterPlansApi.createPlan(editing.input);
            notify.success(editing.id ? 'Plan updated' : 'Plan created');
            setEditing(null);
            void loadPlans();
        } catch (err) {
            notify.error(err, "Couldn't save the plan");
        } finally {
            setSavingPlan(false);
        }
    };

    const set = <K extends keyof PlanInput>(key: K, value: PlanInput[K]) =>
        setEditing((cur) => (cur ? { ...cur, input: { ...cur.input, [key]: value } } : cur));

    const pages = subs ? Math.max(1, Math.ceil(subs.total / 20)) : 1;

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Recruiter plans"
                description="Monthly plans recruiters buy for job posts and new chats. Bought plans keep the limits they were sold with, even if you edit the plan later."
                actions={
                    <button type="button" onClick={() => setEditing({ id: null, input: EMPTY_PLAN })} className={btn.primary}>
                        <PlusIcon size={16} weight="bold" aria-hidden="true" /> New plan
                    </button>
                }
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard label="Plans on sale" value={plans ? plans.filter((p) => p.is_active).length : '–'} hint={plans ? `${plans.length} plan${plans.length === 1 ? '' : 's'} in all` : undefined} icon={TagIcon} iconClassName="text-km-link" />
                <StatCard label="Plans bought" value={subs ? subs.total : '–'} hint="All time, by every recruiter" icon={ReceiptIcon} iconClassName="text-[#16A34A]" />
                <StatCard label="Limits" value={settings ? (settings.enforce ? 'On' : 'Off') : '–'} hint={settings ? (settings.enforce ? 'Recruiters are stopped at their limit' : 'Use is counted, nobody is stopped') : undefined} icon={ShieldCheckIcon} iconClassName={settings?.enforce ? 'text-[#16A34A]' : 'text-amber-500'} />
            </div>

            <AdminPanel title="Limits" description="Without a plan, recruiters get the free allowance each calendar month.">
                {!settings ? (
                    <SkeletonRows rows={2} />
                ) : (
                    <form
                        className="p-5 space-y-5"
                        onSubmit={(e) => {
                            e.preventDefault();
                            void saveSettings(settings);
                        }}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-semibold text-km-heading">Enforce limits</p>
                                <p className="text-sm text-km-text-secondary mt-0.5">
                                    {settings.enforce
                                        ? 'On: recruiters who use up their plan or free allowance can’t post jobs or start new chats until they buy a plan.'
                                        : 'Off: nothing is blocked. Usage is still counted, so you can see what plans would cover before switching on.'}
                                </p>
                            </div>
                            <Toggle
                                checked={settings.enforce}
                                disabled={savingSettings}
                                label="Enforce limits"
                                onChange={(enforce) => void saveSettings({ ...settings, enforce })}
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <LimitInput id="free-jobs" label="Free job posts a month" value={settings.free.job_posts}
                                onChange={(v) => setSettings({ ...settings, free: { ...settings.free, job_posts: v } })} />
                            <LimitInput id="free-chats" label="Free new chats a month" value={settings.free.new_chats}
                                onChange={(v) => setSettings({ ...settings, free: { ...settings.free, new_chats: v } })}
                                hint="Each person counts once a month" />
                            <LimitInput id="free-resumes" label="Free resume downloads a month" value={settings.free.resume_downloads}
                                onChange={(v) => setSettings({ ...settings, free: { ...settings.free, resume_downloads: v } })}
                                hint="Saved for the candidate database; not counted yet" />
                        </div>
                        <div className="flex justify-end">
                            <button type="submit" disabled={savingSettings} className={btn.secondary}>
                                {savingSettings && <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />}
                                Save free allowance
                            </button>
                        </div>
                    </form>
                )}
            </AdminPanel>

            <AdminPanel title="Plans">
                {plans === null ? (
                    <SkeletonRows rows={3} />
                ) : plans.length === 0 ? (
                    <EmptyState icon={TagIcon} title="No plans yet" description="Create a plan to sell job posts and chats to recruiters." />
                ) : (
                    <div className={table.wrap}>
                        <table className={table.table}>
                            <thead>
                                <tr>
                                    <th className={table.th}>Plan</th>
                                    <th className={table.th}>Price</th>
                                    <th className={table.th}>Job posts</th>
                                    <th className={table.th}>New chats</th>
                                    <th className={table.th}>Resume downloads</th>
                                    <th className={table.th}>Status</th>
                                    <th className={cx(table.th, 'text-right')}><span className="sr-only">Edit</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {plans.map((p) => (
                                    <tr key={p.id} className={table.row}>
                                        <td className={table.td}>
                                            <p className="font-medium text-km-heading">{p.name}</p>
                                            {p.ai_job_writer && <p className="text-xs text-km-text-secondary">Includes AI job description writer</p>}
                                        </td>
                                        <td className={cx(table.td, 'whitespace-nowrap font-inter')}>{inr(p.price)} for {p.period_days} days</td>
                                        <td className={cx(table.td, 'font-inter')}>{limitText(p.job_posts)}</td>
                                        <td className={cx(table.td, 'font-inter')}>{limitText(p.new_chats)}</td>
                                        <td className={cx(table.td, 'font-inter')}>{limitText(p.resume_downloads)}</td>
                                        <td className={table.td}>
                                            <StatusBadge tone={p.is_active ? 'green' : 'neutral'}>{p.is_active ? 'On sale' : 'Off sale'}</StatusBadge>
                                        </td>
                                        <td className={cx(table.td, 'text-right')}>
                                            <button
                                                type="button"
                                                onClick={() => setEditing({
                                                    id: p.id,
                                                    input: {
                                                        name: p.name, description: p.description, price: p.price, period_days: p.period_days,
                                                        job_posts: p.job_posts, new_chats: p.new_chats, resume_downloads: p.resume_downloads,
                                                        ai_job_writer: p.ai_job_writer, sort_order: p.sort_order, is_active: p.is_active,
                                                    },
                                                })}
                                                className={cx(btn.secondary, 'h-9 px-3')}
                                            >
                                                <PencilSimpleIcon size={15} aria-hidden="true" /> Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </AdminPanel>

            <AdminPanel title="Purchases">
                {subs === null ? (
                    <SkeletonRows rows={3} />
                ) : subs.items.length === 0 ? (
                    <EmptyState icon={ReceiptIcon} title="No plans bought yet" />
                ) : (
                    <>
                        <div className={table.wrap}>
                            <table className={table.table}>
                                <thead>
                                    <tr>
                                        <th className={table.th}>Recruiter</th>
                                        <th className={table.th}>Plan</th>
                                        <th className={table.th}>Paid</th>
                                        <th className={table.th}>Runs</th>
                                        <th className={table.th}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {subs.items.map((s) => (
                                        <tr key={s.id} className={table.row}>
                                            <td className={table.td}>
                                                <p className="font-medium text-km-heading">{s.company_name || s.recruiter_name || 'Recruiter'}</p>
                                                {s.company_name && s.recruiter_name && <p className="text-xs text-km-text-secondary">{s.recruiter_name}</p>}
                                            </td>
                                            <td className={table.td}>{s.plan_name}</td>
                                            <td className={cx(table.td, 'whitespace-nowrap font-inter')}>
                                                {inr(s.price)} <span className="text-km-text-secondary">by {s.channel === 'wallet' ? 'wallet' : 'online payment'}</span>
                                            </td>
                                            <td className={cx(table.td, 'whitespace-nowrap font-inter')}>{day(s.starts_at)} to {day(s.expires_at)}</td>
                                            <td className={table.td}>
                                                <StatusBadge tone={s.status === 'active' ? 'green' : 'red'}>{s.status === 'active' ? 'Active' : 'Refunded'}</StatusBadge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {pages > 1 && (
                            <div className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                                <span className="text-km-text-secondary font-inter">Page {page} of {pages}</span>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setPage((p) => p - 1)} disabled={page <= 1} className={cx(btn.secondary, 'h-9 px-3')}>Previous</button>
                                    <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= pages} className={cx(btn.secondary, 'h-9 px-3')}>Next</button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </AdminPanel>

            <AdminModal isOpen={!!editing} onClose={() => !savingPlan && setEditing(null)} title={editing?.id ? 'Edit plan' : 'New plan'} size="lg">
                {editing && (
                    <form onSubmit={savePlan} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                                <label htmlFor="plan-name" className={field.label}>Name</label>
                                <input id="plan-name" required maxLength={60} value={editing.input.name} onChange={(e) => set('name', e.target.value)}
                                    placeholder="For example: Starter" className={field.input} />
                            </div>
                            <div className="sm:col-span-2">
                                <label htmlFor="plan-desc" className={field.label}>Description</label>
                                <textarea id="plan-desc" rows={2} maxLength={300} value={editing.input.description}
                                    onChange={(e) => set('description', e.target.value)} placeholder="Who the plan is for, in one line"
                                    className={field.textarea} />
                            </div>
                            <div>
                                <label htmlFor="plan-price" className={field.label}>Price (₹)</label>
                                <input id="plan-price" type="number" min={1} max={100000} step="0.01" required value={editing.input.price}
                                    onChange={(e) => set('price', Number(e.target.value))} className={cx(field.input, 'font-inter tabular-nums')} />
                            </div>
                            <div>
                                <label htmlFor="plan-days" className={field.label}>Lasts (days)</label>
                                <input id="plan-days" type="number" min={1} max={366} step={1} required value={editing.input.period_days}
                                    onChange={(e) => set('period_days', Math.floor(Number(e.target.value)))} className={cx(field.input, 'font-inter tabular-nums')} />
                            </div>
                            <LimitInput id="plan-jobs" label="Job posts" value={editing.input.job_posts} onChange={(v) => set('job_posts', v)}
                                hint="Leave empty for unlimited" />
                            <LimitInput id="plan-chats" label="New chats" value={editing.input.new_chats} onChange={(v) => set('new_chats', v)}
                                hint="Chats the recruiter starts; replies and chats with their applicants are free" />
                            <LimitInput id="plan-resumes" label="Resume downloads" value={editing.input.resume_downloads}
                                onChange={(v) => set('resume_downloads', v)} hint="Shown on the plan; counted once the candidate database launches" />
                            <div>
                                <label htmlFor="plan-order" className={field.label}>Order on the page</label>
                                <input id="plan-order" type="number" step={1} value={editing.input.sort_order}
                                    onChange={(e) => set('sort_order', Math.floor(Number(e.target.value)))} className={cx(field.input, 'font-inter tabular-nums')} />
                                <p className={field.hint}>Lower numbers show first</p>
                            </div>
                        </div>
                        <div className="space-y-3 pt-1">
                            <label className="flex items-center justify-between gap-4">
                                <span>
                                    <span className="block text-sm font-medium text-km-heading">AI job description writer</span>
                                    <span className="block text-xs text-km-text-secondary">Shown as coming soon until the writer launches</span>
                                </span>
                                <Toggle checked={editing.input.ai_job_writer} onChange={(v) => set('ai_job_writer', v)} label="AI job description writer" />
                            </label>
                            <label className="flex items-center justify-between gap-4">
                                <span>
                                    <span className="block text-sm font-medium text-km-heading">On sale</span>
                                    <span className="block text-xs text-km-text-secondary">Off hides it from recruiters; plans already bought keep running</span>
                                </span>
                                <Toggle checked={editing.input.is_active} onChange={(v) => set('is_active', v)} label="On sale" />
                            </label>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setEditing(null)} disabled={savingPlan} className={btn.secondary}>Cancel</button>
                            <button type="submit" disabled={savingPlan} className={btn.primary}>
                                {savingPlan && <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />}
                                {editing.id ? 'Save plan' : 'Create plan'}
                            </button>
                        </div>
                    </form>
                )}
            </AdminModal>
        </div>
    );
}
