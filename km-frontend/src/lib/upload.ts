"use client";

import { useCallback, useEffect, useState } from "react";
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
    | "feed_image"
    | "feed_video"
    | "ad_creative"
    | "ad_image"
    | "resume"
    | "company_document"
    | "expert_document"
    | "certificate"
    | "police_certificate"
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
    feed_image: 5 << 20,
    feed_video: 50 << 20,
    ad_creative: 10 << 20,
    ad_image: 5 << 20,
    resume: 5 << 20,
    company_document: 10 << 20,
    expert_document: 10 << 20,
    certificate: 5 << 20,
    police_certificate: 5 << 20,
    chat: 10 << 20,
};

export async function uploadFile(
    file: File,
    kind: UploadKind,
    extra?: {
        moduleName?: string;
        recordId?: string;
        /** Called with 0..1 while the file is sent */
        onProgress?: (fraction: number) => void;
    },
): Promise<UploadedFile> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("kind", kind);
    if (extra?.moduleName) formData.append("module_name", extra.moduleName);
    if (extra?.recordId) formData.append("record_id", extra.recordId);
    const onProgress = extra?.onProgress;
    const res = (await api.post("/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: onProgress
            ? (e) => {
                  if (e.total) onProgress(Math.min(1, e.loaded / e.total));
              }
            : undefined,
    })) as unknown as UploadedFile;
    if (!res?.url) throw new Error("File upload failed. Please try again.");
    return res;
}

/** The longest video on a post, in seconds (the server refuses longer ones) */
export const MAX_VIDEO_SECONDS = 60;

/**
 * Uploads a large file (a video) in parts: the server takes about 12 MB per request, so the file
 * is cut into the part size it asks for and sent in order. Each part is retried a few times on a
 * network error; if the upload still fails or is aborted, the server is told to drop it.
 */
export async function uploadLargeFile(
    file: File,
    kind: "feed_video",
    extra?: { onProgress?: (fraction: number) => void; signal?: AbortSignal },
): Promise<UploadedFile> {
    const started = (await api.post(
        "/files/multipart",
        { kind, filename: file.name, size: file.size },
        { signal: extra?.signal },
    )) as unknown as { id: string; part_size: number; parts: number };
    const { id, part_size: partSize, parts } = started;
    try {
        for (let n = 1; n <= parts; n++) {
            const chunk = file.slice((n - 1) * partSize, Math.min(n * partSize, file.size));
            const before = (n - 1) * partSize;
            for (let attempt = 1; ; attempt++) {
                try {
                    await api.put(`/files/multipart/${id}/parts/${n}`, chunk, {
                        headers: { "Content-Type": "application/octet-stream" },
                        // A part can take a while on a slow connection
                        timeout: 0,
                        signal: extra?.signal,
                        onUploadProgress: extra?.onProgress
                            ? (e) => extra.onProgress?.(Math.min(1, (before + (e.loaded ?? 0)) / file.size))
                            : undefined,
                    });
                    break;
                } catch (err) {
                    const code = (err as { code?: string }).code;
                    // The part arrived but its answer was lost: the server already wants the next one
                    if (attempt > 1 && code === "UPLOAD_PART_OUT_OF_ORDER") break;
                    // UPLOAD_BUSY: an earlier try of this part is still being stored, which can take a while
                    const busy = code === "UPLOAD_BUSY";
                    const retry = (code === "NETWORK_ERROR" || code === "TIMEOUT" || busy) && attempt < (busy ? 12 : 4);
                    if (!retry || extra?.signal?.aborted) throw err;
                    await new Promise((r) => setTimeout(r, busy ? 10_000 : 1500 * attempt));
                }
            }
        }
        const res = (await api.post(`/files/multipart/${id}/complete`, undefined, {
            signal: extra?.signal,
            timeout: 60_000,
        })) as unknown as UploadedFile;
        if (!res?.url) throw new Error("File upload failed. Please try again.");
        extra?.onProgress?.(1);
        return res;
    } catch (err) {
        api.delete(`/files/multipart/${id}`).catch(() => {});
        throw err;
    }
}

/** A video's length and size in the browser, or null if it can't be read */
export function readVideo(file: File): Promise<{ duration: number; width: number; height: number } | null> {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const v = document.createElement("video");
        v.preload = "metadata";
        v.muted = true;
        let timer: ReturnType<typeof setTimeout> | undefined = undefined;
        const done = (r: { duration: number; width: number; height: number } | null) => {
            clearTimeout(timer);
            URL.revokeObjectURL(url);
            resolve(r);
        };
        // Some files never say whether they can be read
        timer = setTimeout(() => done(null), 10_000);
        v.onloadedmetadata = () =>
            done(Number.isFinite(v.duration) ? { duration: v.duration, width: v.videoWidth, height: v.videoHeight } : null);
        v.onerror = () => done(null);
        v.src = url;
    });
}

/**
 * A still from early in the video, as a JPEG, to show before it plays. Null when the browser
 * can't draw the video (the post still works, just without the still).
 */
export function videoPoster(file: File): Promise<File | null> {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const v = document.createElement("video");
        v.preload = "auto";
        v.muted = true;
        v.playsInline = true;
        let settled = false;
        const done = (f: File | null) => {
            if (settled) return;
            settled = true;
            URL.revokeObjectURL(url);
            resolve(f);
        };
        const timer = setTimeout(() => done(null), 8000);
        v.onloadeddata = () => {
            v.currentTime = Math.min(1, (v.duration || 0) / 2);
        };
        v.onseeked = () => {
            clearTimeout(timer);
            const scale = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight, 1));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(v.videoWidth * scale));
            canvas.height = Math.max(1, Math.round(v.videoHeight * scale));
            const ctx = canvas.getContext("2d");
            if (!ctx) return done(null);
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((b) => done(b ? new File([b], "poster.jpg", { type: "image/jpeg" }) : null), "image/jpeg", 0.82);
        };
        v.onerror = () => {
            clearTimeout(timer);
            done(null);
        };
        v.src = url;
    });
}

const PRIVATE_REF = /^\/api\/files\/([a-f0-9]{24})$/;

/** True for a stored reference to a private file, which needs a signed link to open */
export function isPrivateFileRef(url?: string | null): boolean {
    return !!url && PRIVATE_REF.test(url);
}

// Signed links last 10 minutes on the server; reuse one for 8
const linkCache = new Map<string, { url: string; until: number }>();

/**
 * Turns a stored file URL into one the browser can open. Public URLs come back as they are.
 * With download set, the link makes the browser save the file under its original name.
 */
export async function resolveFileUrl(url: string, opts?: { download?: boolean }): Promise<string> {
    const match = url.match(PRIVATE_REF);
    if (!match) return url;
    const cacheKey = opts?.download ? `${match[1]}:dl` : match[1];
    const cached = linkCache.get(cacheKey);
    if (cached && cached.until > Date.now()) return cached.url;
    const res = (await api.get(`/files/${match[1]}/link`, {
        params: opts?.download ? { download: 1 } : undefined,
    })) as unknown as { url: string };
    linkCache.set(cacheKey, { url: res.url, until: Date.now() + 8 * 60_000 });
    return res.url;
}

/** Drops a cached link, e.g. after an image failed to load with it */
export function forgetFileUrl(url: string) {
    const match = url.match(PRIVATE_REF);
    if (match) linkCache.delete(match[1]);
}

/** Saves a stored file to the device under its original name */
export async function downloadFile(url: string, name: string) {
    let href: string;
    let revoke = false;
    if (isPrivateFileRef(url)) {
        // The signed link answers with Content-Disposition: attachment
        href = await resolveFileUrl(url, { download: true });
    } else {
        // Cross-origin links ignore the download attribute, so fetch the bytes first
        const blob = await fetch(url).then((r) => {
            if (!r.ok) throw new Error("Could not download this file. Please try again.");
            return r.blob();
        });
        href = URL.createObjectURL(blob);
        revoke = true;
    }
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (revoke) setTimeout(() => URL.revokeObjectURL(href), 10_000);
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

/**
 * For <img> tags showing a file that may be private (e.g. a chat image). `failed` turns true
 * when no link could be fetched; `retry` fetches a fresh one (also use it from the img's onError).
 */
export function useFileLink(url?: string | null): { src: string | null; failed: boolean; retry: () => void } {
    const isPrivate = isPrivateFileRef(url);
    const [attempt, setAttempt] = useState(0);
    const [state, setState] = useState<{ ref: string; attempt: number; url?: string; failed?: boolean } | null>(null);
    useEffect(() => {
        if (!url || !isPrivate) return;
        let alive = true;
        resolveFileUrl(url)
            .then((u) => alive && setState({ ref: url, attempt, url: u }))
            .catch(() => alive && setState({ ref: url, attempt, failed: true }));
        return () => {
            alive = false;
        };
    }, [url, isPrivate, attempt]);
    const retry = useCallback(() => {
        if (url) forgetFileUrl(url);
        setAttempt((a) => a + 1);
    }, [url]);
    if (!url) return { src: null, failed: false, retry };
    if (!isPrivate) return { src: url, failed: false, retry };
    const current = state?.ref === url && state.attempt === attempt ? state : null;
    return { src: current?.url ?? null, failed: !!current?.failed, retry };
}

export function useFileUrl(url?: string | null): string | null {
    return useFileLink(url).src;
}
