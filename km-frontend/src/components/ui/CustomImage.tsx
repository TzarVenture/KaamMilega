'use client';

import React from 'react';

interface CustomImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string;
    fallback?: string;
}

const CustomImage = ({ src, fallback, className, ...props }: CustomImageProps) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';

    // Determine the full source URL
    // 1. If src is missing or empty, use fallback
    // 2. If src is a full URL (http...) or data URI, use it as is
    // 3. Otherwise, prefix with the NEXT_PUBLIC_API_URL
    const getFullSrc = (imageSrc: string | undefined) => {
        if (!imageSrc) return fallback || '';
        if (imageSrc.startsWith('http') || imageSrc.startsWith('data:') || imageSrc.startsWith('blob:')) {
            return imageSrc;
        }

        const cleanBase = baseUrl.replace(/\/$/, '');
        const cleanSrc = imageSrc.replace(/^\//, '');
        return `${cleanBase}/${cleanSrc}`;
    };

    const fullSrc = getFullSrc(src);

    const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
        const target = e.target as HTMLImageElement;
        if (fallback && target.src !== fallback) {
            target.src = fallback;
        }
        if (props.onError) {
            props.onError(e);
        }
    };

    return (
        <img
            alt={props.alt}
            src={fullSrc}
            className={className}
            onError={handleError}
            {...props}
        />
    );
};

export default CustomImage;
