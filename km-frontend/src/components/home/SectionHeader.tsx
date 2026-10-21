import Link from 'next/link';
import { ArrowRightIcon } from '@phosphor-icons/react/ssr';

interface SectionHeaderProps {
    title: React.ReactNode;
    description?: React.ReactNode;
    /** Optional "view all" style link shown on the right (below the text on mobile) */
    action?: { href: string; label: string };
    align?: 'left' | 'center';
    /** Use on dark (navy) surfaces */
    inverse?: boolean;
    id?: string;
}

/**
 * Shared home section heading: one type scale, spacing and link treatment for every section
 * (design.md §4: Poppins bold headings, Text Secondary for supporting copy, sentence case).
 */
export default function SectionHeader({ title, description, action, align = 'center', inverse = false, id }: SectionHeaderProps) {
    const centered = align === 'center';
    return (
        <div
            className={`mb-6 sm:mb-8 flex flex-col gap-3 ${
                centered ? 'items-center text-center' : 'sm:flex-row sm:items-end sm:justify-between'
            }`}
        >
            <div className={centered ? 'max-w-2xl' : 'max-w-2xl'}>
                <h2
                    id={id}
                    className={`text-2xl sm:text-[28px] lg:text-[32px] font-bold tracking-[-0.02em] leading-tight ${
                        inverse ? 'text-white' : 'text-km-text-primary'
                    }`}
                >
                    {title}
                </h2>
                {description && (
                    <p className={`mt-2 text-[15px] sm:text-base leading-relaxed ${inverse ? 'text-white/75' : 'text-km-text-secondary'}`}>
                        {description}
                    </p>
                )}
            </div>
            {action && (
                <Link
                    href={action.href}
                    className={`group inline-flex items-center gap-1.5 text-sm font-semibold shrink-0 ${
                        inverse ? 'text-white hover:text-white/80' : 'text-km-heading hover:text-km-blue'
                    } transition-colors`}
                >
                    {action.label}
                    <ArrowRightIcon size={16} weight="bold" className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
            )}
        </div>
    );
}
