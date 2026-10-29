"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";

/**
 * What an upload is for. The backend picks the bucket from it: public kinds get a permanent CDN
 * URL; private kinds (resumes, documents, chat files) get a /api/files/{id} reference that is
 * opened through a short-lived signed link.
 */
export type UploadKind =
    | "avatar"
    | "cover"
    | "company_logo"
    | "event_image"
    | "resume"
    | "company_document"
    | "expert_document"
    | "chat";

export interface UploadedFile {
    id: string;
    url: string;
    original_filename: string;
    mime_type: string;
    size: number;
    kind: UploadKind;
    visibility: "public" | "private";
}

/** Size limits per kind, mirrored from the backend so users hear about them before uploading */
export const UPLOAD_LIMITS: Record<UploadKind, number> = {
    avatar: 5 << 20,
    cover: 5 << 20,
    company_logo: 2 << 20,
    event_image: 5 << 20,
    resume: 5 << 20,
    company_document: 10 << 20,
    expert_document: 10 << 20,
    chat: 10 << 20,
};

export async function uploadFile(
    file: File,
    kind: UploadKind,
    extra?: { moduleName?: string; recordId?: string },
): Promise<UploadedFile> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("kind", kind);
    if (extra?.moduleName) formData.append("module_name", extra.moduleName);
    if (extra?.recordId) formData.append("record_id", extra.recordId);
    const res = (await api.post("/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    })) as unknown as UploadedFile;
    if (!res?.url) throw new Error("File upload failed. Please try again.");
    return res;
}

const PRIVATE_REF = /^\/api\/files\/([a-f0-9]{24})$/;

/** True for a stored reference to a private file, which needs a signed link to open */
export function isPrivateFileRef(url?: string | null): boolean {
    return !!url && PRIVATE_REF.test(url);
}

// Signed links last 10 minutes on the server; reuse one for 8
const linkCache = new Map<string, { url: string; until: number }>();

/** Turns a stored file URL into one the browser can open. Public URLs come back as they are. */
export async function resolveFileUrl(url: string): Promise<string> {
    const match = url.match(PRIVATE_REF);
    if (!match) return url;
    const cached = linkCache.get(match[1]);
    if (cached && cached.until > Date.now()) return cached.url;
    const res = (await api.get(`/files/${match[1]}/link`)) as unknown as { url: string };
    linkCache.set(match[1], { url: res.url, until: Date.now() + 8 * 60_000 });
    return res.url;
}

/** Opens a stored file in a new tab, fetching a signed link first when it is private */
export async function openFile(url: string) {
    // Open the tab inside the click so pop-up blockers allow it, then point it at the link
    const tab = isPrivateFileRef(url) ? window.open("", "_blank") : null;
    try {
        const resolved = await resolveFileUrl(url);
        if (tab) tab.location.href = resolved;
        else window.open(resolved, "_blank", "noopener,noreferrer");
    } catch (err) {
        tab?.close();
        throw err;
    }
}

/** For <img> tags showing a file that may be private (e.g. a chat image) */
export function useFileUrl(url?: string | null): string | null {
    const isPrivate = isPrivateFileRef(url);
    const [signed, setSigned] = useState<{ ref: string; url: string } | null>(null);
    useEffect(() => {
        if (!url || !isPrivate) return;
        let alive = true;
        resolveFileUrl(url)
            .then((u) => alive && setSigned({ ref: url, url: u }))
            .catch(() => undefined);
        return () => {
            alive = false;
        };
    }, [url, isPrivate]);
    if (!url) return null;
    if (!isPrivate) return url;
    return signed?.ref === url ? signed.url : null;
}
