'use client';

import { usePathname } from 'next/navigation';
import Footer from './Footer';

export default function CommonFooter() {
    const pathname = usePathname();
    if (pathname === '/chat' || pathname?.startsWith('/chat')) {
        return null;
    }
    return <Footer />;
}
