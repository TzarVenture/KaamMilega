import type { ReactNode } from 'react';
import AnimatedBoltIcon from '../AnimatedBoltIcon';

/**
 * KaamMilega navigation icons: a 24px grid, round 1.75 strokes, and one solid "accent" detail per
 * icon (the door, the clasp, the tassel...). The accent is ink when idle and brand orange on the
 * active page, and nudges up on hover of the nearest `group` (the nav item). Colours follow
 * currentColor, so light and dark themes come from the surrounding text colour.
 */
export interface NavIconProps {
    size?: number;
    className?: string;
    /** Current page: fills the accent detail in brand orange */
    active?: boolean;
    /** Thicker strokes for small sizes (e.g. 15px pills) */
    strokeWidth?: number;
}

export type NavIcon = (props: NavIconProps) => ReactNode;

function Base({ size = 22, className = '', active = false, strokeWidth = 1.75, children }: NavIconProps & { children: (accent: string) => ReactNode }) {
    const accent = `${active ? 'fill-[#FF6B00] dark:fill-[#FF7A1A]' : 'fill-current'} [transform-box:fill-box] origin-center transition-transform duration-200 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100`;
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`shrink-0 ${className}`}
            aria-hidden="true"
            focusable="false"
        >
            {children(accent)}
        </svg>
    );
}

export const HomeNavIcon: NavIcon = (p) => (
    <Base {...p}>
        {(a) => (
            <>
                <path d="M3.5 10.6 12 3.9l8.5 6.7" />
                <path d="M5.5 9.1v9.4a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V9.1" />
                <rect className={a} stroke="none" x="10" y="14" width="4" height="6.5" rx="1.4" />
            </>
        )}
    </Base>
);

export const FeedNavIcon: NavIcon = (p) => (
    <Base {...p}>
        {(a) => (
            <>
                <path d="M7 3.8h10" />
                <rect x="3.8" y="7" width="16.4" height="13.2" rx="2.6" />
                <circle className={a} stroke="none" cx="8.3" cy="11.4" r="1.9" />
                <path d="M11.6 11.4h4.8M8 16.2h8.4" />
            </>
        )}
    </Base>
);

export const NetworkNavIcon: NavIcon = (p) => (
    <Base {...p}>
        {(a) => (
            <>
                <circle cx="8.5" cy="8.3" r="3" />
                <path d="M3 19.8c.3-3.2 2.6-5.3 5.5-5.3s5.2 2.1 5.5 5.3" />
                <circle className={a} stroke="none" cx="16.8" cy="9.4" r="2.4" />
                <path d="M15.6 14.6c.4-.1.8-.1 1.2-.1 2.4 0 4.1 1.9 4.2 4.6" />
            </>
        )}
    </Base>
);

export const EventsNavIcon: NavIcon = (p) => (
    <Base {...p}>
        {(a) => (
            <>
                <rect x="3.5" y="5.2" width="17" height="15.3" rx="3" />
                <path d="M3.5 10h17M8 3.2v3.6M16 3.2v3.6" />
                <rect className={a} stroke="none" x="13.3" y="13.2" width="4" height="4" rx="1.1" />
            </>
        )}
    </Base>
);

export const JobsNavIcon: NavIcon = (p) => (
    <Base {...p}>
        {(a) => (
            <>
                <rect x="3" y="7.5" width="18" height="12.5" rx="2.6" />
                <path d="M9 7.5V6.2A2.2 2.2 0 0 1 11.2 4h1.6A2.2 2.2 0 0 1 15 6.2v1.3M3 12.6c2.8 1.2 5.8 1.8 9 1.8s6.2-.6 9-1.8" />
                <rect className={a} stroke="none" x="10.4" y="12.3" width="3.2" height="3.4" rx="1" />
            </>
        )}
    </Base>
);

export const MentorsNavIcon: NavIcon = (p) => (
    <Base {...p}>
        {(a) => (
            <>
                <path d="M12 4.2 2.8 8.8 12 13.4l9.2-4.6L12 4.2Z" />
                <path d="M6.5 11.1v4.4c0 1.6 2.5 3.1 5.5 3.1s5.5-1.5 5.5-3.1v-4.4M21.2 8.8v4.8" />
                <circle className={a} stroke="none" cx="21.2" cy="15.6" r="1.6" />
            </>
        )}
    </Base>
);

export const ChatNavIcon: NavIcon = (p) => (
    <Base {...p}>
        {(a) => (
            <>
                <path d="M6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H11.2l-4.6 3.3c-.4.3-1.1 0-1.1-.5V17A1.6 1.6 0 0 1 4 15.4V6.5A2.5 2.5 0 0 1 6.5 4Z" />
                <g className={a} stroke="none">
                    <circle cx="8.6" cy="10.5" r="1.25" />
                    <circle cx="12" cy="10.5" r="1.25" />
                    <circle cx="15.4" cy="10.5" r="1.25" />
                </g>
            </>
        )}
    </Base>
);

export const ResourcesNavIcon: NavIcon = (p) => (
    <Base {...p}>
        {(a) => (
            <>
                <path d="M12 6.6C10 5.1 7.4 4.5 3.8 4.8v13.6c3.6-.3 6.2.3 8.2 1.8 2-1.5 4.6-2.1 8.2-1.8V4.8c-1.1-.1-2.1-.1-3 0" />
                <path d="M12 6.6v13.6" />
                <path className={a} stroke="none" d="M14.4 3.4h3.2a.6.6 0 0 1 .6.6v6.4c0 .4-.5.7-.9.4L16 9.8l-1.3 1c-.4.3-.9 0-.9-.4V4a.6.6 0 0 1 .6-.6Z" />
            </>
        )}
    </Base>
);

export const NotificationsNavIcon: NavIcon = (p) => (
    <Base {...p}>
        {(a) => (
            <>
                <path d="M6 16.4V11a6 6 0 0 1 12 0v5.4l1.6 2.1H4.4L6 16.4Z" />
                <path d="M12 3v2" />
                <path className={a} stroke="none" d="M9.6 20.2h4.8a2.4 2.4 0 0 1-4.8 0Z" />
            </>
        )}
    </Base>
);

/** InstantMilega™ keeps its animated gradient bolt; this adapter gives it the NavIcon shape */
export const InstantNavIcon: NavIcon = ({ size, className }) => <AnimatedBoltIcon size={size} className={className} />;
