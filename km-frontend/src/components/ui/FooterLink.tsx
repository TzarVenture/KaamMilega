import Link from 'next/link';

interface Props {
    children: React.ReactNode;
    href: string;
    /** Shows the label without a link, for pages that aren't ready yet */
    disabled?: boolean;
}

const base = 'flex min-h-11 items-center text-sm sm:min-h-0 sm:py-1.5';

/** A footer link: light text on the navy footer, 44px tall on phones so it is easy to tap */
export default function FooterLink({ children, href, disabled = false }: Props) {
    if (disabled) {
        // No href, so it can't be clicked, focused or opened in a new tab
        return (
            <span role="link" aria-disabled="true" className={`${base} text-white/40 cursor-not-allowed`}>
                {children}
            </span>
        );
    }
    return (
        <Link
            href={href}
            className={`${base} text-white/75 hover:text-white hover:underline transition-colors`}
        >
            {children}
        </Link>
    );
}
