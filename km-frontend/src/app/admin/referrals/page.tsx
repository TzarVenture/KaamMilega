'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CircleNotchIcon, HandCoinsIcon, UsersThreeIcon } from '@phosphor-icons/react';
import {
    AdminModal, AdminPageHeader, AdminPanel, EmptyState, FilterTabs, SkeletonRows, StatusBadge,
    btn, cx, field, table, type BadgeTone,
} from '@/components/admin/ui';
import { Toggle } from '@/components/settings/SettingsPrimitives';
import { inr } from '@/lib/money';
import { notify } from '@/lib/notify';
import {
    referralsApi,
    type AdminReferral,
    type ReferralAggregator,
    type ReferralPayout,
    type ReferralSettings,
    type ReferralStatus,
} from '@/lib/api/referrals';

const IST = 'Asia/Kolkata';
const day = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: IST }) : '—';

const STATUS: Record<ReferralStatus, { label: string; tone: BadgeTone }> = {
    pending: { label: 'Joined, not paid', tone: 'neutral' },
    paid: { label: 'Paid, waiting', tone: 'amber' },
    released: { label: 'Counted', tone: 'green' },
    cancelled: { label: 'Cancelled', tone: 'red' },
};

/** first_payment is "order:<id>" (paid online) or "wallet:<id>" (spent from the wallet) */
const paidBy = (ref?: string) => (ref?.startsWith('wallet:') ? 'From wallet' : 'Online');

function Person({ name, mobile }: { name?: string; mobile?: string }) {
    return (
        <div className="min-w-0">
            <p className="font-medium text-km-heading truncate">{name || 'Unknown'}</p>
            {mobile && <p className="text-xs text-km-text-secondary font-inter">{mobile}</p>}
        </div>
    );
}

function NumberField({ id, label, value, onChange, hint, step = 1 }: {
    id: string; label: string; value: number; onChange: (v: number) => void; hint?: string; step?: number;
}) {
    return (
        <div>
            <label htmlFor={id} className={field.label}>{label}</label>
            <input id={id} type="number" min={0} step={step} inputMode="decimal" value={Number.isFinite(value) ? value : ''}
                onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                className={cx(field.input, 'font-inter tabular-nums')} />
            {hint && <p className={field.hint}>{hint}</p>}
        </div>
    );
}

function SettingsPanel() {
    const [s, setS] = useState<ReferralSettings | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        referralsApi.settings().then(setS).catch((err) => notify.error(err, "Couldn't load referral settings"));
    }, []);

    const set = <K extends keyof ReferralSettings>(k: K, v: ReferralSettings[K]) => setS((cur) => (cur ? { ...cur, [k]: v } : cur));

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!s) return;
        setSaving(true);
        try {
            setS(await referralsApi.saveSettings(s));
            notify.success('Referral settings saved');
        } catch (err) {
            notify.error(err, "Couldn't save the settings");
        } finally {
            setSaving(false);
        }
    };

    return (
        <AdminPanel title="Rules" description="Changes apply to referrals counted from now on. Rewards already given stay as they are.">
            {!s ? <SkeletonRows rows={3} /> : (
                <form onSubmit={save} className="p-5 space-y-5">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-sm font-medium text-km-heading">Invites on</p>
                            <p className={field.hint}>When off, new sign-ups can&apos;t be linked. People already linked still count.</p>
                        </div>
                        <Toggle checked={s.enabled} onChange={(v: boolean) => set('enabled', v)} label="Invites on" />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <NumberField id="member" label="Member reward per paid invite (₹)" value={s.member_reward} onChange={(v) => set('member_reward', v)}
                            hint="Wallet credit for normal members. 0 turns it off." />
                        <NumberField id="wait" label="Wait after first payment (days)" value={s.wait_days} onChange={(v) => set('wait_days', Math.floor(v))}
                            hint="A refund inside this time cancels the referral." />
                        <NumberField id="group" label="Aggregator group size" value={s.aggregator_group} onChange={(v) => set('aggregator_group', Math.floor(v))}
                            hint="Paid invites needed for one aggregator reward." />
                        <div />
                        <NumberField id="credit" label="Aggregator wallet credit per group (₹)" value={s.aggregator_credit} onChange={(v) => set('aggregator_credit', v)} />
                        <NumberField id="cash" label="Aggregator cash per group (₹)" value={s.aggregator_cash} onChange={(v) => set('aggregator_cash', v)}
                            hint="Recorded as owed. You pay it outside the app and mark it paid below." />
                    </div>
                    <div className="flex justify-end">
                        <button type="submit" disabled={saving} className={btn.primary}>
                            {saving && <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />} Save rules
                        </button>
                    </div>
                </form>
            )}
        </AdminPanel>
    );
}

function AggregatorsPanel({ onChange }: { onChange: () => void }) {
    const [list, setList] = useState<ReferralAggregator[] | null>(null);
    const [who, setWho] = useState('');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState<string | null>(null);

    const load = useCallback(() => {
        referralsApi.aggregators()
            .then((r) => setList(r.items ?? []))
            .catch((err) => { notify.error(err, "Couldn't load aggregators"); setList([]); });
    }, []);
    useEffect(load, [load]);

    const change = async (user: string, active: boolean, n = '') => {
        setBusy(user);
        try {
            await referralsApi.setAggregator(user, active, n);
            notify.success(active ? 'Aggregator approved' : 'Aggregator removed');
            if (active) { setWho(''); setNote(''); }
            load();
            onChange();
        } catch (err) {
            notify.error(err, "Couldn't update the aggregator");
        } finally {
            setBusy(null);
        }
    };

    return (
        <AdminPanel title="Aggregators" description="Approved members earn group rewards instead of the per-invite member reward.">
            <form onSubmit={(e) => { e.preventDefault(); if (who.trim()) void change(who.trim(), true, note); }}
                className="p-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end border-b border-km-border">
                <div>
                    <label htmlFor="agg-who" className={field.label}>Mobile number or user id</label>
                    <input id="agg-who" value={who} onChange={(e) => setWho(e.target.value)} className={cx(field.input, 'font-inter')} placeholder="98XXXXXXXX" />
                </div>
                <div>
                    <label htmlFor="agg-note" className={field.label}>Note (optional)</label>
                    <input id="agg-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className={field.input} placeholder="e.g. Pune area agent" />
                </div>
                <button type="submit" disabled={!who.trim() || busy !== null} className={btn.primary}>Approve</button>
            </form>
            {list === null ? <SkeletonRows rows={2} /> : list.length === 0 ? (
                <EmptyState icon={UsersThreeIcon} title="No aggregators yet" description="Approve a member above by their mobile number." />
            ) : (
                <div className={table.wrap}>
                    <table className={table.table}>
                        <thead>
                            <tr>
                                <th className={table.th}>Member</th>
                                <th className={table.th}>Counted</th>
                                <th className={table.th}>Waiting</th>
                                <th className={table.th}>Credit given</th>
                                <th className={table.th}>Cash owed</th>
                                <th className={table.th}>Status</th>
                                <th className={table.th}><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {list.map((a) => (
                                <tr key={a.user_id} className={table.row}>
                                    <td className={table.td}>
                                        <Person name={a.name} mobile={a.mobile} />
                                        {a.note && <p className="text-xs text-km-text-muted mt-0.5">{a.note}</p>}
                                    </td>
                                    <td className={cx(table.td, 'font-inter tabular-nums')}>{a.released}</td>
                                    <td className={cx(table.td, 'font-inter tabular-nums')}>{a.waiting}</td>
                                    <td className={cx(table.td, 'font-inter tabular-nums')}>{inr(a.credit_earned)}</td>
                                    <td className={cx(table.td, 'font-inter tabular-nums')}>{inr(a.cash_owed)}</td>
                                    <td className={table.td}>
                                        <StatusBadge tone={a.active ? 'green' : 'neutral'}>{a.active ? `Approved ${day(a.approved_at)}` : 'Removed'}</StatusBadge>
                                    </td>
                                    <td className={cx(table.td, 'text-right')}>
                                        <button type="button" disabled={busy !== null} onClick={() => void change(a.user_id, !a.active, a.note)}
                                            className={a.active ? btn.ghost : btn.secondary}>
                                            {a.active ? 'Remove' : 'Approve again'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </AdminPanel>
    );
}

function PayoutsPanel({ refreshKey }: { refreshKey: number }) {
    const [owed, setOwed] = useState<'owed' | 'all'>('owed');
    const [page, setPage] = useState(1);
    const [data, setData] = useState<{ items: ReferralPayout[]; total: number } | null>(null);
    const [paying, setPaying] = useState<ReferralPayout | null>(null);
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);

    const load = useCallback(() => {
        setData(null);
        referralsApi.payouts(owed === 'owed', page)
            .then((r) => setData({ items: r.items ?? [], total: r.total }))
            .catch((err) => { notify.error(err, "Couldn't load group rewards"); setData({ items: [], total: 0 }); });
    }, [owed, page]);
    useEffect(load, [load, refreshKey]);

    const markPaid = async () => {
        if (!paying) return;
        setSaving(true);
        try {
            await referralsApi.markCashPaid(paying.id, note.trim());
            notify.success('Marked as paid');
            setPaying(null);
            setNote('');
            load();
        } catch (err) {
            notify.error(err, "Couldn't mark it paid");
        } finally {
            setSaving(false);
        }
    };

    const pages = data ? Math.max(1, Math.ceil(data.total / 20)) : 1;

    return (
        <AdminPanel title="Aggregator rewards" description="The wallet credit is added automatically. Pay the cash half yourself (UPI, bank), then mark it paid here."
            actions={<FilterTabs value={owed} onChange={(v) => { setOwed(v); setPage(1); }}
                options={[{ value: 'owed', label: 'Cash owed' }, { value: 'all', label: 'All' }]} />}>
            {data === null ? <SkeletonRows rows={3} /> : data.items.length === 0 ? (
                <EmptyState icon={HandCoinsIcon} title={owed === 'owed' ? 'No cash owed' : 'No group rewards yet'} />
            ) : (
                <div className={table.wrap}>
                    <table className={table.table}>
                        <thead>
                            <tr>
                                <th className={table.th}>Aggregator</th>
                                <th className={table.th}>Reward</th>
                                <th className={table.th}>Credit</th>
                                <th className={table.th}>Cash</th>
                                <th className={table.th}>Earned on</th>
                                <th className={table.th}>Cash</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.items.map((p) => (
                                <tr key={p.id} className={table.row}>
                                    <td className={table.td}><Person name={p.user_name} mobile={p.user_mobile} /></td>
                                    <td className={cx(table.td, 'font-inter tabular-nums')}>#{p.batch_no} · {p.referrals} invites</td>
                                    <td className={cx(table.td, 'font-inter tabular-nums')}>{inr(p.credit)}</td>
                                    <td className={cx(table.td, 'font-inter tabular-nums')}>{inr(p.cash)}</td>
                                    <td className={table.td}>{day(p.created_at)}</td>
                                    <td className={table.td}>
                                        {p.cash_paid_at ? (
                                            <div>
                                                <StatusBadge tone="green">Paid {day(p.cash_paid_at)}</StatusBadge>
                                                {p.cash_note && <p className="text-xs text-km-text-muted mt-0.5">{p.cash_note}</p>}
                                            </div>
                                        ) : p.cash > 0 ? (
                                            <button type="button" onClick={() => { setPaying(p); setNote(''); }} className={btn.secondary}>Mark cash paid</button>
                                        ) : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {pages > 1 && (
                <div className="flex items-center justify-end gap-2 p-4 border-t border-km-border">
                    <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className={btn.secondary}>Previous</button>
                    <span className="text-sm text-km-text-secondary font-inter">{page} / {pages}</span>
                    <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className={btn.secondary}>Next</button>
                </div>
            )}

            <AdminModal isOpen={paying !== null} onClose={() => !saving && setPaying(null)} title="Mark cash paid">
                {paying && (
                    <div className="space-y-4">
                        <p className="text-sm text-km-text-primary">
                            {inr(paying.cash)} to {paying.user_name || 'this aggregator'} for reward #{paying.batch_no}. This can&apos;t be undone.
                        </p>
                        <div>
                            <label htmlFor="cash-note" className={field.label}>How it was paid (optional)</label>
                            <input id="cash-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className={field.input} placeholder="e.g. UPI ref 4123…" />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setPaying(null)} disabled={saving} className={btn.secondary}>Cancel</button>
                            <button type="button" onClick={markPaid} disabled={saving} className={btn.primary}>
                                {saving && <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />} Mark paid
                            </button>
                        </div>
                    </div>
                )}
            </AdminModal>
        </AdminPanel>
    );
}

function ReferralsPanel() {
    const [status, setStatus] = useState<'' | ReferralStatus>('');
    const [page, setPage] = useState(1);
    const [data, setData] = useState<{ items: AdminReferral[]; total: number } | null>(null);

    // The current rows stay up while the next filter or page loads
    useEffect(() => {
        referralsApi.list(status, page)
            .then((r) => setData({ items: r.items ?? [], total: r.total }))
            .catch((err) => { notify.error(err, "Couldn't load referrals"); setData({ items: [], total: 0 }); });
    }, [status, page]);

    const pages = data ? Math.max(1, Math.ceil(data.total / 20)) : 1;

    return (
        <AdminPanel title="All referrals"
            actions={<FilterTabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[
                { value: '', label: 'All' },
                { value: 'pending', label: 'Not paid' },
                { value: 'paid', label: 'Waiting' },
                { value: 'released', label: 'Counted' },
                { value: 'cancelled', label: 'Cancelled' },
            ]} />}>
            {data === null ? <SkeletonRows rows={4} /> : data.items.length === 0 ? (
                <EmptyState icon={UsersThreeIcon} title="No referrals here" />
            ) : (
                <div className={table.wrap}>
                    <table className={table.table}>
                        <thead>
                            <tr>
                                <th className={table.th}>Invited by</th>
                                <th className={table.th}>New member</th>
                                <th className={table.th}>Joined</th>
                                <th className={table.th}>First payment</th>
                                <th className={table.th}>Status</th>
                                <th className={table.th}>Reward</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.items.map((r) => (
                                <tr key={r.id} className={table.row}>
                                    <td className={table.td}><Person name={r.referrer_name} mobile={r.referrer_mobile} /></td>
                                    <td className={table.td}><Person name={r.referred_name} mobile={r.referred_mobile} /></td>
                                    <td className={table.td}>{day(r.created_at)}</td>
                                    <td className={table.td}>
                                        {r.paid_at ? <>{day(r.paid_at)}<p className="text-xs text-km-text-muted">{paidBy(r.first_payment)}</p></> : '—'}
                                    </td>
                                    <td className={table.td}>
                                        <StatusBadge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</StatusBadge>
                                        {r.status === 'paid' && <p className="text-xs text-km-text-muted mt-0.5">Counts {day(r.release_at)}</p>}
                                        {r.cancel_reason && <p className="text-xs text-km-text-muted mt-0.5">{r.cancel_reason}</p>}
                                    </td>
                                    <td className={cx(table.td, 'font-inter tabular-nums')}>
                                        {r.reward_kind === 'aggregator' ? (r.payout_id ? 'In a group reward' : 'Towards a group')
                                            : r.reward > 0 ? inr(r.reward) : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {pages > 1 && (
                <div className="flex items-center justify-end gap-2 p-4 border-t border-km-border">
                    <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className={btn.secondary}>Previous</button>
                    <span className="text-sm text-km-text-secondary font-inter">{page} / {pages}</span>
                    <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className={btn.secondary}>Next</button>
                </div>
            )}
        </AdminPanel>
    );
}

/** Referrals: invite rules, approved aggregators, the cash half of their rewards, and every referral */
export default function ReferralsAdminPage() {
    const [payoutsKey, setPayoutsKey] = useState(0);
    return (
        <div className="space-y-6">
            <AdminPageHeader title="Referrals"
                description="A referral counts once the new member's first real payment is a set number of days old and wasn't refunded. The checks run every 10 minutes." />
            <SettingsPanel />
            <AggregatorsPanel onChange={() => setPayoutsKey((k) => k + 1)} />
            <PayoutsPanel refreshKey={payoutsKey} />
            <ReferralsPanel />
        </div>
    );
}
