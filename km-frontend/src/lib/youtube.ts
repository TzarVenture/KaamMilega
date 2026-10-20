/**
 * YouTube Utility functions for Kaammilega™
 * Extracts video IDs, provides reliable thumbnails, and handles smart mobile app deep-linking.
 */

const YOUTUBE_REGEX = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;

export function extractYouTubeVideoId(rawUrl: string): string | null {
    if (!rawUrl) return null;
    const trimmed = rawUrl.trim();
    const match = trimmed.match(YOUTUBE_REGEX);
    if (match && match[1] && match[1].length === 11) {
        return match[1];
    }
    try {
        const url = new URL(trimmed);
        const v = url.searchParams.get("v");
        if (v && v.length === 11) return v;
    } catch {
        // invalid URL format
    }
    return null;
}

export function getYouTubeThumbnail(videoId: string): string {
    if (!videoId) return "";
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function getYouTubeMaxResThumbnail(videoId: string): string {
    if (!videoId) return "";
    return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

/**
 * Smart open:
 * On Mobile (Android/iOS), attempts to open in the native YouTube app via deep-link scheme.
 * Falls back seamlessly to browser watch URL.
 * On Desktop / Laptop, opens in a new tab.
 */
export function openYouTubeVideo(videoId: string, fallbackUrl?: string) {
    const webUrl = fallbackUrl || `https://www.youtube.com/watch?v=${videoId}`;
    if (typeof window === "undefined") return;

    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || "";
    const isMobile = /android|iphone|ipad|ipod/i.test(userAgent);

    if (isMobile && videoId) {
        const appUrl = `vnd.youtube:${videoId}`;
        const startTime = Date.now();
        
        // Attempt deep link
        window.location.href = appUrl;

        // If the app didn't open within 1.2s, fallback to web URL
        setTimeout(() => {
            if (Date.now() - startTime < 2000) {
                window.open(webUrl, "_blank");
            }
        }, 1200);
    } else {
        window.open(webUrl, "_blank", "noopener,noreferrer");
    }
}
