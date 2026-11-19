"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";

// Stored values stay in English (they are what existing companies already have); the labels
// come from the messages (auth.setup.industries)
export const INDUSTRIES: [key: string, value: string][] = [
    ["it", "Information Technology & Services"],
    ["manufacturing", "Manufacturing & Engineering"],
    ["healthcare", "Healthcare & Pharmaceuticals"],
    ["logistics", "Logistics, Supply Chain & Transport"],
    ["retail", "Retail & E-Commerce"],
    ["hospitality", "Hospitality & Food Services"],
    ["finance", "Banking & Financial Services"],
    ["construction", "Construction, Real Estate & Trades"],
    ["education", "Education & EdTech"],
    ["staffing", "Staffing & Executive Search"],
    ["other", "Other Industry"],
];

/** Headcount bands, the same list the backend accepts (user.CompanySizes) */
export const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"];

/** The longest company description the backend keeps */
export const COMPANY_ABOUT_MAX = 2000;

/** "acme.in" -> "https://acme.in"; empty stays empty */
export const normalizeWebsite = (value: string) => {
    const v = value.trim();
    if (!v) return "";
    return /^https?:\/\//i.test(v) ? v : `https://${v}`;
};

/** City names for a datalist, loaded once when `enabled` turns true */
export function useCityOptions(enabled = true): string[] {
    const [options, setOptions] = useState<string[]>([]);
    useEffect(() => {
        if (!enabled) return;
        let alive = true;
        api.get("/cities?active=true")
            .then((res: unknown) => {
                const list = (Array.isArray(res) ? res : (res as { data?: unknown[] })?.data || []) as { name?: string }[];
                // The city list can repeat a name (one per state or area): suggest each once
                const names = list.map((c) => c?.name?.trim()).filter((n): n is string => Boolean(n));
                if (alive) setOptions([...new Set(names)]);
            })
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, [enabled]);
    return options;
}
