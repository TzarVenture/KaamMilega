'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircleIcon, CircleNotchIcon, ClockCountdownIcon, HandCoinsIcon, UsersThreeIcon } from '@phosphor-icons/react';
import {
    AdminModal, AdminPageHeader, AdminPanel, EmptyState, FilterTabs, SkeletonRows, StatCard, StatusBadge,
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

/** Avatar tiles: one of the service colours, picked from the name */
const AVATAR = ['bg-[#0B5ED7]', 'bg-[#FF6B00]', 'bg-[#16A34A]', 'bg-[#7C3AED]', 'bg-[#0F9D8A]', 'bg-[#F59E0B]'];
function avatarColour(name: string) {
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return AVATAR[h % AVATAR.length];
}

function Person({ name, mobile }: { name?: string; mobile?: string }) {
    const shown = name || 'Unknown';
    return (
        <div className="flex items-center gap-3 min-w-0">
            <span className={cx('w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0', avatarColour(shown))} aria-hidden="true">
                {shown.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
                <p className="font-medium text-km-heading truncate">{shown}</p>
                {mobile && <p className="text-xs text-km-text-secondary font-inter">{mobile}</p>}
            </div>
        </div>
    );
}

type Totals = Record<ReferralStatus, number> & { cashOwed: number; aggregators: number };

const STAGES: { key: ReferralStatus; label: string; colour: string }[] = [
    { key: 'pending', label: 'Joined, not paid', colour: 'bg-[#94A3B8]' },
    { key: 'paid', label: 'Paid, waiting', colour: 'bg-[#F59E0B]' },
    { key: 'released', label: 'Counted', colour: 'bg-[#16A34A]' },
    { key: 'cancelled', label: 'Cancelled', colour: 'bg-[#EF4444]' },
];

/** Headline numbers and one bar showing where every referral stands */
function Summary({ refreshKey }: { refreshKey: number }) {
    const [totals, setTotals] = useState<Totals | null>(null);

    useEffect(() => {
        const count = (status: ReferralStatus) => referralsApi.list(status, 1).then((r) => r.total).catch(() => 0);
        Promise.all([
            count('pending'), count('paid'), count('released'), count('cancelled'),
            referralsApi.aggregators().then((r) => r.items ?? []).catch(() => [] as ReferralAggregator[]),
        ]).then(([pending, paid, released, cancelled, aggs]) => setTotals({
            pending, paid, released, cancelled,
            cashOwed: aggs.reduce((sum, a) => sum + a.cash_owed, 0),
            aggregators: aggs.filter((a) => a.active).length,
        }));
    }, [refreshKey]);

    const all = totals ? totals.pending + totals.paid + totals.released + totals.cancelled : 0;
    const v = (n: number | string) => (totals ? n : '–');

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="All referrals" value={v(all)} icon={UsersThreeIcon} hint={totals ? `${totals.aggregators} active ${totals.aggregators === 1 ? "aggregator" : "aggregators"}` : undefined} />
                <StatCard label="Paid, waiting" value={v(totals?.paid ?? 0)} icon={ClockCountdownIcon} iconClassName="text-amber-600" />
                <StatCard label="Counted" value={v(totals?.released ?? 0)} icon={CheckCircleIcon} iconClassName="text-[#16A34A]" />
                <StatCard label="Cash owed" value={v(inr(totals?.cashOwed ?? 0))} icon={HandCoinsIcon} iconClassName="text-km-accent" hint="To aggregators" />
            </div>
            {totals && all > 0 && (
                <div className="bg-km-surface-card border border-km-border rounded-2xl p-5">
                    <p className="text-sm font-semibold text-km-heading">Where referrals stand</p>
                    <div className="mt-3 flex h-3 rounded-full overflow-hidden bg-km-surface" role="img"
                        aria-label={STAGES.map((st) => `${st.label}: ${totals[st.key]}`).join(', ')}>
                        {STAGES.map((st) => totals[st.key] > 0 && (
                            <span key={st.key} className={st.colour} style={{ width: `${(totals[st.key] / all) * 100}%` }} />
                        ))}
                    </div>
                    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                        {STAGES.map((st) => (
                            <li key={st.key} className="flex items-center gap-2 text-km-text-secondary">
                                <span className={cx('w-2.5 h-2.5 rounded-full', st.colour)} aria-hidden="true" />
                                {st.label}
                                <span className="font-semibold font-inter tabular-nums text-km-heading">{totals[st.key]}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
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
            <Summary refreshKey={payoutsKey} />
            <SettingsPanel />
            <AggregatorsPanel onChange={() => setPayoutsKey((k) => k + 1)} />
            <PayoutsPanel refreshKey={payoutsKey} />
            <ReferralsPanel />
        </div>
    );
}
