'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CircleNotchIcon, PencilSimpleIcon, PlusIcon, ReceiptIcon, TicketIcon } from '@phosphor-icons/react';
import { AdminModal, AdminPageHeader, AdminPanel, EmptyState, SkeletonRows, StatusBadge, btn, cx, field, table } from '@/components/admin/ui';
import { Toggle } from '@/components/settings/SettingsPrimitives';
import { inr } from '@/lib/money';
import { notify } from '@/lib/notify';
import {
    couponsApi,
    type CouponInput,
    type CouponPurpose,
    type CouponRedemption,
    type CouponStats,
} from '@/lib/api/coupons';

const PURPOSES: { value: CouponPurpose; label: string }[] = [
    { value: 'instant_pass', label: 'InstantPass' },
    { value: 'recruiter_plan', label: 'Recruiter plans' },
    { value: 'recruiter_ad', label: 'Recruiter ads' },
];

const EMPTY_COUPON: CouponInput = {
    code: '', description: '', kind: 'discount', value_type: 'percent',
    amount: null, percent: 10, max_benefit: null, min_order: 0,
    applies_to: ['instant_pass', 'recruiter_plan'],
    starts_at: null, ends_at: null, total_limit: null, per_user_limit: 1, is_active: true,
};

const IST = 'Asia/Kolkata';

const day = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: IST });

const dayTime = (iso: string) =>
    new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: IST });

/** ISO time to the value a datetime-local input shows, in India time */
function toLocalInput(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(new Date(iso).getTime() + 330 * 60_000); // IST is UTC+5:30, no daylight saving
    return d.toISOString().slice(0, 16);
}

/** A datetime-local value, read as India time, to ISO */
function fromLocalInput(v: string): string | null {
    return v ? new Date(`${v}:00+05:30`).toISOString() : null;
}

/** "10% off, up to ₹100" or "₹50 cashback" */
function valueText(c: Pick<CouponInput, 'kind' | 'value_type' | 'amount' | 'percent' | 'max_benefit'>): string {
    const what = c.kind === 'discount' ? 'off' : 'cashback';
    if (c.value_type === 'flat') return `${inr(c.amount ?? 0)} ${what}`;
    return `${c.percent ?? 0}% ${what}${c.max_benefit != null ? `, up to ${inr(c.max_benefit)}` : ''}`;
}

/** Where a coupon stands right now */
function couponState(c: CouponStats): { label: string; tone: 'green' | 'amber' | 'red' | 'neutral' } {
    const now = Date.now();
    if (!c.is_active) return { label: 'Off', tone: 'neutral' };
    if (c.ends_at && new Date(c.ends_at).getTime() <= now) return { label: 'Expired', tone: 'red' };
    if (c.total_limit != null && c.used >= c.total_limit) return { label: 'Used up', tone: 'red' };
    if (c.starts_at && new Date(c.starts_at).getTime() > now) return { label: 'Scheduled', tone: 'amber' };
    return { label: 'Live', tone: 'green' };
}

const USE_STATUS: Record<CouponRedemption['status'], { label: string; tone: 'green' | 'amber' | 'red' | 'neutral' }> = {
    redeemed: { label: 'Used', tone: 'green' },
    reserved: { label: 'Awaiting payment', tone: 'amber' },
    released: { label: 'Payment dropped', tone: 'neutral' },
    reversed: { label: 'Refunded', tone: 'red' },
};

/** A whole-number limit; empty means no limit */
function LimitInput({ id, label, value, onChange, hint }: { id: string; label: string; value: number | null; onChange: (v: number | null) => void; hint?: string }) {
    return (
        <div>
            <label htmlFor={id} className={field.label}>{label}</label>
            <input
                id={id}
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={value ?? ''}
                placeholder="No limit"
                onChange={(e) => {
                    const raw = e.target.value.trim();
                    onChange(raw === '' ? null : Math.max(1, Math.floor(Number(raw))));
                }}
                className={cx(field.input, 'font-inter tabular-nums')}
            />
            {hint && <p className={field.hint}>{hint}</p>}
        </div>
    );
}

/** Coupons: discount and cashback codes for the InstantPass and recruiter plans, and every use of them */
export default function CouponsAdminPage() {
    const [coupons, setCoupons] = useState<CouponStats[] | null>(null);
    const [editing, setEditing] = useState<{ id: string | null; input: CouponInput } | null>(null);
    const [saving, setSaving] = useState(false);
    const [uses, setUses] = useState<{ items: CouponRedemption[]; total: number } | null>(null);
    const [page, setPage] = useState(1);
    const [filter, setFilter] = useState('');

    const loadCoupons = useCallback(async () => {
        try {
            setCoupons((await couponsApi.adminList()).coupons ?? []);
        } catch (err) {
            notify.error(err, "Couldn't load coupons");
            setCoupons([]);
        }
    }, []);

    useEffect(() => {
        void loadCoupons();
    }, [loadCoupons]);

    useEffect(() => {
        setUses(null);
        couponsApi.redemptions(page, filter || undefined)
            .then((res) => setUses({ items: res.items ?? [], total: res.total }))
            .catch((err) => {
                notify.error(err, "Couldn't load coupon uses");
                setUses({ items: [], total: 0 });
            });
    }, [page, filter]);

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;
        const input = editing.input;
        if (input.applies_to.length === 0) {
            notify.error(null, 'Choose at least one purchase the code works on');
            return;
        }
        // Send only the value the chosen type uses
        const body: CouponInput = {
            ...input,
            code: input.code.trim().toUpperCase(),
            description: input.description.trim(),
            amount: input.value_type === 'flat' ? input.amount : null,
            percent: input.value_type === 'percent' ? input.percent : null,
            max_benefit: input.value_type === 'percent' ? input.max_benefit : null,
        };
        setSaving(true);
        try {
            if (editing.id) await couponsApi.update(editing.id, body);
            else await couponsApi.create(body);
            notify.success(editing.id ? 'Coupon updated' : 'Coupon created');
            setEditing(null);
            void loadCoupons();
        } catch (err) {
            notify.error(err, "Couldn't save the coupon");
        } finally {
            setSaving(false);
        }
    };

    const set = <K extends keyof CouponInput>(key: K, value: CouponInput[K]) =>
        setEditing((cur) => (cur ? { ...cur, input: { ...cur.input, [key]: value } } : cur));

    const togglePurpose = (p: CouponPurpose, on: boolean) =>
        setEditing((cur) => {
            if (!cur) return cur;
            const rest = cur.input.applies_to.filter((x) => x !== p);
            return { ...cur, input: { ...cur.input, applies_to: on ? [...rest, p] : rest } };
        });

    const pages = uses ? Math.max(1, Math.ceil(uses.total / 20)) : 1;
    const purposeLabel = (p: CouponPurpose) => PURPOSES.find((x) => x.value === p)?.label ?? p;

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Coupons"
                description="Discount codes lower the price. Cashback codes add bonus credit to the buyer's wallet after they pay. Edits apply to future uses only."
                actions={
                    <button type="button" onClick={() => setEditing({ id: null, input: EMPTY_COUPON })} className={btn.primary}>
                        <PlusIcon size={16} weight="bold" aria-hidden="true" /> New coupon
                    </button>
                }
            />

            <AdminPanel title="Codes">
                {coupons === null ? (
                    <SkeletonRows rows={3} />
                ) : coupons.length === 0 ? (
                    <EmptyState icon={TicketIcon} title="No coupons yet" description="Create a code to give a discount or cashback on the InstantPass or recruiter plans." />
                ) : (
                    <div className={table.wrap}>
                        <table className={table.table}>
                            <thead>
                                <tr>
                                    <th className={table.th}>Code</th>
                                    <th className={table.th}>Gives</th>
                                    <th className={table.th}>Works on</th>
                                    <th className={table.th}>Runs</th>
                                    <th className={table.th}>Used</th>
                                    <th className={table.th}>Given away</th>
                                    <th className={table.th}>Status</th>
                                    <th className={cx(table.th, 'text-right')}><span className="sr-only">Edit</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {coupons.map((c) => {
                                    const state = couponState(c);
                                    return (
                                        <tr key={c.id} className={table.row}>
                                            <td className={table.td}>
                                                <p className="font-inter font-semibold text-km-heading">{c.code}</p>
                                                {c.description && <p className="text-xs text-km-text-secondary">{c.description}</p>}
                                            </td>
                                            <td className={cx(table.td, 'font-inter')}>
                                                {valueText(c)}
                                                {c.min_order > 0 && <p className="text-xs text-km-text-secondary">Min. order {inr(c.min_order)}</p>}
                                            </td>
                                            <td className={table.td}>{c.applies_to.map(purposeLabel).join(', ')}</td>
                                            <td className={cx(table.td, 'whitespace-nowrap font-inter')}>
                                                {c.starts_at || c.ends_at
                                                    ? `${c.starts_at ? day(c.starts_at) : 'Now'} to ${c.ends_at ? day(c.ends_at) : 'no end'}`
                                                    : 'Always'}
                                            </td>
                                            <td className={cx(table.td, 'whitespace-nowrap font-inter')}>
                                                {c.used}{c.total_limit != null && ` of ${c.total_limit}`}
                                                {c.held > 0 && <p className="text-xs text-km-text-secondary">{c.held} awaiting payment</p>}
                                                <p className="text-xs text-km-text-secondary">
                                                    {c.per_user_limit != null ? `${c.per_user_limit} per person` : 'No per-person limit'}
                                                </p>
                                            </td>
                                            <td className={cx(table.td, 'whitespace-nowrap font-inter')}>
                                                {c.kind === 'discount' ? inr(c.discounted) : inr(c.cashback_given)}
                                            </td>
                                            <td className={table.td}>
                                                <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
                                            </td>
                                            <td className={cx(table.td, 'text-right')}>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditing({
                                                        id: c.id,
                                                        input: {
                                                            code: c.code, description: c.description, kind: c.kind, value_type: c.value_type,
                                                            amount: c.amount, percent: c.percent, max_benefit: c.max_benefit, min_order: c.min_order,
                                                            applies_to: c.applies_to, starts_at: c.starts_at, ends_at: c.ends_at,
                                                            total_limit: c.total_limit, per_user_limit: c.per_user_limit, is_active: c.is_active,
                                                        },
                                                    })}
                                                    className={cx(btn.secondary, 'h-9 px-3')}
                                                >
                                                    <PencilSimpleIcon size={15} aria-hidden="true" /> Edit
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </AdminPanel>

            <AdminPanel
                title="Uses"
                actions={
                    coupons && coupons.length > 0 ? (
                        <select
                            aria-label="Show uses of one coupon"
                            value={filter}
                            onChange={(e) => {
                                setFilter(e.target.value);
                                setPage(1);
                            }}
                            className={cx(field.input, 'h-9 w-auto py-0')}
                        >
                            <option value="">All coupons</option>
                            {coupons.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
                        </select>
                    ) : undefined
                }
            >
                {uses === null ? (
                    <SkeletonRows rows={3} />
                ) : uses.items.length === 0 ? (
                    <EmptyState icon={ReceiptIcon} title="No coupon uses yet" />
                ) : (
                    <>
                        <div className={table.wrap}>
                            <table className={table.table}>
                                <thead>
                                    <tr>
                                        <th className={table.th}>When</th>
                                        <th className={table.th}>Code</th>
                                        <th className={table.th}>Who</th>
                                        <th className={table.th}>Bought</th>
                                        <th className={table.th}>Price</th>
                                        <th className={table.th}>Benefit</th>
                                        <th className={table.th}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {uses.items.map((u) => {
                                        const st = USE_STATUS[u.status] ?? { label: u.status, tone: 'neutral' as const };
                                        return (
                                            <tr key={u.id} className={table.row}>
                                                <td className={cx(table.td, 'whitespace-nowrap font-inter')}>{dayTime(u.redeemed_at ?? u.created_at)}</td>
                                                <td className={cx(table.td, 'font-inter font-semibold text-km-heading')}>{u.code}</td>
                                                <td className={table.td}>{u.user_name || 'User'}</td>
                                                <td className={table.td}>
                                                    {purposeLabel(u.purpose)}
                                                    <p className="text-xs text-km-text-secondary">by {u.channel === 'wallet' ? 'wallet' : 'online payment'}</p>
                                                </td>
                                                <td className={cx(table.td, 'whitespace-nowrap font-inter')}>{inr(u.list_price)}</td>
                                                <td className={cx(table.td, 'whitespace-nowrap font-inter')}>
                                                    {u.discount > 0 && <p>{inr(u.discount)} off</p>}
                                                    {u.cashback > 0 && <p>{inr(u.cashback)} cashback</p>}
                                                    {u.discount === 0 && u.cashback === 0 && <span className="text-km-text-secondary">None</span>}
                                                </td>
                                                <td className={table.td}>
                                                    <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                                                </td>
                                            </tr>
                                        );
                                    })}
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

            <AdminModal isOpen={!!editing} onClose={() => !saving && setEditing(null)} title={editing?.id ? 'Edit coupon' : 'New coupon'} size="lg">
                {editing && (
                    <form onSubmit={save} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="coupon-code" className={field.label}>Code</label>
                                <input
                                    id="coupon-code"
                                    required
                                    disabled={!!editing.id}
                                    minLength={3}
                                    maxLength={24}
                                    pattern="[A-Za-z0-9][A-Za-z0-9_\-]{2,23}"
                                    value={editing.input.code}
                                    onChange={(e) => set('code', e.target.value.toUpperCase())}
                                    placeholder="For example: WELCOME50"
                                    className={cx(field.input, 'font-inter uppercase')}
                                />
                                <p className={field.hint}>{editing.id ? "The code can't be changed" : '3 to 24 letters, numbers, dashes or underscores'}</p>
                            </div>
                            <div>
                                <label htmlFor="coupon-desc" className={field.label}>Description</label>
                                <input id="coupon-desc" maxLength={200} value={editing.input.description}
                                    onChange={(e) => set('description', e.target.value)} placeholder="Shown to the buyer at checkout"
                                    className={field.input} />
                            </div>
                            <div>
                                <label htmlFor="coupon-kind" className={field.label}>Type</label>
                                <select id="coupon-kind" value={editing.input.kind}
                                    onChange={(e) => set('kind', e.target.value as CouponInput['kind'])} className={field.input}>
                                    <option value="discount">Discount: lowers the price</option>
                                    <option value="cashback">Cashback: bonus credit after paying</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="coupon-value-type" className={field.label}>Value</label>
                                <select id="coupon-value-type" value={editing.input.value_type}
                                    onChange={(e) => set('value_type', e.target.value as CouponInput['value_type'])} className={field.input}>
                                    <option value="percent">Percent of the price</option>
                                    <option value="flat">Fixed amount</option>
                                </select>
                            </div>
                            {editing.input.value_type === 'flat' ? (
                                <div>
                                    <label htmlFor="coupon-amount" className={field.label}>Amount (₹)</label>
                                    <input id="coupon-amount" type="number" min={0.01} step="0.01" required value={editing.input.amount ?? ''}
                                        onChange={(e) => set('amount', e.target.value === '' ? null : Number(e.target.value))}
                                        className={cx(field.input, 'font-inter tabular-nums')} />
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <label htmlFor="coupon-percent" className={field.label}>Percent</label>
                                        <input id="coupon-percent" type="number" min={1} max={100} step={1} required value={editing.input.percent ?? ''}
                                            onChange={(e) => set('percent', e.target.value === '' ? null : Math.floor(Number(e.target.value)))}
                                            className={cx(field.input, 'font-inter tabular-nums')} />
                                    </div>
                                    <div>
                                        <label htmlFor="coupon-cap" className={field.label}>Most one use can give (₹)</label>
                                        <input id="coupon-cap" type="number" min={0.01} step="0.01" value={editing.input.max_benefit ?? ''}
                                            placeholder="No cap"
                                            onChange={(e) => set('max_benefit', e.target.value === '' ? null : Number(e.target.value))}
                                            className={cx(field.input, 'font-inter tabular-nums')} />
                                    </div>
                                </>
                            )}
                            <div>
                                <label htmlFor="coupon-min" className={field.label}>Minimum order (₹)</label>
                                <input id="coupon-min" type="number" min={0} step="0.01" value={editing.input.min_order}
                                    onChange={(e) => set('min_order', Number(e.target.value) || 0)}
                                    className={cx(field.input, 'font-inter tabular-nums')} />
                                <p className={field.hint}>0 means any price</p>
                            </div>
                            <div>
                                <label htmlFor="coupon-start" className={field.label}>Starts</label>
                                <input id="coupon-start" type="datetime-local" value={toLocalInput(editing.input.starts_at)}
                                    onChange={(e) => set('starts_at', fromLocalInput(e.target.value))} className={cx(field.input, 'font-inter')} />
                                <p className={field.hint}>India time. Empty means right away</p>
                            </div>
                            <div>
                                <label htmlFor="coupon-end" className={field.label}>Ends</label>
                                <input id="coupon-end" type="datetime-local" value={toLocalInput(editing.input.ends_at)}
                                    onChange={(e) => set('ends_at', fromLocalInput(e.target.value))} className={cx(field.input, 'font-inter')} />
                                <p className={field.hint}>India time. Empty means no end date</p>
                            </div>
                            <LimitInput id="coupon-total" label="Total uses" value={editing.input.total_limit}
                                onChange={(v) => set('total_limit', v)} hint="Across everyone. Empty means no limit" />
                            <LimitInput id="coupon-per-user" label="Uses per person" value={editing.input.per_user_limit}
                                onChange={(v) => set('per_user_limit', v)} hint="Empty means no limit" />
                        </div>

                        <fieldset>
                            <legend className={field.label}>Works on</legend>
                            <div className="flex flex-wrap gap-4 mt-1">
                                {PURPOSES.map((p) => (
                                    <label key={p.value} className="flex items-center gap-2 text-sm text-km-heading">
                                        <input
                                            type="checkbox"
                                            checked={editing.input.applies_to.includes(p.value)}
                                            onChange={(e) => togglePurpose(p.value, e.target.checked)}
                                            className="h-4 w-4 accent-km-primary"
                                        />
                                        {p.label}
                                    </label>
                                ))}
                            </div>
                        </fieldset>

                        <label className="flex items-center justify-between gap-4 pt-1">
                            <span>
                                <span className="block text-sm font-medium text-km-heading">Active</span>
                                <span className="block text-xs text-km-text-secondary">Off stops new uses; past uses are kept</span>
                            </span>
                            <Toggle checked={editing.input.is_active} onChange={(v) => set('is_active', v)} label="Active" />
                        </label>

                        <p className="text-sm text-km-text-secondary">
                            Preview: <span className="font-inter font-medium text-km-heading">{valueText(editing.input)}</span>
                        </p>

                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setEditing(null)} disabled={saving} className={btn.secondary}>Cancel</button>
                            <button type="submit" disabled={saving} className={btn.primary}>
                                {saving && <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />}
                                {editing.id ? 'Save coupon' : 'Create coupon'}
                            </button>
                        </div>
                    </form>
                )}
            </AdminModal>
        </div>
    );
}
