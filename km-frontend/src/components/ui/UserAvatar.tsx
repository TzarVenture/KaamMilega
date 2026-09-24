'use client';

import React, { useState } from 'react';
import CustomImage from './CustomImage';
import DefaultAvatar from './DefaultAvatar';

interface UserAvatarProps {
    src?: string | null;
    name?: string;
    alt?: string;
    className?: string;
    sizeClass?: string;
}

/**
 * Universal, modular UserAvatar component following industry-standard (LinkedIn/Instagram) patterns.
 * Gracefully displays the candidate/expert profile picture, and seamlessly falls back
 * to a clean, neutral silhouette placeholder (DefaultAvatar) when no photo is uploaded
 * or when the image fails to load. Completely replaces legacy initial letter badges.
 */
export const UserAvatar: React.FC<UserAvatarProps> = ({
    src,
    name,
    alt,
    className = 'w-full h-full object-cover',
    sizeClass = 'w-full h-full',
}) => {
    const [hasError, setHasError] = useState(false);
    const label = alt || name || 'User';

    if (!src || hasError) {
        return <DefaultAvatar className={sizeClass} />;
    }

    return (
        <CustomImage
            src={src}
            alt={label}
            className={className}
            onError={() => setHasError(true)}
        />
    );
};

export default UserAvatar;
