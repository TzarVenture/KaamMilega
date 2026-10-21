import Link from 'next/link';

interface Props {
    children: React.ReactNode;
    href?: string;
    onClick?: () => void;
}

export default function FooterLink({ children, href, onClick }: Props) {
    if (href) {
        return (
            <Link
                href={href}
                onClick={onClick}
                className="block text-slate-300 text-sm cursor-pointer hover:text-white hover:translate-x-1 transition-all"
            >
                {children}
            </Link>
        );
    }
    return (
        <p onClick={onClick} className="text-slate-300 text-sm cursor-pointer hover:text-white hover:translate-x-1 transition-all">
            {children}
        </p>
    );
}
