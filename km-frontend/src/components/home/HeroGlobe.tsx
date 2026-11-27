'use client';

import React, { useEffect, useRef } from 'react';

/**
 * The dot of the KaamMilega K, drawn as a slowly turning globe: the logo's orange-to-red sphere
 * with light dotted continents passing across it and India picked out in white with a marker. One turn takes 28 seconds and it starts with
 * India facing the viewer. It is drawn on a canvas (no 3D library), stops while off screen, and
 * stands still for people who ask their device for less motion.
 */

type Ring = [number, number][]; // [longitude, latitude] in degrees

// Rough continent outlines: at this size only the familiar shapes matter
const LAND: Ring[] = [
    // North America
    [[-168, 66], [-162, 70], [-140, 70], [-125, 72], [-95, 72], [-80, 73], [-62, 66], [-56, 52], [-66, 45], [-75, 38], [-81, 31], [-80, 25], [-83, 29], [-90, 30], [-97, 26], [-97, 20], [-90, 16], [-84, 10], [-80, 8], [-86, 13], [-92, 15], [-105, 20], [-110, 24], [-115, 30], [-118, 34], [-124, 40], [-124, 48], [-133, 56], [-145, 60], [-158, 58], [-165, 62]],
    // Greenland
    [[-55, 60], [-45, 60], [-20, 70], [-20, 80], [-45, 83], [-65, 80], [-58, 70]],
    // South America
    [[-80, 8], [-72, 12], [-62, 10], [-50, 0], [-35, -6], [-38, -13], [-40, -22], [-48, -28], [-58, -38], [-65, -42], [-68, -52], [-72, -50], [-75, -40], [-72, -30], [-71, -18], [-76, -13], [-81, -5], [-80, 1]],
    // Europe
    [[-10, 36], [-9, 43], [-2, 44], [-5, 48], [0, 50], [5, 53], [8, 57], [5, 62], [12, 66], [20, 70], [30, 71], [40, 68], [45, 60], [40, 48], [35, 45], [28, 41], [26, 38], [22, 37], [20, 40], [16, 38], [12, 44], [8, 44], [3, 42], [0, 38]],
    // Britain
    [[-6, 50], [1, 51], [2, 53], [-2, 57], [-5, 58], [-6, 55], [-4, 53]],
    // Africa
    [[-17, 21], [-16, 14], [-12, 8], [-8, 4], [0, 5], [8, 4], [9, -1], [13, -6], [12, -17], [15, -27], [19, -35], [25, -34], [32, -28], [35, -24], [40, -15], [40, -10], [39, -4], [43, 2], [51, 11], [44, 11], [38, 18], [33, 28], [30, 31], [20, 32], [10, 37], [0, 36], [-6, 35], [-10, 30], [-14, 26]],
    // Madagascar
    [[44, -25], [47, -25], [50, -15], [49, -12], [44, -17]],
    // Asia, with Arabia, India and South-East Asia
    [[26, 40], [36, 36], [35, 32], [34, 28], [39, 21], [43, 13], [52, 17], [57, 22], [56, 26], [50, 29], [57, 25], [62, 25], [67, 24], [73, 21], [77, 8], [80, 13], [80, 16], [87, 21], [92, 22], [94, 17], [98, 10], [100, 4], [104, 1], [103, 8], [100, 13], [106, 10], [109, 13], [107, 21], [115, 23], [121, 30], [122, 37], [119, 39], [122, 41], [126, 38], [129, 35], [130, 42], [136, 45], [141, 53], [135, 55], [140, 60], [155, 60], [163, 62], [178, 65], [180, 69], [160, 70], [140, 72], [113, 74], [100, 78], [80, 73], [70, 73], [60, 70], [45, 68], [40, 68], [30, 71], [45, 60], [40, 48], [50, 45], [48, 40], [42, 41], [35, 45], [28, 41]],
    // Sri Lanka
    [[80, 6], [82, 7], [81, 9.5], [79.8, 8.5]],
    // Japan
    [[130, 31], [135, 34], [140, 36], [141, 41], [145, 44], [142, 45], [140, 40], [136, 36], [131, 34]],
    // Sumatra, Borneo, New Guinea
    [[95, 5], [98, 4], [106, -6], [104, -5], [99, 0]],
    [[109, 1], [117, 7], [119, 1], [116, -4], [110, -3]],
    [[131, -1], [141, -3], [150, -10], [143, -9], [137, -5]],
    // Australia
    [[114, -22], [122, -18], [130, -12], [137, -12], [136, -16], [142, -11], [146, -19], [153, -26], [150, -37], [144, -38], [140, -38], [135, -35], [129, -32], [115, -34], [114, -26]],
    // New Zealand
    [[172, -34], [178, -38], [175, -41], [167, -46], [172, -41]],
];

// India in full, with Jammu & Kashmir and Ladakh, drawn denser and brighter than the rest
const INDIA: Ring = [[68.2, 23.6], [70, 21], [72.8, 19], [73.5, 16], [74.5, 13], [76.5, 8.3], [77.6, 7.9], [80, 10.3], [80.3, 13.5], [82, 16.5], [84.5, 18.6], [87, 21.4], [88.8, 21.8], [89.1, 24], [88.2, 26.4], [89.8, 26.2], [92, 26.9], [92.4, 24.8], [91.6, 23], [93.3, 22.5], [94.5, 24.5], [95.2, 26.6], [97.2, 27.8], [96, 29.3], [94, 29.3], [92, 27.8], [88.7, 27.3], [88, 28], [84.5, 28.5], [81, 30.2], [79.2, 31.4], [79.5, 32.8], [79.3, 34.2], [80.2, 35.4], [77.8, 35.6], [76, 36.4], [74.6, 37], [74.2, 35.9], [73.6, 34.5], [74.4, 32.8], [74.6, 31.1], [72.5, 29], [70.4, 27.8], [69.6, 26.6], [70.6, 25.4], [68.8, 24.3]];

function inside(lon: number, lat: number, ring: Ring) {
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
}

const RAD = Math.PI / 180;

/** Dots spaced evenly over the sphere inside the given outlines, as [longitude, latitude] in radians */
function dotsIn(step: number, minLat: number, maxLat: number, keep: (lon: number, lat: number) => boolean) {
    const out: [number, number][] = [];
    for (let lat = minLat; lat <= maxLat; lat += step) {
        const lonStep = step / Math.max(0.2, Math.cos(lat * RAD));
        for (let lon = -180; lon < 180; lon += lonStep) {
            if (keep(lon, lat)) out.push([lon * RAD, lat * RAD]);
        }
    }
    return out;
}

const LAND_DOTS = dotsIn(2.6, -56, 82, (lon, lat) => !inside(lon, lat, INDIA) && LAND.some((r) => inside(lon, lat, r)));
const INDIA_DOTS = dotsIn(1.35, 6, 38, (lon, lat) => inside(lon, lat, INDIA));
const MARKER: [number, number] = [78 * RAD, 22 * RAD]; // the middle of India

const TURN_MS = 28_000;
const TILT = 18 * RAD; // lean the north pole towards the viewer a little
const START = -78 * RAD; // India in front at first paint

export default function HeroGlobe({ className }: { className?: string }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const still = window.matchMedia('(prefers-reduced-motion: reduce)');
        let size = 0;
        let frame = 0;
        let visible = true;
        let spun = 0; // angle turned so far, kept across pauses
        let last = 0;

        const resize = () => {
            const box = canvas.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            size = box.width;
            canvas.width = Math.round(box.width * dpr);
            canvas.height = Math.round(box.height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        const draw = () => {
            const r = size / 2;
            if (r <= 0) return;
            ctx.clearRect(0, 0, size, size);

            // The sphere, in the logo dot's own colours
            const body = ctx.createLinearGradient(r * 0.4, 0, r * 1.4, size);
            body.addColorStop(0, '#FD9401');
            body.addColorStop(0.5, '#FE5A00');
            body.addColorStop(1, '#F00A01');
            ctx.beginPath();
            ctx.arc(r, r, r, 0, Math.PI * 2);
            ctx.fillStyle = body;
            ctx.fill();

            // Continents: front dots are brighter and bigger, the ones near the edge fade out
            const sinT = Math.sin(TILT);
            const cosT = Math.cos(TILT);
            const turn = START + spun;
            const dot = Math.max(0.8, r * 0.022);
            /** Screen position and depth (0 at the edge, 1 facing us) of a point, or null when behind */
            const place = (lon: number, lat: number): [number, number, number] | null => {
                const l = lon + turn;
                const cl = Math.cos(lat);
                const y = Math.sin(lat);
                const z0 = cl * Math.cos(l);
                const z = y * sinT + z0 * cosT;
                if (z <= 0.05) return null;
                return [r + cl * Math.sin(l) * r * 0.97, r - (y * cosT - z0 * sinT) * r * 0.97, z];
            };
            const paint = (dots: [number, number][], colour: string, alpha: (z: number) => number, radius: number) => {
                ctx.fillStyle = colour;
                for (const [lon, lat] of dots) {
                    const at = place(lon, lat);
                    if (!at) continue;
                    ctx.globalAlpha = alpha(at[2]);
                    ctx.beginPath();
                    ctx.arc(at[0], at[1], radius * (0.55 + 0.45 * at[2]), 0, Math.PI * 2);
                    ctx.fill();
                }
            };
            paint(LAND_DOTS, '#FFE2C7', (z) => 0.15 + 0.5 * z, dot);
            paint(INDIA_DOTS, '#FFFFFF', (z) => 0.35 + 0.65 * z, dot * 0.8);
            ctx.globalAlpha = 1;

            // A location marker in the middle of India: white ring with a navy centre
            const pin = place(MARKER[0], MARKER[1]);
            if (pin && pin[2] > 0.25) {
                const k = Math.max(2.5, r * 0.07) * (0.6 + 0.4 * pin[2]);
                ctx.globalAlpha = Math.min(1, (pin[2] - 0.25) * 3);
                ctx.beginPath();
                ctx.arc(pin[0], pin[1], k, 0, Math.PI * 2);
                ctx.fillStyle = '#FFFFFF';
                ctx.fill();
                ctx.beginPath();
                ctx.arc(pin[0], pin[1], k * 0.5, 0, Math.PI * 2);
                ctx.fillStyle = '#071A4D';
                ctx.fill();
                ctx.globalAlpha = 1;
            }

            // Light from the top left and a soft shadow on the far side, so it reads as round
            const light = ctx.createRadialGradient(r * 0.62, r * 0.5, 0, r * 0.62, r * 0.5, r * 1.15);
            light.addColorStop(0, 'rgba(255,255,255,0.22)');
            light.addColorStop(0.55, 'rgba(255,255,255,0)');
            const shade = ctx.createRadialGradient(r * 0.75, r * 0.7, r * 0.55, r, r, r);
            shade.addColorStop(0, 'rgba(120,10,0,0)');
            shade.addColorStop(1, 'rgba(120,10,0,0.32)');
            for (const fill of [light, shade]) {
                ctx.beginPath();
                ctx.arc(r, r, r, 0, Math.PI * 2);
                ctx.fillStyle = fill;
                ctx.fill();
            }
        };

        const tick = (now: number) => {
            if (last) spun += ((now - last) / TURN_MS) * Math.PI * 2;
            last = now;
            draw();
            frame = requestAnimationFrame(tick);
        };

        const start = () => {
            cancelAnimationFrame(frame);
            last = 0;
            if (visible && !still.matches) frame = requestAnimationFrame(tick);
            else draw();
        };

        resize();
        draw();
        start();

        const sized = new ResizeObserver(() => {
            resize();
            draw();
        });
        sized.observe(canvas);

        const seen = new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            start();
        });
        seen.observe(canvas);

        still.addEventListener('change', start);

        return () => {
            cancelAnimationFrame(frame);
            sized.disconnect();
            seen.disconnect();
            still.removeEventListener('change', start);
        };
    }, []);

    return <canvas ref={canvasRef} aria-hidden="true" className={className} />;
}
