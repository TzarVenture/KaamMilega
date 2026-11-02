"use client";

// Phone photos are often 4–8 MB; a chat or feed image never needs more than this
const MAX_SIDE = 1920;
const QUALITY = 0.82;
// Small files are sent as they are
const SKIP_BELOW = 400 * 1024;

/**
 * Shrinks a large JPEG, PNG or WebP photo in the browser before upload, so it sends faster on
 * mobile data. GIFs (animation), documents and files that would not get smaller are returned
 * unchanged. PNGs become WebP to keep transparency.
 */
export async function compressImage(file: File): Promise<File> {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < SKIP_BELOW) return file;
    if (typeof createImageBitmap !== "function") return file;
    try {
        const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
        const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
        const width = Math.round(bitmap.width * scale);
        const height = Math.round(bitmap.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return file;
        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();

        const type = file.type === "image/jpeg" ? "image/jpeg" : "image/webp";
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY));
        if (!blob || blob.size >= file.size) return file;
        const ext = type === "image/jpeg" ? ".jpg" : ".webp";
        const name = file.name.replace(/\.[^.]+$/, "") + ext;
        return new File([blob], name, { type, lastModified: file.lastModified });
    } catch {
        return file;
    }
}
