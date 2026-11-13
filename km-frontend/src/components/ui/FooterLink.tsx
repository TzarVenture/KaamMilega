import Link from 'next/link';

interface Props {
    children: React.ReactNode;
    href: string;
}

/** A footer link: light text on the navy footer, 44px tall on phones so it is easy to tap */
export default function FooterLink({ children, href }: Props) {
    return (
        <Link
            href={href}
            className="flex min-h-11 items-center text-sm text-white/75 hover:text-white hover:underline sm:min-h-0 sm:py-1.5 transition-colors"
        >
            {children}
        </Link>
    );
}
