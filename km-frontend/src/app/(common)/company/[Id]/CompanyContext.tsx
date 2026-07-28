'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/axios';
import { useParams } from 'next/navigation';

export interface CompanyData {
    id: string;
    name: string;
    industry: string;
    connections: number;
    website: string;
    size: string;
    specialties: string;
    description: string;
    logo?: string;
    cover_image?: string;
    location?: string;
    email?: string;
    phone?: string;
    recruiter_id?: string;
}

interface CompanyContextType {
    company: CompanyData | null;
    loading: boolean;
    error: string | null;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const CompanyProvider = ({ children }: { children: React.ReactNode }) => {
    const { Id } = useParams();
    const [company, setCompany] = useState<CompanyData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!Id) return;

        const fetchCompany = async () => {
            try {
                // Try fetching from /companies/:id
                // Adjust endpoint if needed based on backend
                const res: any = await api.get(`/companies/${Id}`);
                setCompany(res.data || res);
            } catch (err: any) {
                console.error("Failed to fetch company", err);
                setError(err.message || "Failed to load company data");

                // Fallback to mock data if API fails (for development if API not ready)
                // Remove this fallback in production if strictly API driven
            } finally {
                setLoading(false);
            }
        };

        fetchCompany();
    }, [Id]);

    return (
        <CompanyContext.Provider value={{ company, loading, error }}>
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
