"use client";
import { useRef, useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  MessageCircle, Briefcase, CheckCircle, MapPin,
  PhoneCall, Users, ChevronLeft, ChevronRight, Star,
  Home, Clock, UserRound, Play, Calendar, Gift, Wallet,
  ChevronUp, ChevronDown, ShieldCheck, Zap, Building2, X,
  GraduationCap, Award, BookOpen, Scroll, CheckCircle2,
  Landmark, ArrowUpRight
} from 'lucide-react';

import Link from 'next/link';
import Image from 'next/image';
import api from '@/lib/axios';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ConnectJustLikeYou } from '@/components/network/ConnectJustLikeYou';
import HeroSection from '@/components/home/HeroSection';
import SevenServicesSection from '@/components/home/SevenServicesSection';
import SuccessTicker from '@/components/home/SuccessTicker';
import UserAvatar from '@/components/ui/UserAvatar';
import { ENTERPRISE_COMPANIES as enterprisePartners } from '@/lib/constants/companies';
import CompanyCard from '@/components/company/CompanyCard';
import ProfileConnectionCard from '@/components/network/ProfileConnectionCard';
import InteractiveScrollbar from '@/components/ui/InteractiveScrollbar';
import { getCityHubMetadata, normalizeCitySlug } from '@/lib/constants/hubs';
import { ImpressionWrapper } from '@/lib/telemetry';
import { getYouTubeThumbnail, getYouTubeMaxResThumbnail, extractYouTubeVideoId } from '@/lib/youtube';

export default function LandingPage() {
  const router = useRouter();
  const [cities, setCities] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [experts, setExperts] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [pendingConnectIds, setPendingConnectIds] = useState<string[]>([]);
  const [connectedIds, setConnectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (isAuthenticated()) {
        setIsLoggedIn(true);
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            setCurrentUser(JSON.parse(storedUser));
          } catch (e) { }
        }
      }
    }
  }, []);

  const handleChat = (id: string) => {
    if (!isAuthenticated()) {
      toast.info("Please sign in to chat with professionals", { position: "top-center" });
      router.push(`/login?redirect=${encodeURIComponent(`/chat?userId=${id}`)}`);
      return;
    }
    router.push(`/chat?userId=${id}`);
  };

  const handleConnect = async (id: string, name?: string) => {
    if (!isAuthenticated()) {
      toast.info("Please sign in to connect with professionals", { position: "top-center" });
      router.push('/login?redirect=/');
      return;
    }

    try {
      await api.post('/network/connect', { receiver_id: id });
      toast.success(`Invitation sent to ${name || 'member'}!`);
      setPendingConnectIds(prev => [...prev, id]);
    } catch (e: any) {
      const msg = e.message || '';
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('pending') || msg.toLowerCase().includes('duplicate')) {
        toast.info("Invitation already sent.");
        setPendingConnectIds(prev => [...prev, id]);
      } else {
        toast.error(msg || "Could not send invitation. Please try again.");
      }
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [citiesRes, questionsRes, jobsRes, usersRes, expertsRes, eventsRes, skillsRes, statsRes] = await Promise.allSettled([
          api.get('/cities'),
          api.get('/questions').catch(() => api.get('/admin/questions')).catch(() => []),
          api.get('/jobs?limit=50'), // Get some jobs to extract companies
          api.get('/community/users').catch(() => []),
          api.get('/experts').catch(() => []),
          api.get('/events?limit=5').catch(() => []),
          api.get('/skills').catch(() => []),
          api.get('/platform/stats').catch(() => null)
        ]);

        if (isAuthenticated()) {
          Promise.all([
            api.get('/network/connections').catch(() => []),
            api.get('/network/sent').catch(() => [])
          ]).then(([conns, sent]: [any, any]) => {
            if (Array.isArray(conns)) setConnectedIds(conns);
            if (Array.isArray(sent)) setPendingConnectIds(sent);
          }).catch(() => { });
        }

        if (citiesRes.status === 'fulfilled') {
          // Handle array or object wrapper
          const data = citiesRes.value as any;
          setCities(Array.isArray(data) ? data : data.data || []);
        }

        if (questionsRes.status === 'fulfilled') {
          const data = questionsRes.value as any;
          setQuestions(Array.isArray(data) ? data : data.data || []);
        }

        if (skillsRes.status === 'fulfilled') {
          const data = skillsRes.value as any;
          setSkills(Array.isArray(data) ? data : data.data || []);
        }

        if (statsRes.status === 'fulfilled' && statsRes.value) {
          const s = (statsRes.value as any).stats || statsRes.value;
          setStats(s);
        }

        if (usersRes.status === 'fulfilled') {
          const data = usersRes.value as any;
          const userList = Array.isArray(data) ? data : data.data || [];

          let currentUserIdStr = '';
          try {
            const stored = localStorage.getItem('user');
            if (stored) {
              const parsed = JSON.parse(stored);
              currentUserIdStr = parsed.id || parsed._id || '';
            }
          } catch (e) { }

          const suggestions = userList.filter((u: any) => u.id !== currentUserIdStr && u._id !== currentUserIdStr);
          setUsers(suggestions.slice(0, 8));
        }

        if (expertsRes.status === 'fulfilled') {
          const data = expertsRes.value as any;
          const expertList = Array.isArray(data) ? data : data.data || [];
          let currentUserIdStr = '';
          try {
            const stored = localStorage.getItem('user');
            if (stored) {
              const parsed = JSON.parse(stored);
              currentUserIdStr = parsed.id || parsed._id || '';
            }
          } catch (e) { }
          const filtered = expertList.filter((u: any) => u.id !== currentUserIdStr && u._id !== currentUserIdStr);
          setExperts(filtered.slice(0, 8));
        }

        if (eventsRes.status === 'fulfilled') {
          const data = eventsRes.value as any;
          setEvents(Array.isArray(data) ? data : data.data || []);
        }

        if (jobsRes.status === 'fulfilled') {
          const jobsData = (jobsRes.value as any).jobs || [];
          // Extract unique companies from jobs
          const companiesMap = new Map();
          jobsData.forEach((job: any) => {
            if (job.company && !companiesMap.has(job.company)) {
              companiesMap.set(job.company, {
                name: job.company,
                rating: "4.5", // Mock
                reviews: "100+ Reviews",
                desc: job.description?.substring(0, 100) + "..."
              });
            }
          });
          setCompanies(Array.from(companiesMap.values()));
          setJobs(jobsData);
        }

      } catch (error) {
        console.error("Error fetching home data", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <main className="min-h-screen bg-white font-sans antialiased">
      <ToastContainer position="top-center" autoClose={3000} hideProgressBar />
      <HeroSection cities={cities} stats={stats} />
      <SuccessTicker />
      <SevenServicesSection />
      <LocationSection cities={cities} />
      <TrustCard isLoggedIn={isLoggedIn} user={currentUser} />
      <FeatureBar />
      <JobRolesGrid skills={skills} />
      <CompaniesSlider companies={companies} />
      {users.length > 0 && (
        <ConnectJustLikeYou
          users={users}
          pendingIds={pendingConnectIds}
          connectedIds={connectedIds}
          onChat={handleChat}
          onFollow={handleConnect}
        />
      )}
      <FeaturedCompanies companies={companies} />
      <QualificationSearch />
      <JobTypeSection />
      <DiversityBanner />
      <LearnSection />
      {experts.length > 0 && (
        <ExpertSlider
          experts={experts}
          pendingIds={pendingConnectIds}
          connectedIds={connectedIds}
          onChat={handleChat}
          onFollow={handleConnect}
        />
      )}
      <EventsSection events={events} />
      <WalletBanner />
      <TestimonialsSection />
      <PremiumServicesBanner />
      <PopularQuestions questions={questions} />
    </main>
  );
}

// --- Components ---

const LocationSection = ({ cities }: { cities: any[] }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const PRIORITY_SLUGS = [
    "mumbai", "delhi", "bengaluru", "hyderabad", "pune",
    "ahmedabad", "chennai", "kolkata", "surat", "jaipur",
    "lucknow", "indore"
  ];

  // Map and strictly deduplicate by normalized city slug so no city is repeated
  const seenSlugs = new Set<string>();
  const rawList = (cities && cities.length > 0) ? cities : [
    { name: "Mumbai" }, { name: "Delhi NCR" }, { name: "Bengaluru" },
    { name: "Hyderabad" }, { name: "Pune" }, { name: "Ahmedabad" },
    { name: "Chennai" }, { name: "Kolkata" }, { name: "Surat" },
    { name: "Jaipur" }, { name: "Lucknow" }, { name: "Indore" }
  ];

  const resolvedHubs = rawList
    .map(c => getCityHubMetadata(c))
    .filter(hub => {
      const slug = normalizeCitySlug(hub.name);
      if (!slug || seenSlugs.has(slug)) return false;
      seenSlugs.add(slug);
      return true;
    })
    .sort((a, b) => {
      const slugA = normalizeCitySlug(a.name);
      const slugB = normalizeCitySlug(b.name);
      const indexA = PRIORITY_SLUGS.indexOf(slugA);
      const indexB = PRIORITY_SLUGS.indexOf(slugB);

      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.name.localeCompare(b.name);
    });

  const featuredHubs = resolvedHubs.filter(hub => !hub.isProcedural);
  const otherHubs = resolvedHubs.filter(hub => hub.isProcedural);

  const displayFeatured = featuredHubs.length > 0 ? featuredHubs : resolvedHubs;
  const displayOther = featuredHubs.length > 0 ? otherHubs : [];

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScrollability = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScrollability();
    el.addEventListener('scroll', checkScrollability, { passive: true });
    window.addEventListener('resize', checkScrollability);
    return () => {
      el.removeEventListener('scroll', checkScrollability);
      window.removeEventListener('resize', checkScrollability);
    };
  }, [displayFeatured]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const step = clientWidth > 640 ? Math.min(clientWidth * 0.75, 560) : 260;
      const scrollTo = direction === 'left' ? scrollLeft - step : scrollLeft + step;

      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  return (
    <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto font-sans">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-10">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
          Find Jobs by <span className="text-km-primary">Top Hubs</span>
        </h2>
        <p className="mt-2.5 sm:mt-3 text-sm sm:text-base text-slate-700 leading-relaxed max-w-2xl mx-auto font-normal">
          Explore verified openings and on-demand gig clusters across India&apos;s largest employment districts.
        </p>
      </div>

      {/* Unified Cohesive Container */}
      <div className="bg-slate-50/90 rounded-3xl border border-slate-200/90 p-4 sm:p-6 lg:p-8 shadow-xs">
        {/* Sub-header with Title & Responsive Prev/Next Controls */}
        <div className="flex items-center justify-between mb-4 sm:mb-5 px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
              Major Employment Metros
            </span>
            <span className="text-[11px] sm:text-xs font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-full border border-slate-200 shadow-2xs">
              {displayFeatured.length} Hubs
            </span>
          </div>

          {/* Prev / Next Controls - Responsive on All Devices */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white border border-slate-200 text-slate-700 hover:text-km-primary hover:border-km-primary flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs cursor-pointer active:scale-95"
              aria-label="Scroll left"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white border border-slate-200 text-slate-700 hover:text-km-primary hover:border-km-primary flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs cursor-pointer active:scale-95"
              aria-label="Scroll right"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Track */}
        <div
          ref={scrollRef}
          className="flex gap-4 sm:gap-5 overflow-x-auto pb-3 scroll-smooth scrollbar-hide w-full snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {displayFeatured.map((hub, idx) => (
            <Link
              key={idx}
              href={`/jobs?city=${encodeURIComponent(hub.id || hub.name)}`}
              className="snap-start shrink-0"
            >
              <div className="w-56 sm:w-64 bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-km-primary/50 transition-all overflow-hidden cursor-pointer group/card flex flex-col h-full">

                {/* Landmark Photo Header */}
                <div className="relative h-32 sm:h-36 w-full overflow-hidden bg-slate-900 shrink-0">
                  <img
                    src={hub.image}
                    alt={`${hub.name} landmark`}
                    className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500 ease-out"
                    loading="lazy"
                  />

                  {/* Subtle Gradient Scrim */}
                  <div className="absolute inset-0 bg-linear-to-t from-slate-950/85 via-slate-950/20 to-transparent pointer-events-none" />

                  {/* Clean Landmark Label */}
                  {hub.landmark && (
                    <span className="absolute bottom-2.5 left-3 text-[11px] font-medium text-white drop-shadow-xs truncate max-w-[90%]">
                      {hub.landmark}
                    </span>
                  )}
                </div>

                {/* Card Content Body - High Contrast Readable Text */}
                <div className="p-4 sm:p-5 text-center flex flex-col items-center justify-between flex-1">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 group-hover/card:text-km-primary transition-colors tracking-tight">
                      {hub.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-800 font-semibold mt-1">
                      {hub.vacancies}
                    </p>
                  </div>

                  <p className="text-xs text-slate-600 font-medium mt-3">
                    {hub.sector}
                  </p>
                </div>

              </div>
            </Link>
          ))}
        </div>

        {/* Connected Lower Shelf: More Regional Hubs */}
        {displayOther.length > 0 && (
          <div className="mt-6 sm:mt-7 pt-5 sm:pt-6 border-t border-slate-200/90">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-km-primary shrink-0" />
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-900">
                  More Employment Hubs & Regional Zones ({displayOther.length})
                </h3>
              </div>
              <Link
                href="/jobs"
                className="text-xs sm:text-sm font-bold text-km-primary hover:text-km-primary-dark transition-colors inline-flex items-center gap-1 group"
              >
                <span>View all locations</span>
                <span className="group-hover:translate-x-0.5 transition-transform" aria-hidden="true">&rarr;</span>
              </Link>
            </div>

            {/* High-Contrast Connected Directory Links */}
            <div className="flex flex-wrap items-center gap-x-5 sm:gap-x-6 gap-y-2.5 text-sm">
              {displayOther.map((hub) => (
                <Link
                  key={hub.id || hub.name}
                  href={`/jobs?city=${encodeURIComponent(hub.id || hub.name)}`}
                  className="text-slate-700 hover:text-km-primary font-medium hover:underline transition-colors"
                >
                  {hub.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

const TrustCard = ({ isLoggedIn, user }: { isLoggedIn?: boolean; user?: any }) => (
  <section className="py-10 sm:py-14 bg-white border-y border-slate-200/80 font-sans">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="bg-slate-900 rounded-3xl p-8 sm:p-10 text-white flex flex-col lg:flex-row items-center justify-between gap-8 shadow-xl">
        <div className="max-w-2xl text-center lg:text-left">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20">
            {isLoggedIn ? "Verified Candidate Hub" : "Platform Verification"}
          </span>
          <h3 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight mt-3 mb-2 leading-snug">
            {isLoggedIn
              ? `Welcome Back, ${user?.name || "Professional"}!`
              : "Trusted by Over 10 Lakh Candidates & 5,000+ Verified Employers"
            }
          </h3>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            {isLoggedIn
              ? "Your profile is verified. Connect directly with hiring managers, track your applications, and access high-paying trade gigs with zero brokerage."
              : "Direct HR calls, zero brokerage fees, and biometric/Aadhaar-verified employment credentials across India."
            }
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0 w-full sm:w-auto">
          {isLoggedIn ? (
            <>
              <Link href="/jobs" className="w-full sm:w-auto">
                <button className="w-full sm:w-auto bg-km-primary hover:bg-km-primary-dark text-white px-8 py-3.5 rounded-xl font-bold transition-all shadow-md">
                  Explore Matched Jobs
                </button>
              </Link>
              <Link href="/user/applications" className="w-full sm:w-auto">
                <button className="w-full sm:w-auto border border-slate-700 hover:border-slate-500 hover:bg-slate-800 text-white px-7 py-3.5 rounded-xl font-bold transition-all text-sm">
                  View My Applications
                </button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/register" className="w-full sm:w-auto">
                <button className="w-full sm:w-auto bg-km-primary hover:bg-km-primary-dark text-white px-8 py-3.5 rounded-xl font-bold transition-all shadow-md">
                  Register Now
                </button>
              </Link>
              <Link href="/jobs" className="w-full sm:w-auto">
                <button className="w-full sm:w-auto border border-slate-700 hover:border-slate-500 hover:bg-slate-800 text-white px-7 py-3.5 rounded-xl font-bold transition-all text-sm">
                  Explore Verified Openings
                </button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  </section>
);

const FeatureBar = () => {
  const features = [
    { icon: <ShieldCheck size={22} className="text-blue-600" />, title: "Zero Brokerage", desc: "100% free direct hiring" },
    { icon: <PhoneCall size={22} className="text-amber-600" />, title: "Direct HR Calls", desc: "Fast interview scheduling" },
    { icon: <Zap size={22} className="text-emerald-600" />, title: "15-Min Gig Dispatch", desc: "Hyperlocal on-demand jobs" },
    { icon: <CheckCircle size={22} className="text-indigo-600" />, title: "Verified Badges", desc: "ID backed credentials" },
    { icon: <Wallet size={22} className="text-rose-600" />, title: "Daily Escrow Payouts", desc: "Guaranteed wallet transfers" },
  ];

  return (
    <div className="bg-slate-50/80 py-10 sm:py-12 border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-8">
        {features.map((f, i) => (
          <div key={i} className="flex flex-col items-center text-center p-3">
            <div className="w-12 h-12 rounded-xl bg-white border border-slate-200/90 flex items-center justify-center shadow-2xs mb-3">
              {f.icon}
            </div>
            <h4 className="text-sm font-bold text-slate-900 leading-snug">{f.title}</h4>
            <p className="text-xs text-slate-500 mt-1">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Job Roles Grid ---
const JobRolesGrid = ({ skills = [] }: { skills?: any[] }) => {
  const popularTradeConfig = [
    { title: "Delivery Executive", img: "/asset/trades/delivery.jpg", vacancies: "55,000+ Openings", keywords: ["delivery", "courier", "rider"] },
    { title: "Commercial Vehicle Driver", img: "/asset/trades/driver.jpg", vacancies: "38,000+ Openings", keywords: ["driver", "commercial", "truck"] },
    { title: "Warehouse Associate", img: "/asset/trades/warehouse.jpg", vacancies: "42,000+ Openings", keywords: ["warehouse", "logistics", "inventory"] },
    { title: "Electrician", img: "/asset/trades/electrician.jpg", vacancies: "28,000+ Openings", keywords: ["electrician"] },
    { title: "Security Guard", img: "/asset/trades/security.jpg", vacancies: "35,000+ Openings", keywords: ["security", "guard"] },
    { title: "Plumber", img: "/asset/trades/plumber.jpg", vacancies: "22,000+ Openings", keywords: ["plumber"] },
    { title: "Painter & Decorator", img: "/asset/trades/painter.jpg", vacancies: "18,000+ Openings", keywords: ["painter"] },
    { title: "AC & HVAC Technician", img: "/asset/trades/ac.jpg", vacancies: "19,000+ Openings", keywords: ["ac", "hvac", "technician"] },
    { title: "Housekeeping & Helper", img: "/asset/trades/labour.jpg", vacancies: "48,000+ Openings", keywords: ["housekeeping", "helper", "peon", "labour"] },
    { title: "Office Assistant & DEO", img: "/asset/trades/office-executive.jpg", vacancies: "30,000+ Openings", keywords: ["office", "data entry", "deo", "assistant"] },
  ];

  // Match each trade with real DB skills where available
  const displayRoles = popularTradeConfig.map((item) => {
    const matchedSkill = skills?.find((s: any) =>
      item.keywords.some(kw => (s.name || '').toLowerCase().includes(kw))
    );
    return {
      title: matchedSkill?.name || item.title,
      img: item.img,
      vacancies: matchedSkill?.count ? `${matchedSkill.count} Openings` : item.vacancies
    };
  });

  return (
    <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto font-sans">
      <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
        <h3 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
          Explore Popular <span className="text-km-primary">Job Categories</span>
        </h3>
        <p className="mt-2.5 sm:mt-3 text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
          Verified openings across logistics, technical trades, facility management, and retail.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-6">
        {displayRoles.map((role, i) => (
          <Link key={i} href={`/jobs?role=${encodeURIComponent(role.title)}`}>
            <div className="relative h-48 sm:h-56 rounded-2xl overflow-hidden group cursor-pointer border border-slate-200/90 shadow-2xs hover:shadow-lg transition-all duration-300">
              <Image
                src={role.img}
                alt={role.title}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-linear-to-t from-slate-950/90 via-slate-950/30 to-transparent z-10" />
              <div className="absolute bottom-3.5 left-3.5 right-3.5 z-20 text-white">
                <h4 className="font-bold text-sm sm:text-base leading-snug group-hover:text-amber-300 transition-colors">
                  {role.title}
                </h4>
                <p className="text-xs text-slate-300 font-semibold mt-0.5">
                  {role.vacancies}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="text-center mt-8 sm:mt-10">
        <Link href="/jobs">
          <button className="px-8 py-3 border-2 border-km-primary text-km-primary hover:bg-km-primary hover:text-white rounded-xl text-sm font-bold transition-all shadow-2xs cursor-pointer">
            View All Job Categories →
          </button>
        </Link>
      </div>
    </section>
  );
};

// --- Enterprise Hiring Partners Showcase ---

const CompaniesSlider = ({ companies }: { companies: any[] }) => {
  return (
    <section className="py-10 sm:py-12 bg-slate-50/70 border-b border-slate-200/80 overflow-hidden font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-6">
        <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">
          Top Employers Hiring Verified Talent on KaamMilega™
        </p>
      </div>

      <div className="relative overflow-hidden py-1">
        <div className="animate-km-marquee flex gap-6 sm:gap-8 items-center">
          {[...enterprisePartners, ...enterprisePartners].map((partner, idx) => (
            <Link
              key={`${partner.name}-${idx}`}
              href={`/jobs?company=${encodeURIComponent(partner.name)}`}
              className="flex items-center gap-3.5 bg-white border border-slate-200/90 rounded-2xl px-4 py-2.5 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all shrink-0 group/logo"
            >
              <div className={`w-10 h-10 rounded-xl border p-1.5 flex items-center justify-center shrink-0 ${partner.bgClass || 'bg-slate-50 border-slate-200/70'}`}>
                <img
                  src={partner.logo}
                  alt={partner.name}
                  className={`object-contain ${partner.imgClass || 'max-h-full max-w-full'}`}
                />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-900 leading-tight group-hover/logo:text-km-primary transition-colors">
                  {partner.name}
                </p>
                <p className="text-[11px] font-semibold text-emerald-600 mt-0.5 leading-none">
                  {partner.openings}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

// --- Featured Companies Grid ---
const FeaturedCompanies = ({ companies }: { companies: any[] }) => {
  return (
    <section className="py-12 sm:py-16 bg-white border-b border-slate-200/80 overflow-hidden font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
            Featured Companies <span className="text-km-primary">Actively Hiring</span>
          </h2>
          <p className="mt-2.5 sm:mt-3 text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Direct recruitment partnerships with leading enterprises across India offering verified compensation and zero brokerage fees.
          </p>
        </div>

        {/* 6 cards on same line for md+, 3 cards per line for mobile devices */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2.5 sm:gap-3 md:gap-3 lg:gap-4">
          {enterprisePartners.map((co, i) => (
            <CompanyCard key={co.name || i} company={co} variant="expanded" />
          ))}
        </div>

        {/* Explore All Button matching 'Learn With KaamMilega' style */}
        <div className="text-center mt-8 sm:mt-10 flex justify-center">
          <Link
            href="/jobs"
            className="py-3 px-6 sm:px-8 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-2xl md:rounded-3xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <span>View All 5,000+ Enterprise Employers</span>
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
};

// --- Job Search by Qualification ---
const QualificationSearch = () => {
  const qualifications = [
    { label: "Below 10th", vacancies: "9,30,000+ Openings", icon: <BookOpen size={24} className="text-amber-600" />, bg: "bg-amber-50" },
    { label: "10th Pass", vacancies: "4,00,000+ Openings", icon: <BookOpen size={24} className="text-blue-600" />, bg: "bg-blue-50" },
    { label: "12th Pass", vacancies: "9,00,000+ Openings", icon: <Scroll size={24} className="text-emerald-600" />, bg: "bg-emerald-50" },
    { label: "Diploma / ITI", vacancies: "50,000+ Openings", icon: <Award size={24} className="text-purple-600" />, bg: "bg-purple-50" },
    { label: "Graduate", vacancies: "7,30,000+ Openings", icon: <GraduationCap size={24} className="text-indigo-600" />, bg: "bg-indigo-50" },
    { label: "Post Graduate", vacancies: "25,000+ Openings", icon: <GraduationCap size={24} className="text-rose-600" />, bg: "bg-rose-50" },
  ];

  return (
    <section className="py-12 sm:py-16 bg-slate-50/70 border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto text-center">
        <div className="max-w-3xl mx-auto mb-10 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
            Search Jobs Based On Your <span className="text-km-primary">Qualification</span>
          </h2>
          <p className="mt-2.5 sm:mt-3 text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Find verified roles matched specifically to your education background and vocational certifications.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-5">
          {qualifications.map((q, i) => (
            <Link key={i} href={`/jobs?qualification=${encodeURIComponent(q.label)}`}>
              <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-blue-500/40 transition-all cursor-pointer flex flex-col items-center group/card">
                <div className={`w-12 h-12 rounded-xl ${q.bg} flex items-center justify-center mb-3 group-hover/card:scale-110 transition-transform`}>
                  {q.icon}
                </div>
                <h4 className="font-bold text-slate-900 group-hover/card:text-km-primary transition-colors text-sm sm:text-base mb-1">
                  {q.label}
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  {q.vacancies}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

// --- Job Type Selection ---
const JobTypeSection = () => {
  const types = [
    { label: "Work From Home", vacancies: "9,30,000+", icon: <Home size={20} className="text-green-600" /> },
    { label: "Part Time", vacancies: "9,30,000+", icon: <Clock size={20} className="text-orange-600" /> },
    { label: "Full Time", vacancies: "9,30,000+", icon: <Briefcase size={20} className="text-blue-600" /> },
  ];

  const secondaryTypes = [
    { label: "Fresher Jobs", vacancies: "9,30,000+", icon: <Users size={20} className="text-blue-500" /> },
    { label: "Jobs For Women", vacancies: "9,30,000+", icon: <UserRound size={20} className="text-pink-500" /> },
  ];

  return (
    <section className="py-12 md:py-20 bg-white px-4 md:px-6">
      <div className="max-w-5xl mx-auto text-center">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black mb-8 md:mb-12">
          What <span className="text-km-primary">Type Of Job</span> Do You Want?
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          {types.map((t, i) => (
            <Link key={i} href={`/jobs?job_type=${t.label}`}>
              <div className="flex items-center gap-3 md:gap-4 bg-white border-2 border-dashed border-gray-200 rounded-2xl md:rounded-3xl p-4 md:p-6 hover:border-blue-200 transition-colors cursor-pointer">
                <div className="p-2 md:p-3 bg-gray-50 rounded-xl md:rounded-2xl shrink-0">{t.icon}</div>
                <div className="text-left">
                  <h4 className="font-bold text-gray-800 text-sm">{t.label} <ChevronRight size={14} className="inline ml-1 opacity-40" /></h4>
                  <p className="text-[10px] text-gray-400">View {t.vacancies} Vacancies</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          {secondaryTypes.map((t, i) => (
            <Link key={i} href={`/jobs?job_type=${t.label}`}>
              <div className="flex items-center gap-3 md:gap-4 bg-white border-2 border-dashed border-gray-200 rounded-2xl md:rounded-3xl p-4 md:p-6 hover:border-blue-200 transition-colors cursor-pointer">
                <div className="p-2 md:p-3 bg-gray-50 rounded-xl md:rounded-2xl shrink-0">{t.icon}</div>
                <div className="text-left">
                  <h4 className="font-bold text-gray-800 text-sm">{t.label}</h4>
                  <p className="text-[10px] text-gray-400">View {t.vacancies} Vacancies</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};


// --- Diversity & Inclusion Banner ---
// --- Diversity & Inclusion Banner ---
const DiversityBanner = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const INTRO_YOUTUBE_ID = "1mHjMNZZvFo"; // Official site introduction / tutorial video ID
  const thumbnailUrl = `https://img.youtube.com/vi/${INTRO_YOUTUBE_ID}/hqdefault.jpg`;

  return (
    <section className="px-3 md:px-6 py-6 md:py-10 max-w-7xl mx-auto font-sans">
      <div className="relative min-h-75 md:min-h-85 md:h-auto lg:h-92 rounded-3xl md:rounded-[40px] overflow-hidden flex flex-col md:flex-row items-center justify-between px-6 md:px-10 lg:px-12 text-white py-8 md:py-8 gap-6">
        <div className="absolute inset-0 bg-gradient-to-r from-[#071A4D] via-[#0B1F52] to-[#0B5ED7] z-10" />

        {/* Left Content */}
        <div className="relative z-20 max-w-lg">
          {/* Brand Logo & Icon Header */}
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="w-9 h-9 rounded-full bg-white p-1.5 shadow-sm flex items-center justify-center shrink-0">
              <Image
                src="/kaammilega-logo-icon.png"
                alt="KaamMilega Icon"
                width={28}
                height={28}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="bg-white/95 backdrop-blur-md px-3 py-1 rounded-xl shadow-xs flex items-center">
              <Image
                src="/kaammilega-logo-text.png"
                alt="KaamMilega"
                width={110}
                height={24}
                className="h-5 sm:h-5.5 w-auto object-contain"
              />
            </div>
          </div>

          {/* Verified Partner Badge & 4.8 Rating */}
          <div className="flex items-center gap-2 mb-3.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-xs font-bold text-white shadow-xs">
              <CheckCircle2 size={13} className="fill-emerald-400 text-[#071A4D]" />
              <span>Verified Partner</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs font-bold text-white shadow-xs">
              <Star size={11} className="fill-yellow-400 text-yellow-400" />
              <span>4.8</span>
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black leading-tight mb-4">
            Diversity And Inclusion At Every Workplace
          </h2>
          <Link
            href="/about"
            className="text-sm font-bold underline hover:text-km-accent-light transition-colors inline-block"
          >
            Learn More
          </Link>
        </div>

        {/* Right Section: In-Web / In-App Video Player */}
        <div className="relative z-20 w-full sm:w-80 md:w-[420px] lg:w-[480px] xl:w-[520px] aspect-video bg-black/40 backdrop-blur-md border border-white/20 rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center shrink-0">
          {isPlaying ? (
            <div className="relative w-full h-full">
              <iframe
                src={`https://www.youtube.com/embed/${INTRO_YOUTUBE_ID}?autoplay=1&rel=0`}
                title="KaamMilega Introduction Video"
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
              <button
                type="button"
                onClick={() => setIsPlaying(false)}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center transition-colors cursor-pointer z-30"
                title="Close video"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div
              onClick={() => setIsPlaying(true)}
              className="relative w-full h-full cursor-pointer group flex items-center justify-center"
              title="Click to play site introduction video"
            >
              <img
                src={thumbnailUrl}
                alt="KaamMilega Introduction Video"
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-black/35 group-hover:bg-black/45 transition-colors" />
              <div className="relative z-10 w-13 h-13 sm:w-14 sm:h-14 bg-km-accent hover:bg-km-accent-dark rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-orange-950/40">
                <Play fill="white" size={22} className="ml-1 text-white" />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

interface LearnVideo {
  id: string;
  title: string;
  time: string;
  youtube_url: string;
  youtube_video_id: string;
  thumbnail: string;
}

const DEFAULT_LEARN_VIDEOS: LearnVideo[] = [
  {
    id: "learn-1",
    title: "Resume Writing Secrets to Get Hired Fast",
    time: "5 mins",
    youtube_url: "https://www.youtube.com/watch?v=VPrT5JpXh0U",
    youtube_video_id: "VPrT5JpXh0U",
    thumbnail: "https://img.youtube.com/vi/VPrT5JpXh0U/maxresdefault.jpg",
  },
  {
    id: "learn-2",
    title: "How to Ace Your Job Interview - Top Tips",
    time: "5 mins",
    youtube_url: "https://www.youtube.com/watch?v=1mHjMNZZvFo",
    youtube_video_id: "1mHjMNZZvFo",
    thumbnail: "https://img.youtube.com/vi/1mHjMNZZvFo/maxresdefault.jpg",
  },
  {
    id: "learn-3",
    title: "Salary Negotiation Techniques for Job Seekers",
    time: "6 mins",
    youtube_url: "https://www.youtube.com/watch?v=KMbeK_6ATxQ",
    youtube_video_id: "KMbeK_6ATxQ",
    thumbnail: "https://img.youtube.com/vi/KMbeK_6ATxQ/maxresdefault.jpg",
  },
  {
    id: "learn-4",
    title: "Top Common HR Interview Questions and Best Answers",
    time: "5 mins",
    youtube_url: "https://www.youtube.com/watch?v=7_aAfl_2aSA",
    youtube_video_id: "7_aAfl_2aSA",
    thumbnail: "https://img.youtube.com/vi/7_aAfl_2aSA/maxresdefault.jpg",
  },
];

// --- Video Learning Section ---
const LearnSection = () => {
  const [videos, setVideos] = useState<LearnVideo[]>(DEFAULT_LEARN_VIDEOS);
  const [activeIndex, setActiveIndex] = useState(0);
  const [playingVideo, setPlayingVideo] = useState<LearnVideo | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Fetch resource videos dynamically from /courses (same source as /resources)
  useEffect(() => {
    api.get("/courses?limit=20")
      .then((res: any) => {
        const list = res?.data || (Array.isArray(res) ? res : []);
        if (Array.isArray(list) && list.length > 0) {
          // Pick 4 random videos from the resources list
          const shuffled = [...list].sort(() => 0.5 - Math.random());
          const selected: LearnVideo[] = shuffled.slice(0, 4).map((item: any, idx: number) => {
            const videoId =
              item.youtube_video_id ||
              extractYouTubeVideoId(item.youtube_url || "") ||
              DEFAULT_LEARN_VIDEOS[idx % DEFAULT_LEARN_VIDEOS.length].youtube_video_id;

            // Prefer true 16:9 maxresdefault thumbnail over 4:3 letterboxed hqdefault
            const thumb =
              (videoId ? getYouTubeMaxResThumbnail(videoId) : "") ||
              (item.thumbnail_url && !item.thumbnail_url.includes("hqdefault.jpg") ? item.thumbnail_url : "") ||
              DEFAULT_LEARN_VIDEOS[idx % DEFAULT_LEARN_VIDEOS.length].thumbnail;

            return {
              id: item.id || item._id || `backend-course-${idx}`,
              title: item.title || DEFAULT_LEARN_VIDEOS[idx % DEFAULT_LEARN_VIDEOS.length].title,
              time: item.duration ? (String(item.duration).match(/min|sec|hour|m|s/i) ? String(item.duration) : `${item.duration} mins`) : "5 mins",
              youtube_url: item.youtube_url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : ""),
              youtube_video_id: videoId,
              thumbnail: thumb,
            };
          });

          // Ensure exactly 4 cards are always available even if backend has fewer
          while (selected.length < 4) {
            const fallbackItem = DEFAULT_LEARN_VIDEOS[selected.length % DEFAULT_LEARN_VIDEOS.length];
            selected.push({ ...fallbackItem, id: `fallback-${selected.length}` });
          }

          setVideos(selected);
        }
      })
      .catch((err) => {
        console.error("Failed to load learn section courses from resources:", err);
      });
  }, []);

  // Infinite cyclic rotation: advances to next card every 2.5s (pauses on hover)
  useEffect(() => {
    if (videos.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % videos.length);
    }, 1000);

    return () => clearInterval(timer);
  }, [videos.length, isPaused]);

  const activeVideo = videos[activeIndex] || videos[0] || DEFAULT_LEARN_VIDEOS[0];

  return (
    <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto font-sans">
      {/* Centered Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-12">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight flex items-center justify-center flex-wrap gap-2.5">
          <span>Learn With</span>
          <img
            src="/kaammilega-logo-text.png"
            alt="KaamMilega"
            className="h-7 sm:h-8 md:h-9 w-auto inline-block object-contain"
          />
        </h2>
      </div>

      <div
        className="flex flex-col md:flex-row gap-6 md:gap-8 items-start md:items-center"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Main Video Player (Left Side - Clean thumbnail with Play button in exact center) */}
        <div
          onClick={() => setPlayingVideo(activeVideo)}
          className="w-full md:flex-1 aspect-video bg-slate-900 rounded-2xl md:rounded-3xl relative group cursor-pointer overflow-hidden shadow-xl border border-slate-200/80"
          title={`Click to watch: ${activeVideo.title}`}
        >
          {/* Main Thumbnail synced with active card (absolute background) */}
          <img
            key={activeVideo.id || activeVideo.thumbnail}
            src={activeVideo.youtube_video_id ? getYouTubeMaxResThumbnail(activeVideo.youtube_video_id) : activeVideo.thumbnail}
            alt={activeVideo.title}
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (activeVideo.youtube_video_id) {
                if (target.src.includes('maxresdefault.jpg')) {
                  target.src = `https://img.youtube.com/vi/${activeVideo.youtube_video_id}/mqdefault.jpg`;
                } else if (target.src.includes('mqdefault.jpg')) {
                  target.src = `https://img.youtube.com/vi/${activeVideo.youtube_video_id}/hqdefault.jpg`;
                }
              }
            }}
          />

          {/* Clean subtle hover tint */}
          <div className="absolute inset-0 bg-black/10 group-hover:bg-black/25 transition-colors" />

          {/* Centered Large Play Button Logo - In exact dead center */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white text-[#071A4D] flex items-center justify-center shadow-2xl group-hover:scale-110 group-hover:bg-[#071A4D] group-hover:text-white transition-all duration-300">
              <Play size={28} fill="currentColor" className="ml-1" />
            </div>
          </div>
        </div>

        {/* Playlist (Right Side - 4 cards + Fixed Green Explore Button at Bottom) */}
        <div className="w-full md:w-80 lg:w-92 xl:w-96 flex flex-col justify-between gap-3">
          <div className="space-y-2.5">
            {videos.map((video, i) => {
              const isActive = i === activeIndex;
              return (
                <div
                  key={video.id || i}
                  onClick={() => setActiveIndex(i)}
                  className={`p-1.5 pl-2 pr-5 rounded-full border transition-all duration-200 cursor-pointer relative overflow-hidden group/card flex items-center gap-3 ${isActive
                    ? 'bg-blue-50/90 border-[#0B5ED7] shadow-xs ring-1 ring-[#0B5ED7]/25'
                    : 'bg-white border-[#D9E0EA] hover:bg-slate-50/90 hover:border-slate-300 hover:shadow-xs'
                    }`}
                >
                  {/* Thumbnail with concentric rounded curve */}
                  <div className="relative w-22 sm:w-24 aspect-video rounded-[22px] overflow-hidden bg-slate-900 shrink-0 border border-slate-200/70 shadow-2xs group-hover/card:scale-102 transition-transform">
                    <img
                      src={video.youtube_video_id ? getYouTubeMaxResThumbnail(video.youtube_video_id) : video.thumbnail}
                      alt={video.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (video.youtube_video_id) {
                          if (target.src.includes('maxresdefault.jpg')) {
                            target.src = `https://img.youtube.com/vi/${video.youtube_video_id}/mqdefault.jpg`;
                          } else if (target.src.includes('mqdefault.jpg')) {
                            target.src = `https://img.youtube.com/vi/${video.youtube_video_id}/hqdefault.jpg`;
                          }
                        }
                      }}
                    />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center shadow-xs transition-transform ${isActive ? 'bg-[#0B5ED7] text-white' : 'bg-white/95 text-[#071A4D]'
                          }`}
                      >
                        <Play size={9} fill="currentColor" className="ml-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Title and Duration */}
                  <div className="flex-1 min-w-0 pr-1">
                    <h4
                      className={`text-xs sm:text-[13px] font-bold leading-tight truncate transition-colors ${isActive ? 'text-[#071A4D]' : 'text-slate-800 group-hover/card:text-[#0B5ED7]'
                        }`}
                      title={video.title}
                    >
                      {video.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                        <Clock size={11} className={isActive ? 'text-[#0B5ED7]' : 'text-slate-400'} />
                        <span>{video.time}</span>
                      </span>
                      {isActive && (
                        <span className="text-[10px] font-bold text-[#0B5ED7] bg-blue-100/70 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          Playing
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Fixed Green Button matching Project Color Rules */}
          <Link
            href="/resources"
            className="w-full py-3 px-5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-full text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs hover:shadow-md transition-all cursor-pointer mt-1"
          >
            <span>Explore All Resources</span>
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>

      {/* Embedded YouTube Player Modal when clicking play */}
      {playingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-sans">
          <div className="relative w-full max-w-3xl bg-slate-950 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 border-b border-slate-800 text-white">
              <div className="flex items-center gap-2 pr-4 overflow-hidden">
                <span className="text-xs sm:text-sm font-semibold text-white/90 truncate">
                  {playingVideo.title}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPlayingVideo(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                aria-label="Close video"
              >
                <X size={16} />
              </button>
            </div>
            <div className="aspect-video w-full bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${playingVideo.youtube_video_id || "dQw4w9WgXcQ"}?autoplay=1&rel=0`}
                title={playingVideo.title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

// --- Expert Slider Section ---
const ExpertSlider = ({
  experts,
  pendingIds = [],
  connectedIds = [],
  onChat,
  onFollow,
}: {
  experts: any[];
  pendingIds?: string[];
  connectedIds?: string[];
  onChat: (id: string) => void;
  onFollow: (id: string, name?: string) => void;
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          setCurrentUserId(parsed.id || parsed._id || '');
        }
      } catch { }
    }
  }, []);

  if (!experts || experts.length === 0) return null;

  return (
    <section className="w-full py-10 px-6 bg-white overflow-hidden font-sans">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-black text-center text-slate-900 mb-8 tracking-tight">
          Connect With Our <span className="text-km-primary">Experts</span>
        </h2>
        <div
          ref={scrollContainerRef}
          className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide"
        >
          {experts.map((expert, i) => {
            const expertId = expert.id || expert._id || '';
            const isSelf = Boolean(currentUserId && expertId === currentUserId);
            const isPending = pendingIds.includes(expertId);
            const isConnected = (connectedIds || []).includes(expertId);

            return (
              <ProfileConnectionCard
                key={expertId || i}
                user={expert}
                variant="slider"
                isSelf={isSelf}
                isPending={isPending}
                isConnected={isConnected}
                entityType="expert"
                onChat={onChat}
                onFollow={onFollow}
              />
            );
          })}
        </div>

        {/* Custom Interactive Scrollbar */}
        <InteractiveScrollbar scrollRef={scrollContainerRef} className="max-w-4xl mx-auto mt-4 px-4 sm:px-0" />
      </div>
    </section>
  );
};

// --- Upcoming Events & Challenges ---
const EventsSection = ({ events }: { events: any[] }) => {
  const displayEvents = events.length > 0 ? events : [];

  if (displayEvents.length === 0) return null;

  return (
    <section className="py-12 md:py-20 px-4 md:px-6 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row gap-8 md:gap-12">
        {/* Left Side: Content */}
        <div className="lg:w-1/3 text-left">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 mb-4 md:mb-6 leading-tight">
            Upcoming <span className="text-km-primary">Events And Challenges</span>
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-6 md:mb-8">
            Connect with peer learners, attend hiring workshops, and gain certified skills in community-driven events.
          </p>
          <Link href="/events">
            <button className="bg-km-primary hover:bg-km-primary-dark text-white px-6 md:px-8 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-md">
              View All Events <ChevronRight size={18} />
            </button>
          </Link>
        </div>

        {/* Right Side: Slider (Moving Towards Right) */}
        <div className="lg:w-2/3 overflow-hidden">
          <motion.div
            className="flex gap-4 md:gap-6"
            animate={{ x: [0, -400] }}
            transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
          >
            {displayEvents.map((event, i) => (
              <Link href={`/events/${event.id}`} key={i} className="min-w-70 sm:min-w-80 md:min-w-85 bg-white rounded-3xl md:rounded-4xl overflow-hidden shadow-lg border border-gray-50 flex flex-col group transition-all hover:shadow-xl">
                <div className="h-40 bg-gray-200 relative overflow-hidden">
                  {event.image_url ? (
                    <img src={event.image_url} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full bg-[#071A4D] flex items-center justify-center relative overflow-hidden">
                      <div className="flex items-center justify-center opacity-60">
                        <div className="w-10 h-10 bg-blue-400 clip-path-triangle transform -rotate-12 -translate-x-2" />
                        <div className="w-8 h-8 bg-blue-300 clip-path-triangle translate-x-2 translate-y-2" />
                      </div>
                    </div>
                  )}
                  <span className="absolute top-4 left-4 bg-black/60 text-white text-[10px] px-3 py-1 rounded-full backdrop-blur-md">{event.location || 'Online'}</span>
                </div>
                <div className="p-6 md:p-8 flex flex-col flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-lg">{event.title?.[0] || '🎉'}</div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-gray-900 text-sm md:text-base truncate">{event.title}</h4>
                      <p className="text-[10px] text-gray-400 font-bold uppercase truncate">By {event.organizer}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-gray-400 font-bold mb-6 border-b border-gray-50 pb-4">
                    <span className="flex items-center gap-1"><Calendar size={12} className="text-km-primary" /> {event.date}</span>
                    <span className="flex items-center gap-1"><Users size={12} className="text-km-primary" /> 1K+ Joined</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-black mt-auto">
                    <span className="text-km-accent">🔥 Selling Fast</span>
                    <span className="text-km-primary bg-blue-50 px-4 py-2 rounded-full hover:bg-blue-100 transition-colors">Register</span>
                  </div>
                </div>
              </Link>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// --- Wallet Recharge Banner ---
const WalletBanner = () => (
  <section className="px-4 sm:px-6 lg:px-8 py-8 sm:py-12 max-w-7xl mx-auto font-sans">
    <div className="bg-linear-to-r from-orange-500 via-orange-600 to-amber-700 rounded-3xl md:rounded-[40px] p-8 md:p-12 relative overflow-hidden flex flex-col md:flex-row items-center justify-center md:justify-between text-white shadow-lg">
      {/* Background Graphic situated on the right away from text */}
      <div className="absolute right-6 md:right-12 top-1/2 -translate-y-1/2 opacity-15 pointer-events-none select-none flex items-center gap-4">
        <Wallet size={120} className="text-white hidden lg:block" />
        <span className="text-5xl lg:text-7xl font-black uppercase tracking-widest text-white/30 hidden md:block">
          WALLET
        </span>
      </div>

      <div className="relative z-10 text-center md:text-left max-w-xl">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black mb-2 leading-tight">
          Recharge Your <span className="text-amber-200">Wallet</span> And<br />Get Hired Faster
        </h2>
        <p className="text-sm sm:text-base opacity-95 font-medium mb-6">Kaam Bhi. Skill Bhi. Kamaai Bhi.</p>
        <button className="bg-white text-orange-700 hover:bg-orange-50 px-6 sm:px-8 py-3 rounded-2xl font-bold flex items-center gap-2 mx-auto md:mx-0 shadow-xl transition-colors cursor-pointer">
          <Wallet size={18} /> Recharge Now
        </button>
      </div>
    </div>
  </section>
);

// --- Verified Stories from Real Candidates (Horizontal Auto-Scroll Marquee) ---
interface TestimonialItem {
  id: string;
  name: string;
  role: string;
  company: string;
  city: string;
  trade_tag?: string;
  rating: number;
  review?: string;
  youtube_url: string;
  youtube_video_id: string;
  thumbnail_url: string;
}

const DEFAULT_TESTIMONIALS: TestimonialItem[] = [
  {
    id: "story-1",
    name: "Dharmender Kumar",
    role: "Warehouse Operations Supervisor",
    company: "Technova Logistics",
    city: "Bhiwandi, Thane",
    trade_tag: "Logistics & Warehousing",
    rating: 5,
    review: "Zero brokerage and direct HR call. Joined Technova in 3 days!",
    youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    youtube_video_id: "dQw4w9WgXcQ",
    thumbnail_url: "/asset/trades/warehouse.jpg",
  },
  {
    id: "story-2",
    name: "Sachin Singh",
    role: "Heavy Commercial Driver",
    company: "City Fleet Transport",
    city: "Surat, Gujarat",
    trade_tag: "Commercial Transport",
    rating: 5,
    review: "Verified company with punctual salary. Best job platform for drivers.",
    youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    youtube_video_id: "dQw4w9WgXcQ",
    thumbnail_url: "/asset/trades/driver.jpg",
  },
  {
    id: "story-3",
    name: "Pooja Verma",
    role: "Retail Store Executive",
    company: "Tata Croma",
    city: "Mumbai, Maharashtra",
    trade_tag: "Retail & Customer Ops",
    rating: 5,
    review: "Instant interview schedule without middlemen. Very smooth onboarding.",
    youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    youtube_video_id: "dQw4w9WgXcQ",
    thumbnail_url: "/asset/trades/office-executive.jpg",
  },
  {
    id: "story-4",
    name: "Raju Yadav",
    role: "Certified Industrial Electrician",
    company: "InstantMilega™ Partner",
    city: "Delhi NCR",
    trade_tag: "Technical Services",
    rating: 5,
    review: "Direct corporate booking and verified partner technical trade jobs.",
    youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    youtube_video_id: "dQw4w9WgXcQ",
    thumbnail_url: "/asset/trades/electrician.jpg",
  },
];

const TestimonialsSection = () => {
  const [stories, setStories] = useState<TestimonialItem[]>(DEFAULT_TESTIMONIALS);
  const [selectedVideo, setSelectedVideo] = useState<TestimonialItem | null>(null);

  useEffect(() => {
    api.get("/testimonials")
      .then((res: any) => {
        const list = res?.data || (Array.isArray(res) ? res : []);
        if (Array.isArray(list) && list.length > 0) {
          setStories(list);
        }
      })
      .catch((err) => {
        console.error("Failed to load testimonials:", err);
      });
  }, []);

  // Split testimonials for two opposite-direction rows
  const { row1, row2 } = useMemo(() => {
    if (stories.length >= 10) {
      // When 10 or more testimonials exist: split into two distinct unique rows without repeating across rows
      const half = Math.ceil(stories.length / 2);
      const row1Unique = stories.slice(0, half);
      const row2Unique = stories.slice(half);

      return {
        row1: [...row1Unique, ...row1Unique],
        row2: [...row2Unique, ...row2Unique],
      };
    }

    // When fewer testimonials: distribute and repeat to ensure seamless infinite looping track
    const r1: TestimonialItem[] = [];
    const r2: TestimonialItem[] = [];
    stories.forEach((item, index) => {
      if (index % 2 === 0) r1.push(item);
      else r2.push(item);
    });

    if (r2.length === 0 && r1.length > 0) {
      r2.push(...r1);
    }

    const repeat1 = Math.max(2, Math.ceil(8 / Math.max(1, r1.length)));
    const repeat2 = Math.max(2, Math.ceil(8 / Math.max(1, r2.length)));

    const row1Out: TestimonialItem[] = [];
    const row2Out: TestimonialItem[] = [];
    for (let i = 0; i < repeat1; i++) row1Out.push(...r1);
    for (let i = 0; i < repeat2; i++) row2Out.push(...r2);

    return { row1: row1Out, row2: row2Out };
  }, [stories]);

  return (
    <section className="py-12 sm:py-16 bg-slate-50/70 border-b border-slate-200/80 overflow-hidden font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8 sm:mb-10 text-center">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
          Verified Stories from <span className="text-km-primary">Real Candidates</span>
        </h2>
        <p className="mt-2.5 sm:mt-3 text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
          Real workers across logistics, transportation, and technical trades hired with zero brokerage and direct HR calls.
        </p>
      </div>

      {/* Two Horizontal Lines of Auto-Scrolled Marquee moving in opposite directions */}
      <div className="space-y-4 sm:space-y-5 py-1">
        {/* Row 1: Moves Left */}
        <div className="relative w-full overflow-hidden group/row1">
          <div className="animate-km-marquee flex gap-4 w-max group-hover/row1:[animation-play-state:paused]">
            {row1.map((story, i) => (
              <CompactTestimonialCard
                key={`row1-${story.id}-${i}`}
                story={story}
                onOpenVideo={setSelectedVideo}
              />
            ))}
          </div>
        </div>

        {/* Row 2: Moves Right */}
        <div className="relative w-full overflow-hidden group/row2">
          <div className="animate-km-marquee-reverse flex gap-4 w-max group-hover/row2:[animation-play-state:paused]">
            {row2.map((story, i) => (
              <CompactTestimonialCard
                key={`row2-${story.id}-${i}`}
                story={story}
                onOpenVideo={setSelectedVideo}
              />
            ))}
          </div>
        </div>
      </div>

      {/* In-App YouTube Embedded Streaming Video Modal (Simple & Elegant without glowing dot) */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-sans">
          <div className="relative w-full max-w-3xl bg-slate-950 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col">
            {/* Top Bar with Candidate Info & Close (Clean & Elegant, no glowing dot) */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 border-b border-slate-800 text-white">
              <div className="flex items-center gap-2 pr-4 overflow-hidden">
                <span className="text-xs sm:text-sm font-semibold text-white/90 truncate">
                  {selectedVideo.name} | {selectedVideo.role} ({selectedVideo.company})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVideo(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                aria-label="Close video"
              >
                <X size={16} />
              </button>
            </div>

            {/* Embedded YouTube Player */}
            <div className="aspect-video w-full bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${selectedVideo.youtube_video_id || "dQw4w9WgXcQ"}?autoplay=1&rel=0`}
                title={`${selectedVideo.name} Interview Story`}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

// Compact Horizontal Rectangle Card (A few pixels bigger, badges on image removed, name on top, rating at bottom-left, untrimmed info with | separator)
function CompactTestimonialCard({
  story,
  onOpenVideo,
}: {
  story: TestimonialItem;
  onOpenVideo: (item: TestimonialItem) => void;
}) {
  const thumb =
    story.thumbnail_url ||
    (story.youtube_video_id
      ? `https://img.youtube.com/vi/${story.youtube_video_id}/hqdefault.jpg`
      : "/asset/trades/warehouse.jpg");

  return (
    <div className="w-[370px] sm:w-[400px] shrink-0 bg-white rounded-2xl border border-[#D9E0EA] p-3.5 sm:p-4 flex gap-3.5 sm:gap-4 hover:border-[#0B5ED7]/40 transition-all duration-150 shadow-xs hover:shadow-md shadow-slate-200/50 group">
      {/* Thumbnail Section (Full-height match, eliminates whitespace underneath) */}
      <div
        onClick={() => onOpenVideo(story)}
        className="relative w-28 sm:w-32 self-stretch min-h-[140px] rounded-xl overflow-hidden bg-slate-900 shrink-0 cursor-pointer group/thumb"
      >
        <img
          src={thumb}
          alt={story.name}
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
          onError={(e) => {
            if (story.youtube_video_id) {
              (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${story.youtube_video_id}/hqdefault.jpg`;
            }
          }}
        />

        {/* Minimalist Play Icon in Center */}
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover/thumb:bg-black/30 transition-colors">
          <div className="w-8 h-8 bg-white/95 text-[#071A4D] rounded-full flex items-center justify-center shadow-md group-hover/thumb:scale-110 transition-transform">
            <Play size={12} fill="currentColor" className="ml-0.5" />
          </div>
        </div>
      </div>

      {/* Info Section: Perfectly balanced, zero extra whitespace */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          {/* Candidate Name */}
          <h4 className="text-[15px] font-bold text-slate-900 leading-snug break-words tracking-tight">
            {story.name}
          </h4>

          {/* Role */}
          <p className="text-xs font-semibold text-slate-800 leading-snug mt-0.5 break-words">
            {story.role}
          </p>

          {/* Company */}
          <p className="text-[11px] text-slate-500 font-medium leading-snug mt-0.5 break-words">
            {story.company}
          </p>

          {/* Candidate Review */}
          {story.review && (
            <p className="text-xs text-slate-700 italic leading-relaxed mt-2 break-words font-normal">
              &ldquo;{story.review}&rdquo;
            </p>
          )}
        </div>

        {/* Star Rating at Bottom Left */}
        <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 mt-2.5">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((starVal) => {
              const currentRating = typeof story.rating === "number" ? story.rating : 5;
              const isFilled = starVal <= Math.round(currentRating);
              return (
                <Star
                  key={starVal}
                  size={14}
                  className={isFilled ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"}
                />
              );
            })}
          </div>
          <span className="text-xs font-bold text-slate-800 ml-0.5">
            {Number(typeof story.rating === "number" ? story.rating : 5).toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
}

// --- Premium Services Banner ---
const PremiumServicesBanner = () => {
  return (
    <section className="px-3 md:px-6 py-6 md:py-10 max-w-7xl mx-auto">
      <div className="bg-white border-2 border-slate-200 rounded-3xl md:rounded-[40px] p-6 md:p-10 flex flex-col md:flex-row items-center gap-6 md:gap-12 relative overflow-hidden shadow-sm">
        {/* Placeholder for Graphic */}
        <div className="w-full md:w-1/3 aspect-video bg-blue-50 rounded-2xl md:rounded-3xl flex items-center justify-center border-2 border-dashed border-blue-200">
          <span className="text-km-primary font-black uppercase tracking-widest text-xs md:text-sm">InstantMilega &amp; ATS</span>
        </div>

        <div className="flex-1 text-center md:text-left">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900 mb-3 md:mb-4">
            Accelerate Your Job Search With Premium Services
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-5 md:mb-8 max-w-xl">
            Services designed to get you hired faster: resume optimization, verified priority applicant status,
            direct recruiter connection, and instant skill certifications!
          </p>

          <div className="flex flex-wrap justify-center md:justify-start gap-2 md:gap-3 mb-5 md:mb-8">
            {['Resume Writing', 'Priority Applicant', 'Resume Display'].map((service) => (
              <button key={service} className="px-4 md:px-5 py-2 border border-slate-200 rounded-full text-[10px] md:text-[11px] font-bold text-gray-700 hover:bg-blue-50 hover:border-blue-200 transition-colors flex items-center gap-2">
                {service} <ChevronRight size={12} className="text-km-primary" />
              </button>
            ))}
          </div>
        </div>

        <Link href="/resources/premium">
          <button className="bg-km-primary hover:bg-km-primary-dark text-white px-6 md:px-8 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-blue-900/15">
            Learn More
          </button>
        </Link>
      </div>
    </section>
  );
};

// --- Popular Questions (Accordion) ---
const defaultFaqs = [
  {
    question: "How does direct HR calling work on KaamMilega?",
    answer: "Unlike traditional job boards where applications get lost, KaamMilega connects you directly with verified employers. Once you submit an application or claim an InstantMilega™ gig, verified HR managers call or WhatsApp you directly to schedule interviews with zero intermediaries."
  },
  {
    question: "Is there any charge or brokerage fee to apply for jobs?",
    answer: "100% Free! KaamMilega strictly enforces a zero-brokerage policy for all jobseekers. You will never be asked to pay any registration fee, interview charge, or placement commission."
  },
  {
    question: "How does Aadhaar and biometric verification help me?",
    answer: "Biometric and Aadhaar verification marks your candidate profile with the official 'Verified Candidate' badge. Employers trust verified applicants 4x more, resulting in priority shortlisting and faster job offers."
  },
  {
    question: "Can I apply for jobs without an English resume?",
    answer: "Yes! KaamMilega is designed for every candidate in India. Simply enter your contact details, language preferences, and trade skills, and our platform automatically generates an ATS-ready digital profile for employers to review."
  },
  {
    question: "What is InstantMilega™ and how fast can I start working?",
    answer: "InstantMilega™ offers on-demand shifts and gig openings across delivery, retail, warehousing, and logistics. Candidates can get onboarded and allocated to local shifts within 15 minutes to 2 hours of application."
  },
  {
    question: "How do I track the status of my submitted applications?",
    answer: "Log into your dashboard and visit 'My Applications' to track your progress in real time—from initial HR review and shortlisting to interview scheduling and offer rollouts."
  }
];

const PopularQuestions = ({ questions }: { questions: any[] }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const displayFaqs = questions && questions.length > 0 ? questions : defaultFaqs;

  return (
    <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto font-sans">
      <div className="bg-white rounded-3xl p-6 sm:p-10 md:p-14 shadow-xs border border-slate-200/90">
        <h2 className="text-center text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight mb-8 sm:mb-12">
          Frequently Asked <span className="text-km-primary">Questions</span>
        </h2>

        <div className="space-y-4">
          {displayFaqs.map((faq, i) => (
            <div key={i} className="border-b border-slate-100 last:border-0 pb-4">
              <button
                type="button"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex justify-between items-center py-4 text-left group cursor-pointer"
              >
                <span className={`text-base font-bold transition-colors ${openIndex === i ? 'text-km-primary' : 'text-slate-800 group-hover:text-km-primary'}`}>
                  {faq.question}
                </span>
                {openIndex === i ? (
                  <ChevronUp className="text-km-primary shrink-0 ml-4" size={20} />
                ) : (
                  <ChevronDown className="text-slate-400 group-hover:text-km-primary shrink-0 ml-4" size={20} />
                )}
              </button>

              {openIndex === i && (
                <div className="pb-4 text-sm sm:text-base text-slate-600 font-medium leading-relaxed animate-in fade-in slide-in-from-top-2 duration-200">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};