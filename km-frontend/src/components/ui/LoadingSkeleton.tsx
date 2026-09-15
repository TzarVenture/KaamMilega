"use client";

import React from "react";

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
    return (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            {/* Header skeleton */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="h-6 w-48 bg-slate-200 rounded-lg animate-shimmer" />
                <div className="h-9 w-32 bg-slate-200 rounded-xl animate-shimmer" />
            </div>

            {/* Table Rows Skeleton */}
            <div className="space-y-3 pt-2">
                {Array.from({ length: rows }).map((_, rIdx) => (
                    <div key={rIdx} className="flex items-center gap-4 py-3 border-b border-slate-50 last:border-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-200 shrink-0 animate-shimmer" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 w-1/3 bg-slate-200 rounded animate-shimmer" />
                            <div className="h-3 w-1/4 bg-slate-100 rounded animate-shimmer" />
                        </div>
                        {Array.from({ length: cols - 2 }).map((_, cIdx) => (
                            <div key={cIdx} className="hidden sm:block h-4 w-20 bg-slate-150 bg-slate-200/60 rounded animate-shimmer" />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

export function KanbanSkeleton({ columns = 4, cardsPerColumn = 3 }: { columns?: number; cardsPerColumn?: number }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: columns }).map((_, colIdx) => (
                <div key={colIdx} className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60 space-y-4">
                    {/* Column Header Skeleton */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/40">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-slate-300 animate-shimmer" />
                            <div className="h-4 w-24 bg-slate-300 rounded animate-shimmer" />
                        </div>
                        <div className="h-5 w-8 bg-slate-200 rounded-full animate-shimmer" />
                    </div>

                    {/* Cards Skeleton */}
                    <div className="space-y-3">
                        {Array.from({ length: cardsPerColumn }).map((_, cardIdx) => (
                            <div key={cardIdx} className="bg-white p-4 rounded-xl border border-slate-200/80 space-y-3 shadow-2xs">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-slate-200 shrink-0 animate-shimmer" />
                                    <div className="space-y-1.5 flex-1">
                                        <div className="h-3.5 w-3/4 bg-slate-200 rounded animate-shimmer" />
                                        <div className="h-2.5 w-1/2 bg-slate-100 rounded animate-shimmer" />
                                    </div>
                                </div>
                                <div className="h-3 w-full bg-slate-100 rounded animate-shimmer" />
                                <div className="flex justify-between items-center pt-1">
                                    <div className="h-4 w-16 bg-slate-200 rounded-full animate-shimmer" />
                                    <div className="h-4 w-12 bg-slate-100 rounded animate-shimmer" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: count }).map((_, idx) => (
                <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                    <div className="flex justify-between items-start">
                        <div className="w-12 h-12 rounded-2xl bg-slate-200 animate-shimmer" />
                        <div className="h-6 w-20 bg-slate-200 rounded-full animate-shimmer" />
                    </div>
                    <div className="space-y-2">
                        <div className="h-5 w-3/4 bg-slate-200 rounded animate-shimmer" />
                        <div className="h-3.5 w-1/2 bg-slate-100 rounded animate-shimmer" />
                    </div>
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                        <div className="h-4 w-24 bg-slate-200 rounded animate-shimmer" />
                        <div className="h-8 w-24 bg-slate-200 rounded-xl animate-shimmer" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function PageHeaderSkeleton() {
    return (
        <div className="flex justify-between items-center pb-6 border-b border-slate-200/60 mb-6">
            <div className="space-y-2">
                <div className="h-8 w-64 bg-slate-200 rounded-xl animate-shimmer" />
                <div className="h-4 w-40 bg-slate-100 rounded-lg animate-shimmer" />
            </div>
            <div className="h-10 w-36 bg-slate-200 rounded-xl animate-shimmer" />
        </div>
    );
}

export function FullPageSkeleton() {
    return (
        <div className="space-y-6 max-w-7xl mx-auto p-6">
            <PageHeaderSkeleton />
            <TableSkeleton rows={6} cols={5} />
        </div>
    );
}
