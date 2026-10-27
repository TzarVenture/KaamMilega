'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowSquareOutIcon, BuildingOfficeIcon, CaretRightIcon, CheckCircleIcon } from '@phosphor-icons/react';
import api from '@/lib/axios';
import { HiringCompany, companiesFromApi } from '@/lib/constants/companies';
import CustomImage from '@/components/ui/CustomImage';

interface TopEmployersWidgetProps {
    companies?: HiringCompany[];
    limit?: number;
    className?: string;
}

export const TopEmployersWidget: React.FC<TopEmployersWidgetProps> = ({
    companies,
    limit = 3,
    className = '',
}) => {
    // Registered employers only. Without a `companies` prop the widget loads them itself, and it
    // renders nothing when there are none (no showcase list or invented ratings).
    const [loaded, setLoaded] = React.useState<HiringCompany[] | null>(null);

    React.useEffect(() => {
        if (companies) return;
        let alive = true;
        api.get(`/companies/top?limit=${limit}`)
            .then((res) => alive && setLoaded(companiesFromApi(res)))
            .catch(() => alive && setLoaded([]));
        return () => {
            alive = false;
        };
    }, [companies, limit]);

    const list = (companies ?? loaded ?? []).slice(0, limit);
    if (list.length === 0) return null;

    return (
        <div className={`bg-km-surface-card rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-sm font-sans ${className}`}>
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-km-heading flex items-center justify-center">
                        <BuildingOfficeIcon weight="bold" size={16} />
                    </div>
                    <h3 className="font-bold text-gray-900 text-base">Top Employers</h3>
                </div>
                <Link
                    href="/jobs"
                    className="text-xs font-bold text-km-heading hover:text-km-primary-dark hover:underline inline-flex items-center gap-0.5 dark:hover:text-km-link"
                >
                    <span>Browse Jobs</span>
                    <CaretRightIcon weight="bold" size={14} />
                </Link>
            </div>

            <div className="space-y-3.5">
                {list.map((comp) => {
                    const searchHref = `/jobs?company=${encodeURIComponent(comp.name)}`;

                    return (
                        <div
                            key={comp.name}
                            className="p-3 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-blue-50/30 hover:border-blue-200 transition-all flex flex-col gap-2.5 group"
                        >
                            <div className="flex items-start gap-3">
                                {/* Company Logo / Icon */}
                                <div className={`w-11 h-11 rounded-xl border p-1.5 shrink-0 flex items-center justify-center bg-white shadow-2xs ${comp.bgClass || 'border-gray-200'}`}>
                                    {comp.logo ? (
                                        <CustomImage
                                            src={comp.logo}
                                            alt={comp.name}
                                            className={`object-contain ${comp.imgClass || 'max-h-full max-w-full'}`}
                                        />
                                    ) : (
                                        <BuildingOfficeIcon weight="bold" size={18} className="text-km-heading" />
                                    )}
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <Link
                                            href={searchHref}
                                            className="font-bold text-sm text-gray-900 hover:text-km-heading transition-colors truncate"
                                        >
                                            {comp.name}
                                        </Link>
                                        {comp.verified && (
                                            <span title="Verified employer" className="shrink-0 text-blue-500 dark:text-blue-400">
                                                <CheckCircleIcon weight="fill" size={13} className="fill-blue-500 text-white" />
                                            </span>
                                        )}
                                    </div>
                                    {comp.category && (
                                        <p className="text-[11px] text-gray-500 truncate mt-0.5">{comp.category}</p>
                                    )}
                                    {comp.location && (
                                        <p className="text-[11px] font-semibold text-gray-400 mt-0.5">{comp.location}</p>
                                    )}
                                </div>
                            </div>

                            <Link href={searchHref} className="w-full">
                                <button className="w-full py-1.5 px-3 bg-km-surface-card hover:bg-km-primary text-gray-700 hover:text-white border border-gray-200 hover:border-km-primary rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1 cursor-pointer group-hover:bg-km-primary group-hover:text-white group-hover:border-km-primary">
                                    <span>View Jobs</span>
                                    <ArrowSquareOutIcon weight="bold" size={11} />
                                </button>
                            </Link>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TopEmployersWidget;
