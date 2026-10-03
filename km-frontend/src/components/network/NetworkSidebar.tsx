'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, Calendar, Award, UserPlus, ArrowRight } from 'lucide-react';
import api from '@/lib/axios';

interface SidebarCounts {
  invitations: number;
  connections: number;
  experts: number;
  events: number;
}

export const NetworkSidebar: React.FC = () => {
  const pathname = usePathname();
  const [counts, setCounts] = useState<SidebarCounts>({
    invitations: 0,
    connections: 0,
    experts: 0,
    events: 0,
  });

  useEffect(() => {
    let isMounted = true;

    const fetchCounts = async () => {
      try {
        const pendingPromise = api.get('/network/pending').catch(() => []);
        const connsPromise = api.get('/network/connections').catch(() => []);
        const eventsPromise = api.get('/events', { params: { limit: 1 } }).catch(() => ({ total: 0 }));

        const [pendingRes, connsRes, eventsRes] = await Promise.all([
          pendingPromise,
          connsPromise,
          eventsPromise,
        ]);

        if (!isMounted) return;

        const pendingList = Array.isArray(pendingRes) ? pendingRes : [];
        const connsList = Array.isArray(connsRes) ? connsRes : [];
        const totalEvents = typeof (eventsRes as any)?.total === 'number' ? (eventsRes as any).total : 0;

        setCounts({
          invitations: pendingList.length,
          connections: connsList.length,
          experts: 0,
          events: totalEvents,
        });

        // Calculate expert connections count if connections exist
        if (connsList.length > 0) {
          try {
            const enriched = await Promise.all(
              connsList.slice(0, 30).map(async (id: string) => {
                try {
                  const u: any = await api.get(`/user/${id}`);
                  return u;
                } catch {
                  return null;
                }
              })
            );
            const expertCount = enriched.filter((u) => u && u.roles?.includes('expert')).length;
            if (isMounted) {
              setCounts((prev) => ({ ...prev, experts: expertCount }));
            }
          } catch {
            // Ignore failure silently
          }
        }
      } catch (err) {
        console.warn('Failed to load network sidebar counts', err);
      }
    };

    fetchCounts();

    return () => {
      isMounted = false;
    };
  }, [pathname]);

  const navItems = [
    {
      label: 'Grow Network',
      href: '/network',
      icon: UserPlus,
      isActive: pathname === '/network',
      count: counts.invitations > 0 ? counts.invitations : undefined,
      isNotification: true,
    },
    {
      label: 'Connections',
      href: '/network/connections',
      icon: Users,
      isActive: pathname === '/network/connections',
      count: counts.connections,
      isNotification: false,
    },
    {
      label: 'Verified Experts',
      href: '/network/experts',
      icon: Award,
      isActive: pathname === '/network/experts',
      count: counts.experts > 0 ? counts.experts : undefined,
      isNotification: false,
    },
    {
      label: 'Networking Events',
      href: '/network/events',
      icon: Calendar,
      isActive: pathname === '/network/events',
      count: counts.events > 0 ? counts.events : undefined,
      isNotification: false,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Mobile Top Navigation Tabs (Visible on screens < lg) */}
      <div className="lg:hidden bg-white rounded-2xl border border-[#D9E0EA] p-2 shadow-xs overflow-x-auto scrollbar-hide flex gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 active:scale-[0.98] ${
                item.isActive
                  ? 'bg-[#071A4D] text-white shadow-xs'
                  : 'text-[#5B6472] hover:bg-[#F4F7FB] hover:text-[#071A4D]'
              }`}
            >
              <Icon size={14} className={item.isActive ? 'text-white' : 'text-[#5B6472]'} />
              <span>{item.label}</span>
              {item.count !== undefined && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    item.isActive
                      ? 'bg-white/20 text-white'
                      : item.isNotification
                        ? 'bg-[#FF6B00] text-white'
                        : 'bg-[#F4F7FB] text-[#071A4D] border border-[#D9E0EA]'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Desktop Persistent Left Sidebar (Visible on screens >= lg) */}
      <div className="hidden lg:block bg-white rounded-2xl border border-[#D9E0EA] p-5 shadow-xs">
        <h2 className="font-bold text-[#111827] text-sm tracking-tight mb-4 flex items-center justify-between">
          <span>Manage My Network</span>
        </h2>

        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 group active:scale-[0.98] ${
                  item.isActive
                    ? 'bg-[#071A4D] text-white shadow-xs'
                    : 'text-[#5B6472] hover:bg-[#F4F7FB] hover:text-[#071A4D]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    size={16}
                    className={`transition-colors ${
                      item.isActive ? 'text-white' : 'text-[#5B6472] group-hover:text-[#071A4D]'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.count !== undefined && (
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                      item.isActive
                        ? 'bg-white/20 text-white'
                        : item.isNotification
                          ? 'bg-[#FF6B00] text-white'
                          : 'bg-[#F4F7FB] text-[#071A4D] border border-[#D9E0EA]'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Desktop Brand Promotion Box: Become an Expert */}
      <div className="hidden lg:block bg-[#071A4D] border border-slate-700/60 rounded-2xl p-5 text-white shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="p-1 rounded-lg bg-white/10 text-amber-300">
            <Award size={15} />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
            Expert Network
          </span>
        </div>

        <h3 className="text-sm font-bold text-white mb-1.5 leading-snug">
          Become a Verified Mentor
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed mb-4">
          Guide ambitious candidates, host 1-on-1 calls, and monetize your professional experience.
        </p>

        <Link
          href="/expert/apply"
          className="inline-flex items-center gap-1.5 bg-[#FF6B00] hover:bg-[#E05E00] text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all duration-150 active:scale-[0.98] cursor-pointer"
        >
          <span>Apply Now</span>
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
};

export default NetworkSidebar;
