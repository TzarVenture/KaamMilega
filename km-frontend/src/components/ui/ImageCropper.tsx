'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from '@phosphor-icons/react';

/** Size of the crop window on screen, in CSS pixels */
const VIEW = 288;
const MAX_ZOOM = 3;

interface ImageCropperProps {
  file: File;
  /** Width and height of the saved square image */
  outputSize?: number;
  busy?: boolean;
  onCancel: () => void;
  onCrop: (cropped: File) => void;
}

interface Box {
  x: number;
  y: number;
  zoom: number;
}

/** Square crop with a round guide: drag to move, slider or wheel to zoom */
export default function ImageCropper({ file, outputSize = 512, busy = false, onCancel, onCrop }: ImageCropperProps) {
  const [src, setSrc] = useState('');
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [box, setBox] = useState<Box>({ x: 0, y: 0, zoom: 1 });
  const imgRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ id: number; startX: number; startY: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    // Shown once decoded, so the size is known before the photo appears
    const probe = new Image();
    probe.onload = () => {
      setNatural(null);
      setSrc(url);
    };
    probe.src = url;
    return () => {
      probe.onload = null;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // Scale at zoom 1: the short side fills the window
  const baseScale = natural ? VIEW / Math.min(natural.w, natural.h) : 1;

  const clamp = useCallback(
    (b: Box): Box => {
      if (!natural) return b;
      const s = baseScale * b.zoom;
      const minX = VIEW - natural.w * s;
      const minY = VIEW - natural.h * s;
      return { zoom: b.zoom, x: Math.min(0, Math.max(minX, b.x)), y: Math.min(0, Math.max(minY, b.y)) };
    },
    [natural, baseScale],
  );

  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const w = e.currentTarget.naturalWidth;
    const h = e.currentTarget.naturalHeight;
    const s = VIEW / Math.min(w, h);
    setNatural({ w, h });
    // Start centred
    setBox({ zoom: 1, x: (VIEW - w * s) / 2, y: (VIEW - h * s) / 2 });
  };

  /** Zooms around the centre of the window */
  const setZoom = (zoom: number) => {
    const z = Math.min(MAX_ZOOM, Math.max(1, zoom));
    setBox((b) => {
      const oldS = baseScale * b.zoom;
      const newS = baseScale * z;
      const cx = (VIEW / 2 - b.x) / oldS;
      const cy = (VIEW / 2 - b.y) / oldS;
      return clamp({ zoom: z, x: VIEW / 2 - cx * newS, y: VIEW / 2 - cy * newS });
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
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outputSize, outputSize);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, -box.x / s, -box.y / s, VIEW / s, VIEW / s, 0, 0, outputSize, outputSize);
    canvas.toBlob(
      (blob) => {
        if (blob) onCrop(new File([blob], 'profile-photo.jpg', { type: 'image/jpeg' }));
      },
      'image/jpeg',
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
        style={{ width: VIEW, height: VIEW }}
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
        {/* Darkens what falls outside the round photo */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgba(7,26,77,0.55)]" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/90" />
      </div>

      <div className="flex w-full max-w-[288px] items-center gap-3">
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
          {busy ? 'Saving…' : 'Save photo'}
        </button>
      </div>
    </div>
  );
}
