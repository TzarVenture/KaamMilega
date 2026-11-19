'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/axios';
import { useParams } from 'next/navigation';

/** GET /api/companies/:id: the public company page (a recruiter's company profile) */
export interface CompanyData {
    id: string;
    name: string;
    logo?: string;
    website?: string;
    cover?: string;
    about?: string;
    /** Headcount band, e.g. "11-50" */
    size?: string;
    industry?: string;
    location?: string;
    verified: boolean;
    job_count: number;
    follower_count: number;
}

interface CompanyContextType {
    company: CompanyData | null;
    loading: boolean;
    notFound: boolean;
    /** Moves the follower count when the viewer follows or unfollows */
    adjustFollowers: (delta: number) => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const CompanyProvider = ({ children }: { children: React.ReactNode }) => {
    const { Id } = useParams();
    const [company, setCompany] = useState<CompanyData | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (!Id) return;
        let alive = true;
        api.get(`/companies/${Id}`)
            .then((res) => {
                if (alive) setCompany(res as unknown as CompanyData);
            })
            .catch(() => {
                if (alive) setNotFound(true);
            })
            .finally(() => {
                if (alive) setLoading(false);
            });
        return () => {
            alive = false;
        };
    }, [Id]);

    const adjustFollowers = (delta: number) =>
        setCompany((c) => (c ? { ...c, follower_count: Math.max(0, c.follower_count + delta) } : c));

    return (
        <CompanyContext.Provider value={{ company, loading, notFound, adjustFollowers }}>
            {children}
        </CompanyContext.Provider>
    );
};

export const useCompany = () => {
    const context = useContext(CompanyContext);
    if (!context) {
        throw new Error("useCompany must be used within a CompanyProvider");
    }
    return context;
};

/** The company's website as a link target, or null when it has none */
export function websiteHref(website?: string): string | null {
    const w = website?.trim();
    if (!w) return null;
    return /^https?:\/\//i.test(w) ? w : `https://${w}`;
}
