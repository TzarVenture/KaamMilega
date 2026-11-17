"use client";

import { Fragment, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRightIcon, BookOpenIcon, CalendarBlankIcon, CaretRightIcon, ChatIcon, CheckCircleIcon, ClockIcon, GraduationCapIcon, MagnifyingGlassIcon, MedalIcon, StarIcon, UsersIcon, VideoCameraIcon, XIcon } from '@phosphor-icons/react';
import Link from 'next/link';
import api from '@/lib/axios';
import { isAuthenticated } from '@/lib/auth';
import PageHero, { HeroAccent } from '@/components/km/PageHero';
import AdSlot from '@/components/ads/AdSlot';
import { notify } from "@/lib/notify";
import { SESSION_CATEGORIES } from "@/lib/mentorship";

/** The grid shows one sponsored row, after this many experts (a full row at 1, 2 or 3 columns) */
const GRID_AD_AFTER = 6;

const categories = ["All", ...SESSION_CATEGORIES];

export default function MentorshipPage() {
  const [mentorships, setMentorships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [myBookingsCount, setMyBookingsCount] = useState(0);
  const [nextUpcomingSession, setNextUpcomingSession] = useState<any | null>(null);

  useEffect(() => {
    fetchMentorships();
  }, [selectedCategory]);

  useEffect(() => {
    // If logged in, fetch candidate bookings count and next upcoming session
    if (isAuthenticated()) {
      api.get('/mentorships/bookings/my')
        .then((res: any) => {
          const list = Array.isArray(res) ? res : (res?.data || []);
          setMyBookingsCount(list.length);
          const upcoming = list.find((b: any) => b.status === 'confirmed' || b.status === 'pending');
          if (upcoming) {
            setNextUpcomingSession(upcoming);
          }
        })
        .catch(() => {});
    }
  }, []);

  const fetchMentorships = async () => {
    try {
      setLoading(true);
      const categoryParam = selectedCategory === "All" ? "" : selectedCategory;
      const res: any = await api.get(`/mentorships?category=${categoryParam}`);
      const data = Array.isArray(res) ? res : (res?.data || []);
      setMentorships(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch mentorships", error);
      notify.error(error, "Mentors couldn’t be loaded.");
      setMentorships([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredMentorships = (mentorships || []).filter(m => 
    (m?.mentorship?.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m?.expert?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '';
    }
  };

  return (
    <main className="min-h-screen bg-km-surface pb-20 font-sans">
      {/* ─── Hero ─── */}
      <PageHero
        overlap
        kicker={{ label: '1-on-1 Expert Mentorship', Icon: GraduationCapIcon, tone: 'experts' }}
        title={<>Learn Practical Skills with <HeroAccent>Live Expert Mentors</HeroAccent></>}
        description="Book 1-on-1 sessions with verified experts for career advice and interview prep."
        highlights={[
          { Icon: VideoCameraIcon, label: 'Live Google Meet & Zoom Access' },
          { Icon: CheckCircleIcon, label: 'Verified Industry Practitioners' },
          { Icon: MedalIcon, label: 'Personalized Career Roadmap' },
        ]}
        art={{ src: '/expert-page-art.png', alt: 'KaamMilega 1-on-1 Expert Mentorship' }}
      >
        {/* Search Bar + Become a Mentor CTA */}
        <div className="flex flex-col sm:flex-row gap-3 max-w-xl">
          <div className="flex-1 flex items-center bg-km-surface-card rounded-xl px-3.5 py-2.5 border border-km-border focus-within:ring-2 focus-within:ring-[#0B5ED7]/20 transition-all shadow-xs">
            <MagnifyingGlassIcon weight="bold" size={17} className="text-km-text-secondary mr-2.5 shrink-0" />
            <input
              type="text"
              placeholder="Search by mentor name, trade, or skill..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-km-text-primary placeholder:text-km-text-secondary focus:outline-none font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="text-km-text-secondary hover:text-slate-600 p-0.5 rounded-full"
              >
                <XIcon weight="bold" size={14} />
              </button>
            )}
          </div>
          <Link
            href="/expert/apply"
            className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-xl border border-white/30 text-white hover:bg-white/10 hover:border-white transition-all whitespace-nowrap shadow-xs dark:hover:border-km-surface-card"
          >
            <span>Become an Expert & Host</span>
            <ArrowRightIcon weight="bold" size={13} />
          </Link>
        </div>
      </PageHero>

      {/* Category Tabs */}
      <section className="max-w-7xl mx-auto px-6 -mt-7 relative z-20">
        <div className="bg-km-surface-card p-2 rounded-2xl md:rounded-2xl shadow-md shadow-slate-200/50 border border-km-border flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs md:text-sm whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat 
                  ? 'bg-km-primary text-white shadow-xs' 
                  : 'text-slate-600 hover:bg-km-surface'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Content Section */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 py-10 md:py-14">
        {/* Smart Upcoming Session Alert Banner */}
        {nextUpcomingSession && (
          <div className="bg-linear-to-r from-orange-50 via-amber-50 to-blue-50 border border-orange-200/80 rounded-2xl p-4 md:p-5 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <VideoCameraIcon weight="bold" size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-md border border-orange-200/50">
                    Upcoming Call
                  </span>
                  <span className="text-xs md:text-sm font-bold text-km-text-primary line-clamp-1">
                    {nextUpcomingSession.mentorship_title || "1-on-1 Mentorship Call"}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Mentor: <span className="font-bold text-km-text-primary">{nextUpcomingSession.expert_name || "Verified Mentor"}</span> • {formatDate(nextUpcomingSession.scheduled_at)} at {formatTime(nextUpcomingSession.scheduled_at)}
                </p>
              </div>
            </div>
            <Link
              href="/mentorship/my-sessions"
              className="bg-[#1a2b8c] hover:bg-[#152370] text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs self-start sm:self-auto flex items-center gap-1.5 whitespace-nowrap active:scale-95"
            >
              <span>View Session / Join Call</span>
              <ArrowRightIcon weight="bold" size={13} />
            </Link>
          </div>
        )}

        {/* Section Header with "My Booked Sessions" Button on the right */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 md:mb-10">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-km-text-primary">Featured Mentorships</h2>
            <p className="text-xs md:text-sm text-km-text-secondarymt-1">
              Top-rated experts ready to guide your career forward
            </p>
          </div>

          <Link
            href="/mentorship/my-sessions"
            className="inline-flex items-center gap-2 bg-km-surface-card hover:bg-km-surface text-km-text-primary border border-km-border px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-2xs active:scale-95 cursor-pointer"
          >
            <CalendarBlankIcon weight="bold" size={14} className="text-[#1a2b8c] dark:text-blue-400" />
            <span>My Booked Sessions</span>
            {myBookingsCount > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-orange-500 text-white">
                {myBookingsCount}
              </span>
            )}
            <ArrowRightIcon weight="bold" size={13} className="text-km-text-secondary" />
          </Link>
        </div>

        {/* Mentorship Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-km-surface-card rounded-2xl h-95 animate-pulse border border-km-border" />
            ))}
          </div>
        ) : filteredMentorships.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {filteredMentorships.map((m, i) => (
              <Fragment key={m?.mentorship?.id || i}>
                <MentorshipCard data={m} index={i} />
                {i === Math.min(GRID_AD_AFTER, filteredMentorships.length) - 1 && <AdSlot placement="mentorship_inline" className="col-span-full" />}
              </Fragment>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-km-surface-card rounded-2xl border border-dashed border-km-border p-8">
            <BookOpenIcon size={36} weight="duotone" className="text-km-text-secondary mx-auto mb-4" aria-hidden="true" />
            <h3 className="text-lg font-bold text-km-text-primary mb-1">No Mentorships Found</h3>
            <p className="text-xs text-km-text-secondary max-w-xs mx-auto">Try adjusting your category filter or search query to find what you are looking for.</p>
          </div>
        )}
      </section>

      {/* Benefits Section */}
      <section className="max-w-7xl mx-auto px-6 pb-12">
        <div className="bg-km-surface-card rounded-2xl p-8 md:p-12 border border-km-border flex flex-col md:flex-row items-center gap-10">
            <div className="md:w-1/2">
                <h2 className="text-2xl md:text-4xl font-bold text-km-text-primary mb-6 leading-tight">
                    Why Choose <span className="text-km-heading">KaamMilega Mentors?</span>
                </h2>
                <div className="space-y-4">
                    <BenefitItem 
                        icon={<MedalIcon size={24} className="text-km-accent" />} 
                        title="Vetted Industry Leaders" 
                        desc="All mentors undergo a screening process to ensure practical, quality guidance." 
                    />
                    <BenefitItem 
                        icon={<ChatIcon size={24} className="text-km-blue" />} 
                        title="Interactive 1-on-1 Sessions" 
                        desc="Engage in meaningful conversations and get answers to your specific career questions." 
                    />
                    <BenefitItem 
                        icon={<CheckCircleIcon size={24} className="text-emerald-500 dark:text-emerald-400" />} 
                        title="Practical Roadmaps" 
                        desc="Learn real-world strategies, negotiate better compensation, and avoid common traps." 
                    />
                </div>
            </div>
            <div className="md:w-1/2 flex justify-center">
                <div className="bg-km-surface-card rounded-2xl p-8 border border-km-border shadow-sm max-w-sm w-full space-y-4 text-center">
                    <UsersIcon size={36} weight="duotone" className="text-km-heading mx-auto" aria-hidden="true" />
                    <h3 className="text-lg font-bold text-km-text-primary">Are You an Industry Expert?</h3>
                    <p className="text-xs text-km-text-secondary leading-relaxed">
                      Share your knowledge, mentor aspiring candidates, and earn by hosting 1-on-1 sessions.
                    </p>
                    <Link
                      href="/expert/apply"
                      className="inline-block w-full py-3 bg-km-primary hover:bg-km-primary-dark text-white text-xs font-bold rounded-xl transition shadow-xs"
                    >
                      Apply to Become a Mentor
                    </Link>
                </div>
            </div>
        </div>
      </section>
    </main>
  );
}

function MentorshipCard({ data, index }: { data: any, index: number }) {
  const { mentorship, expert } = data;
  const expertNameClean = (expert?.name || "Industry Expert").replace(/\s*\.+$/, "");
  const expertInitial = (expertNameClean[0] || "E").toUpperCase();
  const reviews = Number(mentorship?.reviews || 0);
  const href = `/mentorship/${mentorship?.id}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 6) * 0.05 }}
      className="km-card flex flex-col group overflow-hidden"
    >
      <Link href={href} className="p-5 flex-1 flex flex-col">
        <div className="flex justify-between items-start gap-3 mb-4">
          <div className="w-12 h-12 bg-km-surface rounded-xl flex items-center justify-center overflow-hidden border border-km-border shrink-0">
            {expert?.profile_image ? (
              <img src={expert.profile_image} alt={expertNameClean} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[#7C3AED] font-bold text-lg dark:text-violet-300">{expertInitial}</span>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="text-[11px] font-semibold text-[#6D28D9] bg-[#F5F3FF] border border-[#DDD6FE] px-2.5 py-0.5 rounded-md dark:text-violet-300 dark:bg-km-surface dark:border-km-border">
              {mentorship?.category || "Mentorship"}
            </span>
            {reviews > 0 ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-km-text-primary">
                <StarIcon weight="fill" size={12} className="text-[#F59E0B]" />
                {Number(mentorship.rating || 0).toFixed(1)}
                <span className="font-normal text-km-text-secondary">({reviews})</span>
              </span>
            ) : (
              <span className="text-xs font-medium text-km-text-secondary">New mentor</span>
            )}
          </div>
        </div>

        <h3 className="text-base font-bold text-km-text-primary leading-snug mb-1.5 group-hover:text-km-link transition-colors line-clamp-2">
          {mentorship?.title}
        </h3>
        <p className="text-xs text-km-text-secondary mb-4 line-clamp-1">
          By <span className="font-medium text-km-text-primary">{expertNameClean}</span>{expert?.headline ? ` · ${expert.headline}` : ""}
        </p>

        <div className="flex items-center gap-4 pt-3 border-t border-km-border mt-auto text-xs text-km-text-secondary">
          <span className="flex items-center gap-1.5">
            <ClockIcon weight="bold" size={14} className="text-[#7C3AED] dark:text-violet-300" />
            {mentorship?.duration || 30} min
          </span>
          <span className="flex items-center gap-1.5">
            <UsersIcon weight="bold" size={14} className="text-[#7C3AED] dark:text-violet-300" />
            1-on-1 video call
          </span>
        </div>
      </Link>

      <div className="px-5 py-4 border-t border-km-border flex items-center justify-between">
        <div>
          <span className="text-xs text-km-text-secondary block">Session fee</span>
          <span className="text-lg font-bold text-km-text-primary">
            {mentorship?.price ? `₹${mentorship.price}` : "Free"}
          </span>
        </div>
        <Link href={href} className="btn-primary text-xs px-4 py-2.5 inline-flex items-center gap-1.5">
          Book session
          <CaretRightIcon weight="bold" size={13} />
        </Link>
      </div>
    </motion.div>
  );
}

function BenefitItem({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
    return (
        <div className="flex gap-3.5 p-3 rounded-2xl hover:bg-km-surface-card transition-colors">
            <span className="w-6 flex justify-center shrink-0 pt-0.5" aria-hidden="true">
                {icon}
            </span>
            <div>
                <h4 className="font-bold text-km-text-primary text-sm mb-0.5">{title}</h4>
                <p className="text-xs text-km-text-secondary font-medium leading-relaxed">{desc}</p>
            </div>
        </div>
    );
}
