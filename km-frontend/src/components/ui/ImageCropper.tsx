'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from '@phosphor-icons/react';

/** Width of the crop window on screen for a square crop, in CSS pixels */
const VIEW = 288;
const MAX_ZOOM = 3;

interface ImageCropperProps {
  file: File;
  /** Width of the saved image (its height follows the aspect) */
  outputSize?: number;
  /** Width divided by height of the crop, 1 for a square */
  aspect?: number;
  /** The guide drawn over the crop: a circle (profile photos), a rounded square (logos) or the plain frame */
  shape?: 'round' | 'square' | 'rect';
  /** PNG keeps a logo's transparent background; JPEG is smaller for photos */
  format?: 'image/jpeg' | 'image/png';
  saveLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onCrop: (cropped: File) => void;
  /** The browser couldn't open the image (a broken or unusual file); without it, the crop just closes */
  onError?: () => void;
}

/** Picker list for photos the cropper takes. Extensions too: some systems report no type for .webp. */
export const CROPPABLE_ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';

/** A JPG, PNG or WebP, judged by its type or its file name (some systems report no or an odd type for .webp) */
export function isCroppableImage(file: File): boolean {
  return /^image\/(jpeg|png|webp)$/.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
}

export function isSvgImage(file: File): boolean {
  return file.type === 'image/svg+xml' || (!file.type && /\.svg$/i.test(file.name));
}

/** Crop window size: square crops stay 288px; wide ones use the room the screen has (up to 480px) */
function viewSize(aspect: number): { w: number; h: number } {
  const room = typeof window === 'undefined' ? VIEW : window.innerWidth - 80;
  const w = aspect > 1 ? Math.round(Math.max(VIEW, Math.min(480, room))) : VIEW;
  return { w, h: Math.round(w / aspect) };
}

interface Box {
  x: number;
  y: number;
  zoom: number;
}

/** Drag to move, slider or wheel to zoom. By default a square crop with a round guide (profile photos). */
export default function ImageCropper({
  file,
  outputSize = 512,
  aspect = 1,
  shape = 'round',
  format = 'image/jpeg',
  saveLabel = 'Save photo',
  busy = false,
  onCancel,
  onCrop,
  onError,
}: ImageCropperProps) {
  const [{ w: VW, h: VH }] = useState(() => viewSize(aspect));
  const [src, setSrc] = useState('');
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [box, setBox] = useState<Box>({ x: 0, y: 0, zoom: 1 });
  const imgRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ id: number; startX: number; startY: number; x: number; y: number } | null>(null);
  const failRef = useRef(onError || onCancel);
  useEffect(() => {
    failRef.current = onError || onCancel;
  });

  useEffect(() => {
    const url = URL.createObjectURL(file);
    // Shown once decoded, so the size is known before the photo appears
    const probe = new Image();
    probe.onload = () => {
      setNatural(null);
      setSrc(url);
    };
    // Without this a file the browser can't decode leaves an empty crop box and no way on
    probe.onerror = () => failRef.current();
    probe.src = url;
    return () => {
      probe.onload = null;
      probe.onerror = null;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // Scale at zoom 1: the photo just covers the window
  const baseScale = natural ? Math.max(VW / natural.w, VH / natural.h) : 1;

  const clamp = useCallback(
    (b: Box): Box => {
      if (!natural) return b;
      const s = baseScale * b.zoom;
      const minX = VW - natural.w * s;
      const minY = VH - natural.h * s;
      return { zoom: b.zoom, x: Math.min(0, Math.max(minX, b.x)), y: Math.min(0, Math.max(minY, b.y)) };
    },
    [natural, baseScale, VW, VH],
  );

  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const w = e.currentTarget.naturalWidth;
    const h = e.currentTarget.naturalHeight;
    const s = Math.max(VW / w, VH / h);
    setNatural({ w, h });
    // Start centred
    setBox({ zoom: 1, x: (VW - w * s) / 2, y: (VH - h * s) / 2 });
  };

  /** Zooms around the centre of the window */
  const setZoom = (zoom: number) => {
    const z = Math.min(MAX_ZOOM, Math.max(1, zoom));
    setBox((b) => {
      const oldS = baseScale * b.zoom;
      const newS = baseScale * z;
      const cx = (VW / 2 - b.x) / oldS;
      const cy = (VH / 2 - b.y) / oldS;
      return clamp({ zoom: z, x: VW / 2 - cx * newS, y: VH / 2 - cy * newS });
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, x: box.x, y: box.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    setBox((b) => clamp({ ...b, x: d.x + e.clientX - d.startX, y: d.y + e.clientY - d.startY }));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 20 : 5;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const m = moves[e.key];
    if (m) {
      e.preventDefault();
      setBox((b) => clamp({ ...b, x: b.x + m[0], y: b.y + m[1] }));
    } else if (e.key === '+' || e.key === '=') {
      setZoom(box.zoom + 0.1);
    } else if (e.key === '-') {
      setZoom(box.zoom - 0.1);
    }
  };

  // The wheel listener must not be passive, or the page scrolls as well
  const viewRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(setZoom);
  const boxRef = useRef(box);
  useEffect(() => {
    zoomRef.current = setZoom;
    boxRef.current = box;
  });
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomRef.current(boxRef.current.zoom - e.deltaY * 0.002);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const save = () => {
    const img = imgRef.current;
    if (!img || !natural) return;
    const s = baseScale * box.zoom;
    const outW = outputSize;
    const outH = Math.round(outputSize / aspect);
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // JPEG has no transparency: fill white so see-through parts don't turn black
    if (format === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outW, outH);
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, -box.x / s, -box.y / s, VW / s, VH / s, 0, 0, outW, outH);
    const ext = format === 'image/png' ? 'png' : 'jpg';
    canvas.toBlob(
      (blob) => {
        if (blob) onCrop(new File([blob], `cropped.${ext}`, { type: format }));
      },
      format,
      0.9,
    );
  };

  const s = baseScale * box.zoom;

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        ref={viewRef}
        role="application"
        aria-label="Photo crop area. Drag or use the arrow keys to move the photo; plus and minus to zoom."
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className="relative overflow-hidden rounded-xl bg-km-surface touch-none select-none cursor-grab active:cursor-grabbing outline-none focus-visible:ring-4 focus-visible:ring-[#DCE8FB] dark:focus-visible:ring-[#16294F]"
        style={{ width: VW, height: VH }}
      >
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={src}
            alt=""
            onLoad={onLoad}
            draggable={false}
            className="absolute top-0 left-0 max-w-none origin-top-left pointer-events-none"
            style={natural ? { width: natural.w * s, height: natural.h * s, transform: `translate(${box.x}px, ${box.y}px)` } : { opacity: 0 }}
          />
        )}
        {/* Darkens what falls outside the round photo or logo */}
        {shape !== 'rect' && (
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 shadow-[0_0_0_999px_rgba(7,26,77,0.55)] ${shape === 'round' ? 'rounded-full' : 'rounded-2xl'}`}
          />
        )}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 border-2 border-white/90 ${shape === 'round' ? 'rounded-full' : shape === 'square' ? 'rounded-2xl' : 'rounded-xl'}`}
        />
      </div>

      <div className="flex w-full items-center gap-3" style={{ maxWidth: VW }}>
        <button type="button" onClick={() => setZoom(box.zoom - 0.2)} className="text-km-text-secondary hover:text-km-heading cursor-pointer" aria-label="Zoom out">
          <MagnifyingGlassMinusIcon size={20} />
        </button>
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={box.zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          aria-label="Zoom"
          className="flex-1 accent-km-blue"
        />
        <button type="button" onClick={() => setZoom(box.zoom + 0.2)} className="text-km-text-secondary hover:text-km-heading cursor-pointer" aria-label="Zoom in">
          <MagnifyingGlassPlusIcon size={20} />
        </button>
      </div>

      <div className="flex w-full justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={busy} className="btn-outline h-10 px-4 text-sm disabled:opacity-60">
          Cancel
        </button>
        <button type="button" onClick={save} disabled={busy || !natural} className="btn-primary h-10 px-5 text-sm disabled:opacity-60 disabled:cursor-not-allowed">
          {busy ? 'Saving…' : saveLabel}
        </button>
      </div>
    </div>
  );
}
