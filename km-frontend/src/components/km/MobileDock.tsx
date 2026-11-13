'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import CustomImage from '@/components/ui/CustomImage';
import { FEATURES } from '@/config/features';
import {
    ChatNavIcon,
    FeedNavIcon,
    HomeNavIcon,
    InstantNavIcon,
    JobsNavIcon,
    MentorsNavIcon,
    ProfileNavIcon,
    type NavIcon,
} from './icons/NavIcons';

interface DockItem {
    href: string;
    label: string;
    Icon: NavIcon;
    /** Other paths that count as this tab */
    match?: string[];
    avatar?: string;
}

// Portals and auth screens have their own navigation (the recruiter portal has its own bottom bar)
const HIDDEN_ON = ['/recruiter', '/admin', '/login', '/register', '/signup', '/account'];

const TYPING_SELECTOR =
    'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=range]), textarea, select, [contenteditable="true"]';

/**
 * Bottom tab bar for phones (below md). The main places stay one tap away, so people
 * don't have to open the menu. It steps aside while the keyboard is up.
 */
interface DockUser {
    roles?: string[];
    role?: string;
    profile_image?: string;
}

export default function MobileDock({ isLoggedIn, user }: { isLoggedIn: boolean; user?: DockUser | null }) {
    const t = useTranslations('nav');
    const pathname = usePathname() || '/';
    const [typing, setTyping] = useState(false);
    const hidden = HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(p + '/'));

    // Reserve room at the bottom of the page (see .km-has-dock in globals.css)
    useEffect(() => {
        if (hidden) return;
        const root = document.documentElement;
        root.classList.add('km-has-dock');
        return () => root.classList.remove('km-has-dock');
    }, [hidden]);

    // On phones the keyboard pushes fixed bars up over the field being typed in, so hide while typing
    useEffect(() => {
        const onFocusIn = (e: FocusEvent) => {
            if (e.target instanceof Element && e.target.matches(TYPING_SELECTOR)) setTyping(true);
        };
        const onFocusOut = () => setTyping(false);
        document.addEventListener('focusin', onFocusIn);
        document.addEventListener('focusout', onFocusOut);
        return () => {
            document.removeEventListener('focusin', onFocusIn);
            document.removeEventListener('focusout', onFocusOut);
        };
    }, []);

    if (hidden) return null;

    const roles: string[] = Array.isArray(user?.roles) ? user.roles : user?.role ? [user.role] : [];
    const isRecruiter = roles.includes('recruiter');

    const items: DockItem[] = isLoggedIn
        ? [
              { href: '/', label: t('home'), Icon: HomeNavIcon },
              isRecruiter
                  ? { href: '/recruiter/jobs/list', label: t('myJobs'), Icon: JobsNavIcon }
                  : { href: '/jobs', label: t('jobs'), Icon: JobsNavIcon },
              { href: '/feed', label: t('feed'), Icon: FeedNavIcon },
              { href: '/chat', label: t('chat'), Icon: ChatNavIcon },
              { href: '/profile', label: t('profile'), Icon: ProfileNavIcon, match: ['/settings', '/wallet'], avatar: user?.profile_image },
          ]
        : [
              { href: '/', label: t('home'), Icon: HomeNavIcon },
              { href: '/jobs', label: t('jobs'), Icon: JobsNavIcon },
              FEATURES.INSTANT_MILEGA
                  ? { href: '/instant-milega', label: t('instant'), Icon: InstantNavIcon }
                  : { href: '/feed', label: t('feed'), Icon: FeedNavIcon },
              { href: '/mentorship', label: t('mentors'), Icon: MentorsNavIcon },
              { href: '/login', label: t('signIn'), Icon: ProfileNavIcon },
          ];

    const isActive = (item: DockItem) => {
        if (item.href === '/') return pathname === '/';
        return [item.href, ...(item.match ?? [])].some((p) => pathname === p || pathname.startsWith(p + '/'));
    };

    return (
        <nav
            aria-label={t('dockLabel')}
            data-hidden={typing}
            className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-km-border bg-km-surface-card pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-18px_rgba(7,26,77,0.35)] transition-transform duration-200 ease-out data-[hidden=true]:translate-y-full motion-reduce:transition-none"
        >
            <ul className="mx-auto flex h-16 max-w-lg items-stretch px-1">
                {items.map((item) => {
                    const active = isActive(item);
                    const { Icon } = item;
                    return (
                        <li key={item.href} className="flex-1 min-w-0">
                            <Link
                                href={item.href}
                                aria-current={active ? 'page' : undefined}
                                className="km-press group flex h-full flex-col items-center justify-center gap-1 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-km-link"
                            >
                                {/* Active tab sits on a soft pill, like the desktop nav's active tile */}
                                <span
                                    className={`flex h-8 w-14 max-w-full items-center justify-center rounded-full transition-colors duration-200 ${
                                        active ? 'bg-[#EAF1FC] text-km-heading dark:bg-[#172A50]' : 'text-km-text-secondary'
                                    }`}
                                >
                                    {item.avatar ? (
                                        <span className={`relative h-6 w-6 overflow-hidden rounded-full ${active ? 'ring-2 ring-km-heading' : 'ring-1 ring-km-border'}`}>
                                            <CustomImage src={item.avatar} alt="" className="h-full w-full object-cover" />
                                        </span>
                                    ) : (
                                        <Icon size={22} active={active} />
                                    )}
                                </span>
                                <span
                                    className={`block max-w-full truncate px-0.5 text-[11px] leading-none ${
                                        active ? 'font-semibold text-km-heading' : 'font-medium text-km-text-secondary'
                                    }`}
                                >
                                    {item.label}
                                </span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
