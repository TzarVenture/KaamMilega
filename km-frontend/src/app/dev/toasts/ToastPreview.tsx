'use client';

import { notify } from '@/lib/notify';
import { useTheme } from '@/lib/theme';

const wait = (ms: number, fail = false) =>
    new Promise<void>((resolve, reject) => setTimeout(() => (fail ? reject(new Error('This job is no longer accepting applications.')) : resolve()), ms));

const examples: { group: string; items: { label: string; run: () => void }[] }[] = [
    {
        group: 'Success',
        items: [
            { label: 'Short: Profile updated', run: () => notify.success('Profile updated') },
            { label: 'Long: application sent', run: () => notify.success('Application sent to Sharma Electricals. You’ll hear back here and by SMS.') },
            { label: 'With detail', run: () => notify.success('Interview scheduled', 'Tue, 28 Oct at 11:00 AM. The candidate has been notified.') },
        ],
    },
    {
        group: 'Error',
        items: [
            { label: 'Server message (Error object)', run: () => notify.error(new Error('Event is full'), 'Could not register') },
            { label: 'No server message → fallback', run: () => notify.error(new Error(''), 'Could not save your changes. Please try again.') },
            { label: 'Network down', run: () => notify.error(new Error('Network Error. Please check your connection.')) },
        ],
    },
    {
        group: 'Warning & info',
        items: [
            { label: 'Warning', run: () => notify.warning('Upload a photo under 5 MB') },
            { label: 'Info', run: () => notify.info('Link copied') },
            { label: 'Info, long', run: () => notify.info('SMS alerts are coming soon. We’ve saved your choice and will turn them on at launch.') },
        ],
    },
    {
        group: 'Loading → result',
        items: [
            { label: 'Apply (succeeds)', run: () => void notify.promise(wait(1800), { loading: 'Sending application…', success: 'Application sent', error: 'Could not apply' }).catch(() => {}) },
            { label: 'Apply (fails, server reason)', run: () => void notify.promise(wait(1800, true), { loading: 'Sending application…', success: 'Application sent', error: 'Could not apply' }).catch(() => {}) },
        ],
    },
    {
        group: 'Behaviour',
        items: [
            { label: 'Double-click guard (fires 3×, shows 1)', run: () => { notify.success('Saved'); notify.success('Saved'); notify.success('Saved'); } },
            { label: 'Stack of 3 different', run: () => { notify.success('Job saved'); setTimeout(() => notify.info('2 new applicants'), 250); setTimeout(() => notify.warning('Your plan ends in 3 days'), 500); } },
        ],
    },
];

export default function ToastPreview() {
    const { isDark, setPreference } = useTheme();
    return (
        <main className="min-h-screen bg-km-surface px-4 py-10">
            <div className="max-w-3xl mx-auto">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-km-heading">Toast preview</h1>
                        <p className="text-sm text-km-text-secondary mt-1">sonner, KaamMilega theme. Toasts stack top-centre under the navbar; hover to expand and pause, swipe or × to dismiss.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setPreference(isDark ? 'light' : 'dark')}
                        className="h-10 px-4 rounded-xl border border-km-border bg-km-surface-card text-sm font-semibold text-km-text-primary hover:bg-km-surface"
                    >
                        Switch to {isDark ? 'light' : 'dark'}
                    </button>
                </div>

                <div className="mt-8 space-y-6">
                    {examples.map((g) => (
                        <section key={g.group} className="bg-km-surface-card border border-km-border rounded-2xl p-5">
                            <h2 className="text-sm font-bold text-km-heading">{g.group}</h2>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {g.items.map((it) => (
                                    <button
                                        key={it.label}
                                        type="button"
                                        onClick={it.run}
                                        className="h-10 px-4 rounded-xl bg-[#071A4D] dark:bg-km-primary text-white text-sm font-semibold hover:opacity-90"
                                    >
                                        {it.label}
                                    </button>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </main>
    );
}
