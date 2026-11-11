'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ChatCircleIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { isAuthenticated } from '@/lib/auth';
import { notify } from '@/lib/notify';

const NO_ID = '000000000000000000000000';

interface Props {
    recruiterId?: string;
    jobTitle?: string;
    className?: string;
    /** Show the "3 free chats a day" line under the button */
    showHint?: boolean;
}

/** Opens a chat with the person who posted the job, with a first message ready to send */
export default function ChatWithHRButton({ recruiterId, jobTitle, className, showHint }: Props) {
    const t = useTranslations('chatHr');
    const router = useRouter();
    if (!recruiterId || recruiterId === NO_ID) return null;

    const open = () => {
        const params = new URLSearchParams({ userId: recruiterId });
        const title = jobTitle?.replace(/\s+/g, ' ').trim();
        if (title) params.set('text', t('firstMessage', { title }));
        const target = `/chat?${params.toString()}`;
        if (!isAuthenticated()) {
            notify.info(t('signIn'));
            router.push(`/login?redirect=${encodeURIComponent(target)}`);
            return;
        }
        router.push(target);
    };

    const button = (
        <button type="button" onClick={open} className={className}>
            <ChatCircleIcon weight="bold" size={16} aria-hidden="true" />
            <span>{t('button')}</span>
        </button>
    );
    if (!showHint) return button;

    return (
        <div className="flex flex-col items-stretch gap-1">
            {button}
            <span className="text-center text-xs text-km-text-secondary">{t('hint')}</span>
        </div>
    );
}
