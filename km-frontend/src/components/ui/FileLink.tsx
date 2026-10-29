'use client';

import React from 'react';
import { isPrivateFileRef, openFile } from '@/lib/upload';
import { notify } from '@/lib/notify';

type FileLinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string };

/**
 * A link to an uploaded file. Private files (resumes, documents, chat files) have no public
 * address, so a click fetches a short-lived signed link and opens it in a new tab.
 */
export default function FileLink({ href, onClick, children, ...props }: FileLinkProps) {
    const isPrivate = isPrivateFileRef(href);
    return (
        <a
            {...props}
            href={isPrivate ? '#' : href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
                onClick?.(e);
                if (!isPrivate || e.defaultPrevented) return;
                e.preventDefault();
                openFile(href).catch((err) => notify.error(err, 'Could not open this file.'));
            }}
        >
            {children}
        </a>
    );
}
