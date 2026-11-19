'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/axios';
import { isAuthenticated } from '@/lib/auth';
import { notify } from '@/lib/notify';

/**
 * The companies the signed-in member follows (company id = the recruiter's user id), with a
 * toggle that updates the button at once and puts it back if the server says no.
 * Visitors who aren't signed in get canFollow = false and no request is made; so does anyone
 * whose follow list didn't load, since following wouldn't work for them either.
 */
export function useCompanyFollows() {
    const [following, setFollowing] = useState<Set<string>>(new Set());
    const [canFollow, setCanFollow] = useState(false);

    useEffect(() => {
        if (!isAuthenticated()) return;
        let alive = true;
        api.get('/network/companies/following')
            .then((res) => {
                const ids = (res as { data?: unknown } | null)?.data;
                if (!alive) return;
                setFollowing(new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []));
                setCanFollow(true);
            })
            .catch(() => { /* no Follow buttons */ });
        return () => {
            alive = false;
        };
    }, []);

    const set = (id: string, on: boolean) =>
        setFollowing((prev) => {
            const next = new Set(prev);
            if (on) next.add(id);
            else next.delete(id);
            return next;
        });

    /** Follows or unfollows; resolves false if the server refused (the button is put back) */
    const toggle = useCallback(async (companyId: string): Promise<boolean> => {
        if (!companyId) return false;
        const on = !following.has(companyId);
        set(companyId, on);
        try {
            if (on) await api.post(`/network/companies/${companyId}/follow`);
            else await api.delete(`/network/companies/${companyId}/follow`);
            return true;
        } catch (err) {
            set(companyId, !on);
            notify.error(err, on ? 'Couldn’t follow this company.' : 'Couldn’t unfollow this company.');
            return false;
        }
    }, [following]);

    return {
        canFollow,
        isFollowing: (companyId?: string) => !!companyId && following.has(companyId),
        toggle,
    };
}
