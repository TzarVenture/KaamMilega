'use client';

import { useTranslations } from 'next-intl';
import { STAGE_COLOR, type Stage } from '@/lib/api/recruiter';
import { cx } from '@/components/admin/ui';

const SHOWN: Stage[] = ['Applied', 'Shortlisted', 'Interviewing', 'Hired'];

/**
 * A thin bar split by pipeline stage, with the counts underneath. `stages` picks which stages to
 * show (by default the active ones, without Not selected).
 */
export default function StageBar({ counts, stages = SHOWN, showLegend = true, className }: {
    counts?: Partial<Record<Stage, number>>;
    stages?: Stage[];
    showLegend?: boolean;
    className?: string;
}) {
    const t = useTranslations('recruiterJobs.stages');
    const values = stages.map((s) => ({ s, n: Math.max(0, counts?.[s] ?? 0) }));
    const total = values.reduce((a, v) => a + v.n, 0);
    const label = values.map((v) => `${t(v.s)} ${v.n}`).join(', ');

    return (
        <div className={cx('min-w-0', className)}>
            <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-km-border-subtle" role="img" aria-label={label}>
                {total > 0 && values.map((v) => v.n > 0 && (
                    <span key={v.s} className={STAGE_COLOR[v.s].bar} style={{ width: `${(v.n / total) * 100}%` }} />
                ))}
            </div>
            {showLegend && (
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-km-text-secondary" aria-hidden="true">
                    {/* Only stages with people in them; an empty job shows just the empty bar */}
                    {values.filter((v) => v.n > 0).map((v) => (
                        <span key={v.s} className="inline-flex items-center gap-1 whitespace-nowrap">
                            <span className={cx('w-1.5 h-1.5 rounded-full', STAGE_COLOR[v.s].dot)} />
                            <span className="font-inter tabular-nums text-km-text-primary">{v.n}</span>
                            <span className="hidden lg:inline">{t(v.s)}</span>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
