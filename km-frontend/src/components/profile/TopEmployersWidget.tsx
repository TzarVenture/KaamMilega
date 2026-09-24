'use client';

import React from 'react';
import Link from 'next/link';
import { Building2, CheckCircle2, ChevronRight, ExternalLink } from 'lucide-react';
import { HiringCompany, ENTERPRISE_COMPANIES, mergeHiringCompanies } from '@/lib/constants/companies';
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
    const list = React.useMemo(() => {
        if (companies && companies.length > 0) {
            return mergeHiringCompanies(companies).slice(0, limit);
        }
        return ENTERPRISE_COMPANIES.slice(0, limit);
    }, [companies, limit]);

    return (
        <div className={`bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-sm font-sans ${className}`}>
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-km-primary flex items-center justify-center">
                        <Building2 size={16} />
                    </div>
                    <h3 className="font-bold text-gray-900 text-base">Top Employers</h3>
                </div>
                <Link
                    href="/jobs"
                    className="text-xs font-bold text-km-primary hover:text-km-primary-dark hover:underline inline-flex items-center gap-0.5"
                >
                    <span>Browse Jobs</span>
                    <ChevronRight size={14} />
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
                                        <Building2 size={18} className="text-km-primary" />
                                    )}
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <Link
                                            href={searchHref}
                                            className="font-bold text-sm text-gray-900 hover:text-km-primary transition-colors truncate"
                                        >
                                            {comp.name}
                                        </Link>
                                        {comp.verified && (
                                            <span title="Verified Enterprise Partner" className="shrink-0 text-blue-500">
                                                <CheckCircle2 size={13} className="fill-blue-500 text-white" />
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-gray-500 truncate mt-0.5">
                                        {comp.category}
                                    </p>
                                    <p className="text-[11px] font-semibold text-gray-400 mt-0.5">
                                        {comp.location || 'Pan India'}
                                    </p>
                                </div>
                            </div>

                            <Link href={searchHref} className="w-full">
                                <button className="w-full py-1.5 px-3 bg-white hover:bg-km-primary text-gray-700 hover:text-white border border-gray-200 hover:border-km-primary rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1 cursor-pointer group-hover:bg-km-primary group-hover:text-white group-hover:border-km-primary">
                                    <span>View Jobs</span>
                                    <ExternalLink size={11} />
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
