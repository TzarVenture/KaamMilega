'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface BrandLogoProps {
    className?: string;
    showTextOnMobile?: boolean;
    size?: 'sm' | 'md' | 'lg';
    href?: string;
}

export default function BrandLogo({ className = '', showTextOnMobile = true, size = 'md', href = '/' }: BrandLogoProps) {
    // Proportioned with optical weight: icon is ~1:1 (926x957), text is ~5.7:1 (2080x366)
    const iconStyles = {
        sm: 'h-8 w-auto',
        md: 'h-9.5 md:h-10.5 w-auto',
        lg: 'h-12 md:h-13 w-auto',
    };
    const textStyles = {
        sm: 'h-5 w-auto',
        md: 'h-6.5 md:h-7.5 w-auto',
        lg: 'h-8 md:h-9 w-auto',
    };

    return (
        <Link href={href} className={`inline-flex items-end gap-2 sm:gap-2.5 select-none group shrink-0 ${className}`}>
            <Image
                src="/kaammilega-logo-icon.png"
                alt="KaamMilega Icon"
                width={926}
                height={957}
                priority
                className={`${iconStyles[size]} object-contain transition-transform duration-200 group-hover:scale-[1.03]`}
            />
            <Image
                src="/kaammilega-logo-text.png"
                alt="Kaammilega"
                width={2080}
                height={366}
                priority
                className={`${textStyles[size]} object-contain pb-0.5 sm:pb-1 ${showTextOnMobile ? 'block' : 'hidden sm:block'}`}
            />
        </Link>
    );
}
