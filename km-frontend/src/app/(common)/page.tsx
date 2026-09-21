"use client";
import { useRef, useEffect, useState } from 'react';
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
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ConnectJustLikeYou } from '@/components/network/ConnectJustLikeYou';
import HeroSection from '@/components/home/HeroSection';
import SevenServicesSection from '@/components/home/SevenServicesSection';
import SuccessTicker from '@/components/home/SuccessTicker';
import DefaultAvatar from '@/components/ui/DefaultAvatar';
import InteractiveScrollbar from '@/components/ui/InteractiveScrollbar';
import { getCityHubMetadata, normalizeCitySlug } from '@/lib/constants/hubs';

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
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      if (token) {
        setIsLoggedIn(true);
        if (storedUser) {
          try {
            setCurrentUser(JSON.parse(storedUser));
          } catch (e) {}
        }
      }
    }
  }, []);

  const handleChat = (id: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      toast.info("Please sign in to chat with professionals", { position: "top-center" });
      router.push(`/login?redirect=${encodeURIComponent(`/chat?userId=${id}`)}`);
      return;
    }
    router.push(`/chat?userId=${id}`);
  };

  const handleConnect = async (id: string, name?: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
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
          } catch(e) {}
          
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
          } catch(e) {}
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
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent z-10" />
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
interface EnterprisePartner {
  name: string;
  logo: string;
  openings: string;
  category: string;
  rating: string;
  reviews: string;
  verified: boolean;
  bgClass?: string;
  imgClass?: string;
}

const enterprisePartners: EnterprisePartner[] = [
  {
    name: "Zomato",
    logo: "https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/zomato/default.svg",
    openings: "1,600+ Openings",
    category: "Transport & Delivery Fleet",
    rating: "4.8",
    reviews: "3.7k Reviews",
    verified: true,
    bgClass: "bg-rose-50/80 border-rose-200/70",
    imgClass: "h-5 w-auto max-w-[85%]",
  },
  {
    name: "Swiggy",
    logo: "https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/swiggy/default.svg",
    openings: "3,100+ Openings",
    category: "Dark Store & Quick Commerce",
    rating: "4.7",
    reviews: "5.1k Reviews",
    verified: true,
    bgClass: "bg-orange-50/80 border-orange-200/70",
    imgClass: "h-7 w-auto",
  },
  {
    name: "Uber",
    logo: "https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/uber/default.svg",
    openings: "2,400+ Openings",
    category: "Rideshare & Fleet Logistics",
    rating: "4.7",
    reviews: "6.2k Reviews",
    verified: true,
    bgClass: "bg-slate-950 border-slate-800 shadow-xs",
    imgClass: "h-4 w-auto max-w-[85%]",
  },
  {
    name: "Amazon",
    logo: "https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/amazon/default.svg",
    openings: "4,200+ Openings",
    category: "Fulfillment & Last-Mile Delivery",
    rating: "4.8",
    reviews: "8.5k Reviews",
    verified: true,
    bgClass: "bg-amber-50/60 border-amber-200/70",
    imgClass: "h-5 w-auto max-w-[85%]",
  },
  {
    name: "Airtel",
    logo: "https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/airtel/default.svg",
    openings: "1,850+ Openings",
    category: "Telecom & Field Operations",
    rating: "4.7",
    reviews: "4.3k Reviews",
    verified: true,
    bgClass: "bg-red-50/80 border-red-200/70",
    imgClass: "h-6 w-auto",
  },
  {
    name: "Domino's",
    logo: "https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/dominos/default.svg",
    openings: "2,100+ Openings",
    category: "QSR & Store Operations",
    rating: "4.6",
    reviews: "3.9k Reviews",
    verified: true,
    bgClass: "bg-blue-50/80 border-blue-200/70",
    imgClass: "h-7 w-auto",
  },
];

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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {enterprisePartners.map((co, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/90 shadow-2xs hover:shadow-lg hover:border-blue-500/40 transition-all flex flex-col justify-between group/card"
            >
              <div>
                {/* Header: Vector Logo & Active Badge */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3.5">
                    <div className={`w-14 h-12 rounded-xl border p-2 flex items-center justify-center shrink-0 shadow-2xs ${co.bgClass || 'bg-slate-50 border-slate-200/80'}`}>
                      <img
                        src={co.logo}
                        alt={co.name}
                        className={`object-contain ${co.imgClass || 'max-h-full max-w-full'}`}
                      />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-900 group-hover/card:text-km-primary transition-colors leading-tight">
                        {co.name}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {co.category}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full shrink-0">
                    {co.openings}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-600 my-4 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-1 font-bold text-slate-900">
                    <Star size={14} className="fill-amber-400 text-amber-400" />
                    <span>{co.rating}</span>
                  </div>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-500">{co.reviews}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-km-primary font-semibold">100% Direct HR</span>
                </div>
              </div>

              <Link href={`/jobs?company=${encodeURIComponent(co.name)}`}>
                <button className="w-full py-2.5 bg-slate-50 group-hover/card:bg-km-primary group-hover/card:text-white text-slate-700 border border-slate-200 group-hover/card:border-km-primary rounded-xl text-xs sm:text-sm font-bold transition-all shadow-2xs cursor-pointer">
                  View Verified Jobs →
                </button>
              </Link>
            </div>
          ))}
        </div>

        <div className="text-center mt-8 sm:mt-10">
          <Link href="/jobs">
            <button className="px-8 py-3 border-2 border-km-primary text-km-primary hover:bg-km-primary hover:text-white rounded-xl text-sm font-bold transition-all shadow-2xs">
              View All 5,000+ Enterprise Employers →
            </button>
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
const DiversityBanner = () => (
  <section className="px-3 md:px-6 py-6 md:py-10 max-w-7xl mx-auto">
    <div className="relative min-h-70 md:h-75 rounded-3xl md:rounded-[40px] overflow-hidden flex items-center px-6 md:px-12 text-white py-8 md:py-0">
      <div className="absolute inset-0 bg-linear-to-r from-[#0D1B5E] via-[#1a2b8c] to-[#0A1647] z-10" />

      <div className="relative z-20 max-w-lg">
        <div className="flex items-center gap-2 mb-3 md:mb-4">
          <div className="w-8 h-8 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center">▲</div>
          <span className="text-xs font-bold">KaamMilega™ Verified Partner <Star size={10} className="inline fill-yellow-400 border-none" /> 4.8</span>
        </div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black leading-tight mb-4">
          Diversity And Inclusion At Every Workplace
        </h2>
        <button className="text-sm font-bold underline hover:text-km-accent-light transition-colors">Learn More</button>
      </div>

      <div className="hidden md:flex absolute right-12 z-20 w-72 h-44 bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl items-center justify-center">
        <div className="w-12 h-12 bg-km-accent hover:bg-km-accent-dark rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform shadow-lg shadow-orange-950/30">
          <Play fill="white" size={20} className="ml-1" />
        </div>
      </div>
    </div>
  </section>
);

// --- Video Learning Section ---
const LearnSection = () => {
  const playlist = [
    { title: "How to prepare an interview-winning resume in 5 minutes.", time: "2min 20sec", active: true },
    { title: "Crack your local HR call interview with high confidence.", time: "2min 22sec", active: false },
    { title: "Salary negotiation secrets for freshers and experienced staff.", time: "2min 36sec", active: false },
  ];

  return (
    <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto font-sans">
      <h2 className="text-center text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight mb-8 sm:mb-12 flex items-center justify-center flex-wrap gap-2.5">
        <span>Learn With</span>
        <img
          src="/kaammilega-logo-text.png"
          alt="KaamMilega"
          className="h-7 sm:h-8 md:h-9 w-auto inline-block object-contain"
        />
      </h2>
      <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
        {/* Main Video Player */}
        <div className="w-full md:flex-1 aspect-video bg-[#0D1B5E] rounded-3xl md:rounded-[40px] flex items-center justify-center relative group cursor-pointer overflow-hidden shadow-md">
          <Play size={50} className="text-white opacity-80 group-hover:scale-110 transition-transform" />
        </div>

        {/* Playlist */}
        <div className="w-full md:w-100 space-y-3 md:space-y-4">
          {playlist.map((video, i) => (
            <div
              key={i}
              className={`p-3 md:p-4 rounded-2xl md:rounded-3xl border transition-all cursor-pointer ${video.active ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100 hover:bg-gray-50'
                }`}
            >
              <div className="flex gap-3 md:gap-4">
                <div className={`w-16 md:w-20 h-10 md:h-12 rounded-lg md:rounded-xl shrink-0 flex items-center justify-center ${video.active ? 'bg-km-primary' : 'bg-gray-200'}`}>
                  <Play size={14} className="text-white" fill="white" />
                </div>
                <div>
                  <h4 className="text-[12px] md:text-[13px] font-bold text-gray-800 leading-tight mb-1">{video.title}</h4>
                  <p className="text-[10px] text-gray-400 font-medium">{video.time}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// --- Expert Slider Section ---
const ExpertSlider = ({
  experts,
  pendingIds = [],
  onChat,
  onFollow,
}: {
  experts: any[];
  pendingIds?: string[];
  onChat: (id: string) => void;
  onFollow: (id: string, name?: string) => void;
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
          {experts.map((expert, i) => (
            <div 
              key={expert.id || expert._id || i} 
              className="w-65 bg-white rounded-3xl p-6 flex flex-col items-center shrink-0 border border-slate-200/90 shadow-xs hover:shadow-md transition-all text-center"
            >
              <div className="relative mb-4">
                <div className="w-18 h-18 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center overflow-hidden shadow-2xs">
                  {expert.profile_image ? (
                    <img src={expert.profile_image} alt={expert.name} className="w-full h-full object-cover" />
                  ) : (
                    <DefaultAvatar />
                  )}
                </div>
                <div className="absolute bottom-0 right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white" />
              </div>
              
              <h3 className="text-sm font-bold text-slate-900 leading-tight mb-0.5 text-center">
                {expert.name?.replace(/\s*\.+$/, '') || 'Career Expert'}
              </h3>
              <p className="text-[11px] text-slate-500 mb-2 font-medium text-center line-clamp-1">
                {expert.headline || (expert as any).job_categories?.[0] ? `${(expert as any).job_categories[0]} Specialist` : 'Career & Trade Mentor'}
              </p>
              
              <div className="flex items-center gap-1 text-slate-400 text-[10px] mb-2 font-semibold">
                <MapPin size={10} className="text-km-primary" />
                <span>{expert.city || 'India'}</span>
              </div>
              
              <p className="text-[10px] text-slate-400 mb-4 font-bold uppercase tracking-wider">
                {expert.rating ? `${expert.rating} ★ Mentor` : 'Verified Expert'}
              </p>
              
              <div className="w-full flex gap-2 mt-auto flex-col">
                {(() => {
                  const storedUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
                  let currentUserId = '';
                  if (storedUser) {
                    try {
                      const parsed = JSON.parse(storedUser);
                      currentUserId = parsed.id || parsed._id;
                    } catch (e) {}
                  }
                  const expertId = expert.id || expert._id || '';
                  const isSelf = (expertId && expertId === currentUserId);
                  const isPending = pendingIds.includes(expertId);
                  
                  return !isSelf && (
                    <>
                      <button 
                        onClick={() => onChat(expertId)}
                        className="w-full py-2 rounded-xl border border-km-primary text-km-primary text-xs font-bold flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors cursor-pointer"
                      >
                        <MessageCircle size={14} />
                        Chat
                      </button>
                      {isPending ? (
                        <button 
                          disabled
                          className="w-full py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-default border border-slate-200"
                        >
                          <CheckCircle size={13} className="text-emerald-500" />
                          Pending
                        </button>
                      ) : (
                        <button 
                          onClick={() => onFollow(expertId, expert.name)}
                          className="w-full py-2 bg-km-primary hover:bg-km-primary-dark text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                        >
                          Follow
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          ))}
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
                      <div className="w-full h-full bg-[#0D1B5E] flex items-center justify-center relative overflow-hidden">
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

// --- Success Stories & Stationary Video Testimonials ---
interface VideoStory {
  id: string;
  name: string;
  role: string;
  company: string;
  city: string;
  tradeTag: string;
  rating: number;
  salaryHike: string;
  avatar: string;
  story: string;
  interviewNote: string;
}

const verifiedStories: VideoStory[] = [
  {
    id: "story-1",
    name: "Dharmender Kumar",
    role: "Warehouse Operations Supervisor",
    company: "Technova Logistics",
    city: "Bhiwandi, Thane",
    tradeTag: "Logistics & Warehousing",
    rating: 5,
    salaryHike: "+35% Hike",
    avatar: "/asset/trades/warehouse.jpg",
    story: "Applied on KaamMilega and received a direct video interview call from HR within 2 hours. Zero brokerage paid, formal offer received on platform.",
    interviewNote: "Direct interview scheduled via KaamMilega portal. Onboarding completed in 48 hours.",
  },
  {
    id: "story-2",
    name: "Sachin Singh",
    role: "Heavy Commercial Driver",
    company: "City Fleet Transport",
    city: "Surat, Gujarat",
    tradeTag: "Commercial Transport",
    rating: 5,
    salaryHike: "₹28,000/mo",
    avatar: "/asset/trades/driver.jpg",
    story: "Commercial driving license and background verification took just one day. Placed with fixed monthly salary and timely fuel allowances.",
    interviewNote: "Verified driving badge issued. Placed in interstate commercial logistics route.",
  },
  {
    id: "story-3",
    name: "Pooja Verma",
    role: "Retail Store Executive",
    company: "Tata Croma",
    city: "Mumbai, Maharashtra",
    tradeTag: "Retail & Customer Ops",
    rating: 5,
    salaryHike: "+28% Hike",
    avatar: "/asset/trades/office-executive.jpg",
    story: "The direct HR chat feature saved me weeks of agency hassle. Scheduled interview directly with the hiring manager without middleman fees.",
    interviewNote: "Selected after direct HR interview on KaamMilega video portal. Full benefits included.",
  },
  {
    id: "story-4",
    name: "Raju Yadav",
    role: "Certified Industrial Electrician",
    company: "InstantMilega™ Partner",
    city: "Delhi NCR",
    tradeTag: "Technical Services",
    rating: 5,
    salaryHike: "₹1,500/day",
    avatar: "/asset/trades/electrician.jpg",
    story: "With InstantMilega hourly dispatch, I get 2-3 emergency commercial trade calls daily. Wallet earnings transfer automatically to bank every evening.",
    interviewNote: "Aadhaar and trade-certified technician with 100% completed job record.",
  },
];

const TestimonialsSection = () => {
  const [selectedVideo, setSelectedVideo] = useState<VideoStory | null>(null);

  return (
    <section className="py-12 sm:py-16 bg-slate-50/70 border-b border-slate-200/80 overflow-hidden font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
            Verified Stories from <span className="text-km-primary">Real Candidates</span>
          </h2>
          <p className="mt-2.5 sm:mt-3 text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Real workers across logistics, transportation, and technical trades hired with zero brokerage and direct HR calls.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {verifiedStories.map((story) => (
            <div
              key={story.id}
              onClick={() => setSelectedVideo(story)}
              className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-2xs hover:shadow-lg hover:border-blue-500/40 transition-all cursor-pointer group/card flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start gap-4 sm:gap-5 mb-5">
                  {/* Avatar with Play Overlay */}
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shrink-0 border border-slate-200 shadow-xs">
                    <Image
                      src={story.avatar}
                      alt={story.name}
                      fill
                      sizes="80px"
                      className="object-cover object-top group-hover/card:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center group-hover/card:bg-slate-950/25 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-white/90 text-km-primary flex items-center justify-center shadow-xs group-hover/card:scale-110 transition-transform">
                        <Play size={14} className="fill-km-primary translate-x-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Candidate Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-base sm:text-lg text-slate-900 group-hover/card:text-km-primary transition-colors truncate">
                        {story.name}
                      </h4>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-md shrink-0">
                        {story.salaryHike}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-slate-700 mt-0.5 truncate">
                      {story.role}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {story.company} • {story.city}
                    </p>
                    <div className="flex items-center gap-1 mt-2">
                      {[...Array(story.rating)].map((_, idx) => (
                        <Star key={idx} size={13} className="fill-amber-400 text-amber-400" />
                      ))}
                      <span className="text-xs font-bold text-slate-700 ml-1.5">5.0</span>
                      <span className="text-xs text-slate-400 ml-1">• Verified Hire</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed italic bg-slate-50 p-4 rounded-xl border border-slate-100">
                  &ldquo;{story.story}&rdquo;
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">
                  {story.tradeTag}
                </span>
                <span className="inline-flex items-center gap-1.5 font-bold text-km-primary group-hover/card:underline">
                  <Play size={12} className="fill-km-primary" /> Watch Interview Story
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stationary Video Modal */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs font-sans">
          <div className="relative w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200">
            {/* Close button */}
            <button
              type="button"
              onClick={() => setSelectedVideo(null)}
              className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-slate-900/60 hover:bg-slate-900 text-white flex items-center justify-center transition-colors"
              aria-label="Close story"
            >
              <X size={18} />
            </button>

            {/* Video Placeholder Container with Candidate Portrait */}
            <div className="relative h-64 sm:h-72 w-full bg-slate-950 flex items-center justify-center overflow-hidden">
              <Image
                src={selectedVideo.avatar}
                alt={selectedVideo.name}
                fill
                className="object-cover opacity-70"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
              
              <div className="relative z-10 text-center text-white px-6">
                <div className="w-16 h-16 rounded-full bg-km-primary/90 text-white flex items-center justify-center mx-auto mb-3 shadow-lg ring-4 ring-white/30">
                  <Play size={24} className="fill-white translate-x-0.5" />
                </div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Candidate Video Testimonial
                </p>
                <h3 className="text-lg sm:text-xl font-black mt-1">
                  {selectedVideo.name}
                </h3>
                <p className="text-xs text-slate-300">
                  {selectedVideo.role} at {selectedVideo.company}
                </p>
              </div>
            </div>

            {/* Video Details & Verified Status */}
            <div className="p-6 sm:p-7">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-emerald-600" />
                  <span className="text-xs font-bold text-slate-900">
                    Aadhaar &amp; Skill Verified Placement
                  </span>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md">
                  {selectedVideo.salaryHike}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed italic mb-5">
                &ldquo;{selectedVideo.story}&rdquo;
              </p>

              <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100 mb-6">
                <strong className="text-slate-700">Placement Record:</strong> {selectedVideo.interviewNote}
              </p>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedVideo(null)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  Close
                </button>
                <Link href="/jobs">
                  <button className="px-6 py-2.5 bg-km-primary hover:bg-km-primary-dark text-white rounded-xl text-xs font-bold transition-colors shadow-xs">
                    Apply for Similar Roles →
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

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