import React from 'react';

interface DefaultAvatarProps {
    className?: string;
    size?: number | string;
}

/**
 * Industry-standard neutral person silhouette avatar placeholder
 * Used across LinkedIn, Instagram, and modern professional ecosystems
 * when a user or expert does not have a profile picture uploaded.
 */
export const DefaultAvatar: React.FC<DefaultAvatarProps> = ({ className = "w-full h-full" }) => {
    return (
        <div className={`relative flex items-center justify-center bg-slate-100 text-slate-300 overflow-hidden select-none ${className}`}>
            <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-[85%] h-[85%] translate-y-1"
                aria-hidden="true"
            >
                <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5z" />
            </svg>
        </div>
    );
};

export default DefaultAvatar;
