import { useEffect, useRef, useState } from 'react';

// Browsers without IntersectionObserver count as "in view" so content is never left hidden
const noObserver = () => typeof window !== 'undefined' && typeof IntersectionObserver === 'undefined';

/** True once the element has scrolled into view, then stays true (animations play once). */
export function useInViewOnce<T extends Element>(threshold = 0.35) {
    const ref = useRef<T>(null);
    const [inView, setInView] = useState(noObserver);

    useEffect(() => {
        const el = ref.current;
        if (!el || inView) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) {
                    setInView(true);
                    observer.disconnect();
                }
            },
            { threshold }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [inView, threshold]);

    return { ref, inView };
}
