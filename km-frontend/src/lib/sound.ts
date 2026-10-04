'use client';

import { createUISFX, type CueName, type UISFXPlayer } from 'uisfx';

let sfxPlayer: UISFXPlayer | null = null;
let unlockListenerAttached = false;

/**
 * Returns the singleton UISFX audio player, safely guarded for client-side execution.
 * Sound pack: 'zen' (calm, elegant, professional tones tailored for KaamMilega).
 */
export const getSoundPlayer = (): UISFXPlayer | null => {
    if (typeof window === 'undefined') return null;

    if (!sfxPlayer) {
        try {
            sfxPlayer = createUISFX({
                pack: 'zen',
                volume: 0.35,
            });

            // Unlock audio context on first user interaction (browser autoplay compliance)
            if (!unlockListenerAttached) {
                unlockListenerAttached = true;
                const unlockAudio = () => {
                    sfxPlayer?.unlock().catch(() => {});
                    window.removeEventListener('pointerdown', unlockAudio);
                    window.removeEventListener('keydown', unlockAudio);
                };
                window.addEventListener('pointerdown', unlockAudio, { once: true });
                window.addEventListener('keydown', unlockAudio, { once: true });
            }
        } catch (e) {
            console.warn('[uisfx] Failed to initialize sound player', e);
            return null;
        }
    }

    return sfxPlayer;
};

/**
 * Play a semantic UI sound cue safely.
 */
export const playSound = (cue: CueName = 'notification') => {
    try {
        const player = getSoundPlayer();
        player?.play(cue);
    } catch {
        // Silently ignore if audio is suspended or blocked
    }
};

/**
 * Pre-configured helpers for common application events
 */
export const playNotificationSound = () => playSound('notification');
export const playMessageReceivedSound = () => playSound('receive');
export const playMessageSentSound = () => playSound('send');
