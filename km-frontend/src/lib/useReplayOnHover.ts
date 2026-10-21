import { useEffect, type RefObject } from 'react';

/** Restart the finite CSS animations inside `root` (looping ones like a float keep running). */
export function replayAnimations(root: Element) {
    root.getAnimations({ subtree: true }).forEach((animation) => {
        if (animation.effect?.getComputedTiming().iterations === Infinity) return;
        animation.currentTime = 0;
        animation.play();
    });
}

/**
 * Replays an illustration's entrance animations when the pointer enters it, or enters the
 * closest ancestor matching `hostSelector` (e.g. the whole card). Only after the first play.
 */
export function useReplayOnHover(ref: RefObject<Element | null>, enabled: boolean, hostSelector?: string) {
    useEffect(() => {
        const el = ref.current;
        if (!el || !enabled) return;
        const host = (hostSelector && el.closest(hostSelector)) || el;
        const replay = () => replayAnimations(el);
        host.addEventListener('mouseenter', replay);
        return () => host.removeEventListener('mouseenter', replay);
    }, [ref, enabled, hostSelector]);
}
