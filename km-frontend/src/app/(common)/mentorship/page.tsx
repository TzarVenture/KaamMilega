"use client";

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, Clock, Star, BookOpen, Users,
  ChevronRight, Award, CheckCircle, CheckCircle2, ArrowRight, MessageSquare,
  Calendar, Video, ExternalLink, ShieldCheck, GraduationCap, X
} from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/axios';
import { isAuthenticated } from '@/lib/auth';

const categories = [
  "All",
  "Interview Prep",
  "Career Guidance",
  "Technical Skills",
  "Soft Skills",
  "Resume Review",
  "Entrepreneurship"
];

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
    <main className="min-h-screen bg-[#F4F7FB] pb-20 font-sans">
      {/* ─── Mentorship Hero Section with Expert Art & Rounded Bottom ─── */}
      <section className="bg-[#071A4D] border-b border-[#0B1F52] text-white pt-8 sm:pt-10 lg:pt-12 pb-6 sm:pb-8 lg:pb-10 rounded-b-[32px] sm:rounded-b-[44px] lg:rounded-b-[52px] relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-end">
            {/* Left Column: Headlines, Search & Value Props */}
            <div className="lg:col-span-7 xl:col-span-7 text-left pb-6 sm:pb-8 lg:pb-10">
              {/* Category Indicator */}
              <div className="inline-flex items-center gap-2 bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] text-xs font-semibold px-3.5 py-1.5 rounded-full mb-4">
                <GraduationCap size={14} className="text-[#F59E0B]" />
                <span>1-on-1 Expert Mentorship</span>
              </div>

              {/* Master Brand Headline for Mentorship */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.15]">
                Learn Practical Skills with <span className="text-[#FF6B00]">Live Expert Mentors</span>
              </h1>

              {/* Authentic Subheading */}
              <p className="mt-3.5 text-sm sm:text-base text-white/80 max-w-xl font-normal leading-relaxed">
                Connect 1-on-1 with vetted industry practitioners for personalized career advisory, mock interview coaching, and trade guidance via Google Meet or Zoom.
              </p>

              {/* Search Bar + Become a Mentor CTA */}
              <div className="flex flex-col sm:flex-row gap-3 max-w-xl mt-6">
                <div className="flex-1 flex items-center bg-white rounded-xl px-3.5 py-2.5 border border-slate-200 focus-within:ring-2 focus-within:ring-[#0B5ED7]/20 transition-all shadow-xs">
                  <Search size={17} className="text-slate-400 mr-2.5 shrink-0" />
                  <input 
                    type="text" 
                    placeholder="Search by mentor name, trade, or skill..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none font-medium"
                  />
                  {searchQuery && (
                    <button 
                      type="button" 
                      onClick={() => setSearchQuery('')}
                      className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <Link
                  href="/expert/apply"
                  className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-xl border border-white/30 text-white hover:bg-white/10 hover:border-white transition-all whitespace-nowrap shadow-xs"
                >
                  <span>Become an Expert & Host</span>
                  <ArrowRight size={13} />
                </Link>
              </div>

              {/* Key Benefits / Trust Chips */}
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-6 pt-5 border-t border-white/10 text-xs text-white/90 font-medium">
                <div className="flex items-center gap-2">
                  <Video size={15} className="text-[#10B981] shrink-0" />
                  <span>Live Google Meet & Zoom Access</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-[#10B981] shrink-0" />
                  <span>Verified Industry Practitioners</span>
                </div>
                <div className="flex items-center gap-2">
                  <Award size={15} className="text-[#10B981] shrink-0" />
                  <span>Personalized Career Roadmap</span>
                </div>
              </div>
            </div>

            {/* Right Column: Hero Artwork Resting Directly on Top Edge of Category Tabs */}
            <div className="lg:col-span-5 xl:col-span-5 flex items-end justify-center lg:justify-end self-end">
              <div 
                className="relative flex items-end justify-center lg:justify-end"
                style={{ width: 'clamp(320px, 44vw, 560px)', maxWidth: '100%' }}
              >
                <img
                  src="/expert-page-art.png"
                  alt="KaamMilega 1-on-1 Expert Mentorship"
                  className="w-full h-auto object-contain select-none pointer-events-none drop-shadow-xl block translate-y-[1px]"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Category Tabs */}
      <section className="max-w-7xl mx-auto px-6 -mt-7 relative z-20">
        <div className="bg-white p-2 rounded-2xl md:rounded-3xl shadow-md shadow-slate-200/50 border border-slate-100 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs md:text-sm whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat 
                  ? 'bg-km-primary text-white shadow-xs' 
                  : 'text-slate-600 hover:bg-slate-50'
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
                <Video size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-orange-700 bg-orange-100 px-2 py-0.5 rounded-md border border-orange-200/50">
                    Upcoming Call
                  </span>
                  <span className="text-xs md:text-sm font-bold text-slate-900 line-clamp-1">
                    {nextUpcomingSession.mentorship_title || "1-on-1 Mentorship Call"}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Mentor: <span className="font-bold text-slate-800">{nextUpcomingSession.expert_name || "Verified Mentor"}</span> • {formatDate(nextUpcomingSession.scheduled_at)} at {formatTime(nextUpcomingSession.scheduled_at)}
                </p>
              </div>
            </div>
            <Link
              href="/mentorship/my-sessions"
              className="bg-[#1a2b8c] hover:bg-[#152370] text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs self-start sm:self-auto flex items-center gap-1.5 whitespace-nowrap active:scale-95"
            >
              <span>View Session / Join Call</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        )}

        {/* Section Header with "My Booked Sessions" Button on the right */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 md:mb-10">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900">Featured Mentorships</h2>
            <p className="text-xs md:text-sm text-slate-500 font-medium tracking-tight mt-1">
              Top-rated experts ready to guide your career forward
            </p>
          </div>

          <Link
            href="/mentorship/my-sessions"
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 hover:border-slate-300 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-2xs active:scale-95 cursor-pointer"
          >
            <Calendar size={14} className="text-[#1a2b8c]" />
            <span>My Booked Sessions</span>
            {myBookingsCount > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-orange-500 text-white">
                {myBookingsCount}
              </span>
            )}
            <ArrowRight size={13} className="text-slate-400" />
          </Link>
        </div>

        {/* Mentorship Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white rounded-3xl h-95 animate-pulse border border-slate-100" />
            ))}
          </div>
        ) : filteredMentorships.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {filteredMentorships.map((m, i) => (
              <MentorshipCard key={m?.mentorship?.id || i} data={m} index={i} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200 p-8">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="text-slate-400" size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">No Mentorships Found</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">Try adjusting your category filter or search query to find what you are looking for.</p>
          </div>
        )}
      </section>

      {/* Benefits Section */}
      <section className="max-w-7xl mx-auto px-6 pb-12">
        <div className="bg-slate-50 rounded-3xl p-8 md:p-12 border border-slate-200/80 flex flex-col md:flex-row items-center gap-10">
            <div className="md:w-1/2">
                <h2 className="text-2xl md:text-4xl font-black text-slate-900 mb-6 leading-tight">
                    Why Choose <span className="text-km-primary">KaamMilega Mentors?</span>
                </h2>
                <div className="space-y-4">
                    <BenefitItem 
                        icon={<Award className="text-km-accent" />} 
                        title="Vetted Industry Leaders" 
                        desc="All mentors undergo a screening process to ensure practical, quality guidance." 
                    />
                    <BenefitItem 
                        icon={<MessageSquare className="text-km-blue" />} 
                        title="Interactive 1-on-1 Sessions" 
                        desc="Engage in meaningful conversations and get answers to your specific career questions." 
                    />
                    <BenefitItem 
                        icon={<CheckCircle className="text-emerald-500" />} 
                        title="Practical Roadmaps" 
                        desc="Learn real-world strategies, negotiate better compensation, and avoid common traps." 
                    />
                </div>
            </div>
            <div className="md:w-1/2 flex justify-center">
                <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm max-w-sm w-full space-y-4 text-center">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto text-km-primary">
                        <Users size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">Are You an Industry Expert?</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
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
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="bg-white rounded-3xl overflow-hidden shadow-xs border border-slate-200/80 flex flex-col group hover:shadow-xl hover:border-blue-200 transition-all duration-300 hover:-translate-y-1.5"
    >
      <div className="p-6 md:p-7 pb-4 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <div className="w-12 h-12 md:w-14 md:h-14 bg-blue-50 rounded-2xl flex items-center justify-center overflow-hidden border border-blue-100 shadow-2xs">
             {expert?.profile_image ? (
               <img src={expert.profile_image} alt={expertNameClean} className="w-full h-full object-cover" />
             ) : (
               <span className="text-km-primary font-black text-lg md:text-xl">{expertInitial}</span>
             )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="bg-blue-50 text-km-primary text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border border-blue-100">
              {mentorship?.category || "Mentorship"}
            </span>
            <div className="flex items-center gap-1 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full text-[10px] font-bold text-amber-800">
              <Star size={11} className="fill-amber-400 text-amber-400" />
              <span>{mentorship?.rating ? Number(mentorship.rating).toFixed(1) : '5.0'}</span>
              <span className="text-amber-600 font-medium">({mentorship?.reviews || 0})</span>
            </div>
          </div>
        </div>
 
        <Link href={`/mentorship/${mentorship?.id}`}>
          <h3 className="text-base md:text-lg font-bold text-slate-900 mb-1.5 group-hover:text-km-primary transition-colors line-clamp-2 min-h-11">
            {mentorship?.title}
          </h3>
        </Link>
        <p className="text-slate-500 text-xs font-medium mb-4 line-clamp-1">
          By {expertNameClean} • {expert?.headline || "Verified Mentor"}
        </p>
 
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 mt-auto">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Clock size={14} className="text-km-primary" />
            <span className="text-xs font-semibold">{mentorship?.duration || 45} Mins</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <Users size={14} className="text-emerald-600" />
            <span className="text-xs font-semibold">1-on-1 Session</span>
          </div>
        </div>
      </div>
 
      <div className="p-5 md:p-6 pt-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
        <div>
          <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">Session Fee</span>
          <span className="text-xl md:text-2xl font-black text-slate-900 font-mono">₹{mentorship?.price || 499}</span>
        </div>
        <Link href={`/mentorship/${mentorship?.id}`}>
          <button 
            type="button"
            className="bg-km-primary hover:bg-km-primary-dark text-white px-4 md:px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-xs active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <span>Book Session</span> 
            <ChevronRight size={14} />
          </button>
        </Link>
      </div>
    </motion.div>
  );
}

function BenefitItem({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
    return (
        <div className="flex gap-3.5 p-3 rounded-2xl hover:bg-white transition-colors">
            <div className="w-10 h-10 bg-white rounded-xl shadow-xs border border-slate-100 flex items-center justify-center shrink-0">
                {icon}
            </div>
            <div>
                <h4 className="font-bold text-slate-900 text-sm mb-0.5">{title}</h4>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">{desc}</p>
            </div>
        </div>
    );
}
