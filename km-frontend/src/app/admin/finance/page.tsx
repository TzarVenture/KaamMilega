'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowsClockwiseIcon, CheckCircleIcon, MagnifyingGlassIcon } from '@phosphor-icons/react';
import api from '@/lib/axios';
import { notify } from '@/lib/notify';
import { dateTime, inr } from '@/lib/money';
import { AdminPageHeader, AdminPanel, EmptyState, SkeletonRows, StatCard, StatusBadge, btn, field, table } from '@/components/admin/ui';

interface Mismatch {
    user_id: string;
    balance: string;
    stored: number;
    computed: number;
}

interface Overview {
    wallets: number;
    main_balance: number;
    earnings_balance: number;
    locked_balance: number;
    bonus_balance: number;
    open_withdrawals: number;
    open_withdrawal_sum: number;
    open_disputes: number;
    mismatches: Mismatch[];
    mismatches_total: number;
}

interface Lookup {
    user_id: string;
    name: string;
    email: string;
    mobile: string;
    wallet: { main_balance: number; earnings_balance: number; locked_balance: number; bonus_balance: number; status: string };
    transactions: { id: string; type: string; category: string; amount: number; description: string; status: string; created_at: string }[];
}

export default function AdminFinancePage() {
    const [overview, setOverview] = useState<Overview | null>(null);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [result, setResult] = useState<Lookup | null>(null);
    const [searching, setSearching] = useState(false);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setOverview(await api.get<unknown, Overview>('/admin/wallets/overview'));
        } catch (err) {
            notify.error(err, "Couldn't load the finance overview");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const search = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;
        setSearching(true);
        setResult(null);
        try {
            setResult(await api.get<unknown, Lookup>('/admin/wallets/lookup', { params: { q: query.trim() } }));
        } catch (err) {
            notify.error(err, 'No wallet found');
        } finally {
            setSearching(false);
        }
    };

    const setHold = async (status: 'active' | 'frozen') => {
        if (!result) return;
        setSaving(true);
        try {
            const wallet = await api.put<unknown, Lookup['wallet']>(`/admin/wallets/${result.user_id}/status`, { status });
            setResult({ ...result, wallet });
            notify.success(status === 'frozen' ? 'Wallet put on hold' : 'Hold removed');
        } catch (err) {
            notify.error(err, "Couldn't change the wallet");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Finance"
                description="All wallet money, and a check that every balance matches its ledger"
                actions={<button type="button" onClick={load} disabled={loading} className={btn.secondary}><ArrowsClockwiseIcon size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />Refresh</button>}
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Spending balances" value={overview ? inr(overview.main_balance) : '…'} hint={overview ? `${overview.wallets} wallets` : undefined} />
                <StatCard label="Earnings owed" value={overview ? inr(overview.earnings_balance) : '…'} />
                <StatCard label="Held for sessions" value={overview ? inr(overview.locked_balance) : '…'} />
                <StatCard label="Payouts to send" value={overview ? inr(overview.open_withdrawal_sum) : '…'} hint={overview ? `${overview.open_withdrawals} open` : undefined} href="/admin/payouts" />
            </div>

            <AdminPanel title="Balance check" actions={overview && <StatusBadge tone={overview.mismatches_total === 0 ? 'green' : 'red'}>{overview.mismatches_total === 0 ? 'All balances match' : `${overview.mismatches_total} mismatched`}</StatusBadge>}>
                {loading ? <SkeletonRows rows={2} /> : !overview || overview.mismatches.length === 0 ? (
                    <EmptyState icon={CheckCircleIcon} title="Every balance matches its ledger" />
                ) : (
                    <div className={table.wrap}>
                        <table className={table.table}>
                            <thead>
                                <tr>
                                    <th className={table.th}>User</th>
                                    <th className={table.th}>Balance</th>
                                    <th className={`${table.th} text-right`}>Stored</th>
                                    <th className={`${table.th} text-right`}>Ledger total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {overview.mismatches.map((m) => (
                                    <tr key={`${m.user_id}-${m.balance}`} className={table.row}>
                                        <td className={`${table.td} font-inter`}>{m.user_id}</td>
                                        <td className={table.td}>{m.balance}</td>
                                        <td className={`${table.td} text-right font-inter tabular-nums`}>{inr(m.stored)}</td>
                                        <td className={`${table.td} text-right font-inter tabular-nums`}>{inr(m.computed)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </AdminPanel>

            <AdminPanel title="Find a wallet" bodyClassName="p-5 space-y-4">
                <form onSubmit={search} className="flex gap-2">
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Email, mobile or user id" className={field.input} />
                    <button type="submit" disabled={searching || !query.trim()} className={btn.primary}><MagnifyingGlassIcon size={16} aria-hidden="true" />Search</button>
                </form>

                {result && (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p className="font-semibold text-km-heading">{result.name || 'Unnamed user'}</p>
                                <p className="text-sm text-km-text-secondary">{[result.email, result.mobile].filter(Boolean).join(' · ')}</p>
                            </div>
                            {result.wallet.status === 'frozen' ? (
                                <button type="button" onClick={() => setHold('active')} disabled={saving} className={btn.secondary}>Remove hold</button>
                            ) : (
                                <button type="button" onClick={() => setHold('frozen')} disabled={saving} className={btn.danger}>Put on hold</button>
                            )}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-4">
                            <StatCard label="Spending" value={inr(result.wallet.main_balance)} />
                            <StatCard label="Earnings" value={inr(result.wallet.earnings_balance)} />
                            <StatCard label="On hold" value={inr(result.wallet.locked_balance)} />
                            <StatCard label="Bonus" value={inr(result.wallet.bonus_balance)} />
                        </div>

                        <ul className="divide-y divide-km-border-subtle">
                            {result.transactions.map((tx) => (
                                <li key={tx.id} className="flex items-start justify-between gap-4 py-3 text-sm">
                                    <div className="min-w-0">
                                        <p className="text-km-heading truncate">{tx.description || tx.category}</p>
                                        <p className="text-xs text-km-text-secondary font-inter">{dateTime(tx.created_at)} · {tx.status}</p>
                                    </div>
                                    <span className="font-medium font-inter tabular-nums shrink-0">{tx.type === 'credit' ? '+' : '-'}{inr(tx.amount)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </AdminPanel>
        </div>
    );
}
