"use client";
import { useRef, useEffect, useState, useMemo, useId } from 'react';
import { motion } from 'framer-motion';
import { ArrowRightIcon, ArrowUpRightIcon, BookOpenIcon, BookOpenTextIcon, BriefcaseIcon, CertificateIcon, ExamIcon, GenderFemaleIcon, HouseLineIcon, NotebookIcon, PlantIcon, StudentIcon, BuildingsIcon, CalendarBlankIcon, CaretDownIcon, CaretRightIcon, CaretUpIcon, ClockIcon, GraduationCapIcon, HouseIcon, LightningIcon, MedalIcon, PhoneCallIcon, PlayIcon, ScrollIcon, SealCheckIcon, ShieldCheckIcon, StarIcon, UserIcon, UsersIcon, WalletIcon, XIcon } from '@phosphor-icons/react';

import Link from 'next/link';
import Image from 'next/image';
import api from '@/lib/axios';
import { useRouter } from 'next/navigation';
import { isAuthenticated, getCurrentPortalRole } from '@/lib/auth';
import { notify } from "@/lib/notify";
import { ConnectJustLikeYou } from '@/components/network/ConnectJustLikeYou';
import HeroSection from '@/components/home/HeroSection';
import SevenServicesSection from '@/components/home/SevenServicesSection';
import SuccessTicker from '@/components/home/SuccessTicker';
import UserAvatar from '@/components/ui/UserAvatar';
import { companiesFromApi, type HiringCompany } from '@/lib/constants/companies';
import CompanyCard from '@/components/company/CompanyCard';
import ProfileConnectionCard from '@/components/network/ProfileConnectionCard';
import InteractiveScrollbar from '@/components/ui/InteractiveScrollbar';
import { getCityHubMetadata, normalizeCitySlug } from '@/lib/constants/hubs';
import { ImpressionWrapper } from '@/lib/telemetry';
import CandidateProgressCard from '@/components/dashboard/CandidateProgressCard';
import { useUniformMarqueeSpeed } from '@/lib/useUniformMarqueeSpeed';
import SectionHeader from '@/components/home/SectionHeader';
import ProfileBoostArt from '@/components/home/illustrations/ProfileBoostArt';
import {
  BelowTenthArt, TenthPassArt, TwelfthPassArt, DiplomaItiArt, GraduateArt, PostGraduateArt,
  WorkFromHomeArt, PartTimeArt, FullTimeArt, FresherArt, WomenJobsArt,
} from '@/components/home/illustrations/CategoryArt';
import { getYouTubeMaxResThumbnail, extractYouTubeVideoId } from '@/lib/youtube';

export default function LandingPage() {
  const router = useRouter();
  useUniformMarqueeSpeed();
  const [cities, setCities] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  // Registered employers with their live job counts (GET /companies/top)
  const [topCompanies, setTopCompanies] = useState<HiringCompany[]>([]);
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

  useEffect(() => {
    let alive = true;
    api.get('/companies/top?limit=6')
      .then((res) => alive && setTopCompanies(companiesFromApi(res)))
      .catch(() => alive && setTopCompanies([]));
    return () => {
      alive = false;
    };
  }, []);
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
      notify.info("Please sign in to chat with professionals");
      router.push(`/login?redirect=${encodeURIComponent(`/chat?userId=${id}`)}`);
      return;
    }
    router.push(`/chat?userId=${id}`);
  };

  const handleConnect = async (id: string, name?: string) => {
    if (!isAuthenticated()) {
      notify.info("Please sign in to connect with professionals");
      router.push('/login?redirect=/');
      return;
    }

    try {
      await api.post('/network/connect', { receiver_id: id });
      notify.success(`Invitation sent to ${name || 'member'}!`);
      setPendingConnectIds(prev => [...prev, id]);
    } catch (e: any) {
      const msg = e.message || '';
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('pending') || msg.toLowerCase().includes('duplicate')) {
        notify.info("Invitation already sent.");
        setPendingConnectIds(prev => [...prev, id]);
      } else {
        notify.error(msg || "Could not send invitation. Please try again.");
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
    <main className="min-h-screen font-sans antialiased">
      <HeroSection cities={cities} stats={stats} />
      <SuccessTicker />
      {isLoggedIn && currentUser && !['recruiter', 'admin'].includes(getCurrentPortalRole()) && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 pt-6 pb-2">
          <CandidateProgressCard userName={currentUser?.name} />
        </section>
      )}
      <SevenServicesSection />
      <LocationSection cities={cities} />
      <TrustCard isLoggedIn={isLoggedIn} user={currentUser} />
      <JobRolesGrid skills={skills} />
      {users.length > 0 && (
        <ConnectJustLikeYou
          users={users}
          pendingIds={pendingConnectIds}
          connectedIds={connectedIds}
          onChat={handleChat}
          onFollow={handleConnect}
        />
      )}
      <FeaturedCompanies companies={topCompanies} />
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

// Shared vertical rhythm and container for every home section
const SECTION = 'py-8 sm:py-10 lg:py-12';
const CONTAINER = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8';

const LocationSection = ({ cities }: { cities: any[] }) => {
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

  return (
    <section className={SECTION} aria-labelledby="hubs-title">
      <div className={CONTAINER}>
        <SectionHeader
          id="hubs-title"
          title="Find jobs by top hubs"
          description="Explore verified openings and on-demand gig clusters across India's largest employment districts."
        />

        <div className="bg-km-surface-card rounded-3xl border border-km-border p-4 sm:p-6 lg:p-8">
          {/* Auto-scrolling row of city cards (pauses on hover/touch) */}
          <div className="overflow-hidden">
            <div className="animate-km-marquee hover:[animation-play-state:paused] active:[animation-play-state:paused] py-1">
              {[...displayFeatured, ...displayFeatured].map((hub, idx) => (
                <Link
                  key={`${hub.name}-${idx}`}
                  href={`/jobs?city=${encodeURIComponent(hub.id || hub.name)}`}
                  aria-hidden={idx >= displayFeatured.length || undefined}
                  tabIndex={idx >= displayFeatured.length ? -1 : undefined}
                  className="shrink-0 mr-5 w-56 sm:w-64 bg-km-surface-card rounded-2xl border border-km-border overflow-hidden group/card hover:border-[#0B5ED7]/40 hover:shadow-md transition-all"
                >
                  <div className="relative h-32 sm:h-36 overflow-hidden bg-[#0B1F52] dark:bg-km-primary-dark">
                    <img
                      src={hub.image}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-[#071A4D]/70 via-transparent to-transparent pointer-events-none" />
                    {hub.landmark && (
                      <span className="absolute bottom-2.5 left-3 right-3 text-xs font-medium text-white truncate">
                        {hub.landmark}
                      </span>
                    )}
                  </div>
                  <div className="p-4 text-center">
                    <h3 className="text-base sm:text-lg font-semibold text-km-text-primary group-hover/card:text-km-heading transition-colors">
                      {hub.name}
                    </h3>
                    <p className="mt-0.5 text-sm text-km-text-secondary">{hub.vacancies}</p>
                    <p className="mt-3 pt-3 border-t border-km-border-subtle text-xs text-km-text-secondary truncate">{hub.sector}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* More employment hubs */}
          {displayOther.length > 0 && (
            <div className="mt-6 pt-6 border-t border-km-border-subtle">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h3 className="text-sm font-semibold text-km-text-primary">
                  More employment hubs and regional zones ({displayOther.length})
                </h3>
                <Link href="/jobs" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-km-heading hover:text-km-blue transition-colors shrink-0">
                  View all locations
                  <ArrowRightIcon size={16} weight="bold" className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </div>
              <div className="flex flex-wrap gap-2">
                {displayOther.map((hub) => (
                  <Link
                    key={hub.id || hub.name}
                    href={`/jobs?city=${encodeURIComponent(hub.id || hub.name)}`}
                    className="px-3.5 py-1.5 rounded-full bg-km-surface border border-km-border-subtle text-sm text-km-text-primary hover:border-[#0B5ED7]/40 hover:text-km-heading transition-colors"
                  >
                    {hub.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

const TRUST_FEATURES = [
  { Icon: PhoneCallIcon, title: "Direct contact", desc: "Call or chat with employers directly" },
  { Icon: ShieldCheckIcon, title: "Verified profiles", desc: "Identity and credential checks" },
  { Icon: LightningIcon, title: "Instant Milega™", desc: "On-demand local work in minutes" },
  { Icon: BriefcaseIcon, title: "Local jobs", desc: "Roles matched to your city and skills" },
  { Icon: WalletIcon, title: "Digital wallet", desc: "Transparent earnings and payouts" },
];

const TrustCard = ({ isLoggedIn, user }: { isLoggedIn?: boolean; user?: any }) => (
  <section className={SECTION} aria-label="Why KaamMilega">
    <div className={CONTAINER}>
      <div className="relative overflow-hidden rounded-3xl bg-[#071A4D] text-white dark:ring-1 dark:ring-inset dark:ring-white/10">
        {/* Soft grid texture, fading towards the copy */}
        <svg className="absolute inset-0 h-full w-full text-white/[0.06] [mask-image:linear-gradient(to_left,#000,transparent_70%)]" aria-hidden="true">
          <defs>
            <pattern id="km-trust-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M32 0H0v32" fill="none" stroke="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#km-trust-grid)" />
        </svg>

        <div className="relative p-8 sm:p-10 lg:p-12">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-[#FF8A00]">
                {isLoggedIn ? "Your candidate hub" : "Verified platform"}
              </p>
              <h2 className="mt-2 text-2xl sm:text-[28px] lg:text-[32px] font-bold tracking-[-0.02em] leading-tight">
                {isLoggedIn
                  ? `Welcome back, ${user?.name || "there"}`
                  : "Direct hiring connections for verified employers and candidates"}
              </h2>
              <p className="mt-3 text-[15px] sm:text-base text-white/75 leading-relaxed">
                {isLoggedIn
                  ? "Connect directly with hiring managers, track your applications, and discover local on-demand work."
                  : "Discover vacancies, talk to hiring managers directly, and find on-demand work across India."}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Link
                href={isLoggedIn ? "/jobs" : "/register"}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-km-accent hover:bg-km-accent-light text-white text-sm font-semibold transition-colors"
              >
                {isLoggedIn ? "Explore matched jobs" : "Register free"}
                <ArrowRightIcon size={16} weight="bold" aria-hidden="true" />
              </Link>
              <Link
                href={isLoggedIn ? "/applications" : "/jobs"}
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-white/25 hover:bg-white/10 text-white text-sm font-semibold transition-colors"
              >
                {isLoggedIn ? "My applications" : "Browse openings"}
              </Link>
            </div>
          </div>

          <ul className="mt-10 pt-8 border-t border-white/10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-6">
            {TRUST_FEATURES.map(({ Icon, title, desc }) => (
              <li key={title} className="flex items-start gap-3">
                <Icon size={24} weight="duotone" className="text-[#8DB8F5] shrink-0 -mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="mt-0.5 text-xs text-white/65 leading-relaxed">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </section>
);

// --- Real open-job counts (GET /jobs?…&limit=1 returns the matching `total`) ---
// Category cards show these instead of invented totals; while loading, or with no matches,
// they say "Browse jobs".
function useJobCounts(queries: string[]): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const key = queries.join("\n");
  useEffect(() => {
    let alive = true;
    Promise.all(
      key.split("\n").map((q) =>
        api
          .get(`/jobs?limit=1&${q}`)
          .then((res) => {
            const total = (res as unknown as { total?: unknown })?.total;
            return [q, typeof total === "number" ? total : 0] as const;
          })
          .catch(() => [q, 0] as const),
      ),
    ).then((entries) => alive && setCounts(Object.fromEntries(entries)));
    return () => {
      alive = false;
    };
  }, [key]);
  return counts;
}

const openingsLabel = (n?: number) =>
  n && n > 0 ? `${n.toLocaleString("en-IN")} open ${n === 1 ? "job" : "jobs"}` : "Browse jobs";

// --- Job Roles Grid ---
// `count` is a precise search (regex) for counting; `keywords` match catalogue skill names
const JobRolesGrid = ({ skills = [] }: { skills?: any[] }) => {
  const popularTradeConfig = [
    { title: "Delivery Executive", img: "/asset/trades/delivery.jpg", count: "delivery|courier", keywords: ["delivery", "courier", "rider"] },
    { title: "Commercial Vehicle Driver", img: "/asset/trades/driver.jpg", count: "driver", keywords: ["driver", "commercial", "truck"] },
    { title: "Warehouse Associate", img: "/asset/trades/warehouse.jpg", count: "warehouse", keywords: ["warehouse", "logistics", "inventory"] },
    { title: "Electrician", img: "/asset/trades/electrician.jpg", count: "electrician", keywords: ["electrician"] },
    { title: "Security Guard", img: "/asset/trades/security.jpg", count: "security guard|security officer", keywords: ["security", "guard"] },
    { title: "Plumber", img: "/asset/trades/plumber.jpg", count: "plumber", keywords: ["plumber"] },
    { title: "Painter & Decorator", img: "/asset/trades/painter.jpg", count: "painter", keywords: ["painter"] },
    { title: "AC & HVAC Technician", img: "/asset/trades/ac.jpg", count: "hvac|air condition", keywords: ["ac", "hvac", "technician"] },
    { title: "Housekeeping & Helper", img: "/asset/trades/labour.jpg", count: "housekeeping|helper", keywords: ["housekeeping", "helper", "peon", "labour"] },
    { title: "Office Assistant & DEO", img: "/asset/trades/office-executive.jpg", count: "office assistant|data entry", keywords: ["office", "data entry", "deo", "assistant"] },
  ];

  const counts = useJobCounts(popularTradeConfig.map((t) => `search=${encodeURIComponent(t.count)}`));

  // Match each trade with real DB skills where available
  const displayRoles = popularTradeConfig.map((item) => {
    const matchedSkill = skills?.find((s: any) =>
      item.keywords.some(kw => (s.name || '').toLowerCase().includes(kw))
    );
    return {
      title: matchedSkill?.name || item.title,
      img: item.img,
      vacancies: openingsLabel(counts[`search=${encodeURIComponent(item.count)}`]),
    };
  });

  return (
    <section className={`${SECTION} px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto font-sans`}>
      <SectionHeader
        title="Explore popular job categories"
        description="Verified openings across logistics, technical trades, facility management, and retail."
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-6">
        {displayRoles.map((role, i) => (
          <Link key={i} href={`/jobs?role=${encodeURIComponent(role.title)}`}>
            <div className="km-on-dark relative h-48 sm:h-56 rounded-2xl overflow-hidden group cursor-pointer border border-slate-200/90 shadow-2xs hover:shadow-lg transition-all duration-300">
              <Image
                src={role.img}
                alt={role.title}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                className="object-cover object-top"
              />
              <div className="absolute inset-0 bg-linear-to-t from-[#020617]/90 via-[#020617]/30 to-transparent z-10" />
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
        <Link
          href="/jobs"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-km-primary text-km-heading hover:bg-km-primary hover:text-white text-sm font-semibold transition-colors"
        >
          View all job categories
          <ArrowRightIcon size={16} weight="bold" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
};

// --- Featured Companies Grid ---
// Real employers only; the section is hidden until there are some
const FeaturedCompanies = ({ companies }: { companies: HiringCompany[] }) => {
  if (companies.length === 0) return null;
  return (
    <section className={SECTION} aria-labelledby="companies-title">
      <div className={CONTAINER}>
        <SectionHeader
          id="companies-title"
          title="Featured companies actively hiring"
          description="Employers hiring on KaamMilega."
          action={{ href: '/jobs', label: 'View all jobs' }}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {companies.map((co, i) => (
            <CompanyCard key={co.name || i} company={co} variant="expanded" />
          ))}
        </div>
      </div>
    </section>
  );
};

// --- Job Search by Qualification ---
const QUALIFICATIONS = [
  { label: "Below 10th", education: "below 10th", Art: BelowTenthArt },
  { label: "10th Pass", education: "10th", Art: TenthPassArt },
  { label: "12th Pass", education: "12th", Art: TwelfthPassArt },
  { label: "Diploma / ITI", education: "diploma|iti", Art: DiplomaItiArt },
  { label: "Graduate", education: "^graduation", Art: GraduateArt },
  { label: "Post Graduate", education: "post graduation", Art: PostGraduateArt },
];

const QualificationSearch = () => {
  // `education` is matched against the education a recruiter sets on the job
  const counts = useJobCounts(QUALIFICATIONS.map((q) => `education=${encodeURIComponent(q.education)}`));
  return (
  <section className={SECTION} aria-labelledby="qualification-title">
    <div className={CONTAINER}>
      <SectionHeader
        id="qualification-title"
        title="Search jobs based on your qualification"
        description="Find roles matched to your education and vocational background."
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {QUALIFICATIONS.map(({ label, education, Art }) => (
          <Link
            key={label}
            href={`/jobs?qualification=${encodeURIComponent(label)}`}
            className="group/card bg-km-surface-card rounded-2xl border border-km-border p-5 hover:border-[#0B5ED7]/40 hover:shadow-md transition-all"
          >
            <Art className="h-16 w-auto -ml-3" />
            <h3 className="mt-4 text-base font-semibold text-km-text-primary group-hover/card:text-km-heading transition-colors">
              {label}
            </h3>
            <p className="mt-0.5 text-sm text-km-text-secondary">
              {openingsLabel(counts[`education=${encodeURIComponent(education)}`])}
            </p>
          </Link>
        ))}
      </div>
    </div>
  </section>
  );
};

// --- Job Type Selection ---
const JOB_TYPES = [
  { label: "Work From Home", desc: "Remote roles you can do from home", Art: WorkFromHomeArt },
  { label: "Part Time", desc: "Flexible hours alongside study or work", Art: PartTimeArt },
  { label: "Full Time", desc: "Stable roles with monthly salary", Art: FullTimeArt },
  { label: "Fresher Jobs", desc: "No experience needed to apply", Art: FresherArt },
  { label: "Jobs For Women", desc: "Women-friendly employers and shifts", Art: WomenJobsArt },
];

const JobTypeSection = () => (
  <section className={SECTION} aria-labelledby="jobtype-title">
    <div className={CONTAINER}>
      <SectionHeader
        id="jobtype-title"
        title="What type of job do you want?"
        description="Pick the way you want to work and see matching openings."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {JOB_TYPES.map(({ label, desc, Art }) => (
          <Link
            key={label}
            href={`/jobs?job_type=${encodeURIComponent(label)}`}
            className="group/card flex lg:flex-col items-start gap-4 lg:gap-0 bg-km-surface-card rounded-2xl border border-km-border p-5 hover:border-[#0B5ED7]/40 hover:shadow-md transition-all"
          >
            <Art className="h-14 lg:h-16 w-auto shrink-0 -ml-3" />
            <div className="lg:mt-4 min-w-0">
              <h3 className="flex items-center gap-1 text-base font-semibold text-km-text-primary group-hover/card:text-km-heading transition-colors">
                {label}
                <CaretRightIcon size={14} weight="bold" className="opacity-0 -translate-x-1 group-hover/card:opacity-100 group-hover/card:translate-x-0 transition-all" aria-hidden="true" />
              </h3>
              <p className="mt-0.5 text-sm text-km-text-secondary leading-relaxed">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  </section>
);


// --- About KaamMilega banner (headline + learn more + intro video) ---
// YouTube video ID of the KaamMilega intro video. Leave empty until the client shares the link.
const KAAMMILEGA_INTRO_VIDEO_ID = '';

const DiversityBanner = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const hasVideo = KAAMMILEGA_INTRO_VIDEO_ID.length > 0;

  const learnMoreClass =
    "mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-km-surface-card text-km-heading hover:bg-km-surface text-sm font-semibold transition-colors cursor-pointer";

  return (
    <section className={SECTION} aria-labelledby="about-km-title">
      <div className={CONTAINER}>
        <div className="relative overflow-hidden rounded-3xl bg-[#071A4D] text-white dark:ring-1 dark:ring-inset dark:ring-white/10">
          {/* Same soft grid texture as the "Direct hiring" card */}
          <svg className="absolute inset-0 h-full w-full text-white/[0.06] [mask-image:linear-gradient(to_left,#000,transparent_75%)]" aria-hidden="true">
            <defs>
              <pattern id="km-about-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M32 0H0v32" fill="none" stroke="currentColor" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#km-about-grid)" />
          </svg>

          <div className="relative grid lg:grid-cols-2 items-center gap-8 lg:gap-12 p-6 sm:p-8 lg:p-10">
            <div className="max-w-lg text-center lg:text-left mx-auto lg:mx-0">
              <p className="text-sm font-medium text-[#FF8A00]">About KaamMilega</p>
              <h2 id="about-km-title" className="mt-2 text-2xl sm:text-[28px] lg:text-[32px] font-bold tracking-[-0.02em] leading-tight">
                Diversity and inclusion at every workplace
              </h2>
              <p className="mt-3 text-[15px] sm:text-base text-white/75 leading-relaxed">
                See how KaamMilega connects workers, employers and experts directly and fairly.
              </p>
              {hasVideo ? (
                <button type="button" onClick={() => setIsPlaying(true)} className={learnMoreClass}>
                  Learn more
                  <ArrowRightIcon size={16} weight="bold" aria-hidden="true" />
                </button>
              ) : (
                <Link href="/about" className={learnMoreClass}>
                  Learn more
                  <ArrowRightIcon size={16} weight="bold" aria-hidden="true" />
                </Link>
              )}
            </div>

            {/* Intro video card */}
            <button
              type="button"
              onClick={() => hasVideo && setIsPlaying(true)}
              disabled={!hasVideo}
              aria-label={hasVideo ? 'Play KaamMilega introduction video' : 'KaamMilega introduction video coming soon'}
              className="group relative w-full max-w-md mx-auto lg:ml-auto lg:mr-0 aspect-video rounded-2xl overflow-hidden bg-km-surface-card enabled:cursor-pointer"
            >
              {hasVideo ? (
                <>
                  <img
                    src={`https://img.youtube.com/vi/${KAAMMILEGA_INTRO_VIDEO_ID}/hqdefault.jpg`}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <span className="absolute inset-0 bg-[#071A4D]/25 group-hover:bg-[#071A4D]/40 transition-colors dark:bg-km-primary dark:group-hover:bg-km-primary" />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="w-16 h-16 rounded-full bg-km-surface-card text-km-heading flex items-center justify-center shadow-lg">
                      <PlayIcon size={26} weight="fill" className="ml-1" aria-hidden="true" />
                    </span>
                  </span>
                </>
              ) : (
                /* Branded poster until the real video is added */
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[radial-gradient(#E3E9F1_1px,transparent_1px)] [background-size:16px_16px]">
                  <img src="/kaammilega-logo-text.png" alt="" className="h-7 sm:h-8 w-auto dark:hidden" />
                  <img src="/kaammilega-logo-text-dark.png" alt="" className="h-7 sm:h-8 w-auto hidden dark:block" />
                  <span className="w-14 h-14 rounded-full bg-[#071A4D] text-white flex items-center justify-center dark:bg-km-primary">
                    <PlayIcon size={24} weight="fill" className="ml-0.5" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-medium text-km-text-secondary">Video coming soon</span>
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {isPlaying && hasVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#071A4D]/80 dark:bg-km-primary"
          onClick={() => setIsPlaying(false)}
        >
          <div className="relative w-full max-w-3xl rounded-2xl overflow-hidden bg-black" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setIsPlaying(false)}
              aria-label="Close video"
              className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer"
            >
              <XIcon size={18} weight="bold" aria-hidden="true" />
            </button>
            <div className="aspect-video">
              <iframe
                src={`https://www.youtube.com/embed/${KAAMMILEGA_INTRO_VIDEO_ID}?autoplay=1&rel=0`}
                title="KaamMilega introduction"
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
            // The course's own video only; giving it an unrelated default video would play the
            // wrong content under this course's title
            const videoId =
              item.youtube_video_id ||
              extractYouTubeVideoId(item.youtube_url || "") ||
              "";

            // Prefer a custom thumbnail, then the true 16:9 maxresdefault over the 4:3 letterboxed hqdefault
            const thumb =
              (item.thumbnail_url && !item.thumbnail_url.includes("hqdefault.jpg") ? item.thumbnail_url : "") ||
              (videoId ? getYouTubeMaxResThumbnail(videoId) : "") ||
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

          // Real courses only; not padded with unrelated default videos
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
    <section className={`${SECTION} px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto font-sans`}>
      <SectionHeader
        title={
          <>
            Learn with{' '}
            {/* Logo sized to the heading's cap height; its artwork baseline sits at ~72% of the image, so drop it to the text baseline */}
            <img
              src="/kaammilega-logo-text.png"
              alt="KaamMilega"
              className="inline-block h-[1.05em] w-auto align-baseline relative top-[0.29em] dark:hidden"
            />
            <img
              src="/kaammilega-logo-text-dark.png"
              alt="KaamMilega"
              className="hidden dark:inline-block h-[1.05em] w-auto align-baseline relative top-[0.29em]"
            />
          </>
        }
      />

      <div
        className="flex flex-col md:flex-row gap-6 
        md:gap-8 items-stretch"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Main Video (Left Side): thumbnail with a centred play button, opens Resources */}
        <Link
          href="/resources"
          className="block w-full md:flex-1 aspect-video bg-km-ink rounded-2xl relative group cursor-pointer overflow-hidden border border-km-border"
          title={`Explore courses: ${activeVideo.title}`}
        >
          {/* Main Thumbnail synced with active card (absolute background) */}
          <img
            key={activeVideo.id || activeVideo.thumbnail}
            src={activeVideo.thumbnail}
            alt={activeVideo.title}
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover"
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
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-km-surface-card text-km-heading flex items-center justify-center shadow-2xl group-hover:scale-110 group-hover:bg-[#071A4D] group-hover:text-white transition-all duration-300 dark:group-hover:bg-km-primary">
              <PlayIcon weight="fill" size={28} className="ml-1" />
            </div>
          </div>
        </Link>

        {/* Playlist (Right Side - 3 cards on md/lg, 4 cards on xl + Fixed Green Explore Button at Bottom) */}
        <div className="w-full md:w-105 xl:w-115 flex flex-col justify-between gap-2.5 sm:gap-3">
          <div className="space-y-2.5 sm:space-y-3">
            {videos.map((video, i) => {
              const isActive = i === activeIndex;
              return (
                <div
                  key={video.id || i}
                  onClick={() => setActiveIndex(i)}
                  className={`p-2 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group/card ${isActive
                    ? 'bg-blue-50/90 border-[#0B5ED7] shadow-sm ring-1 ring-[#0B5ED7]/25'
                    : 'bg-km-surface-card border-slate-200/90 hover:bg-slate-50/90 hover:border-slate-300'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Thumbnail from resources / YouTube */}
                    <div className="relative w-28 h-18 rounded-xl overflow-hidden bg-km-ink shrink-0 border border-slate-200/60 shadow-2xs">
                      <img
                        src={video.thumbnail}
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
                      <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center shadow-xs ${isActive ? 'bg-[#0B5ED7] text-white' : 'bg-km-surface-card/95 text-km-heading'
                            }`}
                        >
                          <PlayIcon weight="fill" size={9} className="ml-0.5" />
                        </div>
                      </div>
                    </div>

                    {/* Title and Duration */}
                    <div className="flex-1 min-w-0">
                      <h4
                        className={`text-xs md:text-sm font-bold leading-snug line-clamp-2 transition-colors ${isActive ? 'text-slate-950' : 'text-slate-800 group-hover/card:text-km-link'
                          }`}
                      >
                        {video.title}
                      </h4>
                      <p className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-1">
                        <ClockIcon weight="bold" size={11} className="text-slate-400" />
                        <span>{video.time}</span>
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Fixed Green Button as per Project Color Rules */}
          <Link
            href="/resources"
            className="w-full py-3 px-5 bg-km-skills hover:bg-[#15803D] active:scale-[0.98] text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer mt-auto"
          >
            <span>Explore All Resources</span>
            <ArrowUpRightIcon weight="bold" size={16} />
          </Link>
        </div>
      </div>
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
    <section className={SECTION} aria-labelledby="experts-title">
      <div className={CONTAINER}>
        <SectionHeader
          id="experts-title"
          title="Connect with our experts"
          description="Get guidance from verified industry professionals and career coaches."
          action={{ href: '/network/experts', label: 'View all experts' }}
        />

      {/* Auto-scrolling row of expert cards (pauses on hover/touch) */}
      <div className="overflow-hidden">
        <div className="animate-km-marquee hover:[animation-play-state:paused] active:[animation-play-state:paused] py-1">
          {[...experts, ...experts].map((expert, i) => {
            const expertId = expert.id || expert._id || '';
            const isSelf = Boolean(currentUserId && expertId === currentUserId);
            const isPending = pendingIds.includes(expertId);
            const isConnected = (connectedIds || []).includes(expertId);

            return (
              <div key={`${expertId}-${i}`} className="shrink-0 mr-5" aria-hidden={i >= experts.length || undefined}>
                <ProfileConnectionCard
                  user={expert}
                  variant="slider"
                  isSelf={isSelf}
                  isPending={isPending}
                  isConnected={isConnected}
                  entityType="expert"
                  onChat={onChat}
                  onFollow={onFollow}
                />
              </div>
            );
          })}
        </div>
      </div>
      </div>
    </section>
  );
};

// --- Upcoming Events & Challenges ---
const formatEventPrice = (price: unknown) => {
  const value = Number(price);
  return !price || Number.isNaN(value) || value <= 0 ? 'Free' : `₹${value.toLocaleString('en-IN')}`;
};

// "2026-11-01" is read as a local calendar day, not UTC midnight
const parseEventDate = (date?: string) => {
  if (!date) return null;
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  const parsed = ymd ? new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])) : new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatEventDate = (date?: string) => {
  const parsed = parseEventDate(date);
  return parsed
    ? parsed.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
    : date || 'Date to be announced';
};

// Seeded test events carry a trailing timestamp in the title ("Masterclass 1790409017166")
const cleanEventTitle = (title?: string) => (title || '').trim().replace(/\s+\d{10,}$/, '');

const EventDatePlaceholder = ({ date }: { date?: string }) => {
  const parsed = parseEventDate(date);
  const gridId = useId();
  return (
    <div className="w-full h-full bg-[#071A4D] relative overflow-hidden flex items-center justify-center dark:bg-km-primary">
      <svg className="absolute inset-0 w-full h-full opacity-[0.08]" aria-hidden="true">
        <defs>
          <pattern id={gridId} width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M24 0H0V24" fill="none" stroke="#FFFFFF" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${gridId})`} />
      </svg>
      {parsed ? (
        <div className="relative w-20 rounded-xl overflow-hidden bg-km-surface-card text-center shadow-lg" aria-hidden="true">
          <div className="bg-km-events text-white text-xs font-semibold py-1">
            {parsed.toLocaleDateString('en-IN', { month: 'short' })}
          </div>
          <div className="py-2 text-2xl font-bold text-km-text-primary leading-none">{parsed.getDate()}</div>
        </div>
      ) : (
        <CalendarBlankIcon size={48} weight="duotone" className="relative text-white/80" aria-hidden="true" />
      )}
    </div>
  );
};

const EventsSection = ({ events: allEvents }: { events: any[] }) => {
  // Hide events that already happened; undated events stay (shown as "Date to be announced")
  const events = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return allEvents.filter((event) => {
      const date = parseEventDate(event.date);
      return !date || date >= today;
    });
  }, [allEvents]);

  if (events.length === 0) return null;

  return (
    <section className={SECTION} aria-labelledby="events-title">
      <div className={CONTAINER}>
        <SectionHeader
          id="events-title"
          title="Upcoming events and challenges"
          description="Meet peers, attend hiring workshops, and earn certified skills at community events."
          action={{ href: '/events', label: 'View all events' }}
        />

        {/* Auto-scrolling row of event cards (pauses on hover/touch) */}
        <div className="overflow-hidden">
          <div className="animate-km-marquee hover:[animation-play-state:paused] active:[animation-play-state:paused] py-1">
            {[...events, ...events].map((event, i) => {
              const price = formatEventPrice(event.price);
              return (
                <Link
                  href={`/events/${event.id}`}
                  key={`${event.id}-${i}`}
                  aria-hidden={i >= events.length || undefined}
                  tabIndex={i >= events.length ? -1 : undefined}
                  className="shrink-0 mr-5 w-72 sm:w-80 bg-km-surface-card rounded-2xl overflow-hidden border border-km-border flex flex-col group/event hover:border-[#0B5ED7]/40 hover:shadow-md transition-all"
                >
                  <div className="h-40 relative overflow-hidden bg-[#071A4D]">
                    {event.image_url ? (
                      <img src={event.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <EventDatePlaceholder date={event.date} />
                    )}
                    <span className="absolute top-3 left-3 max-w-[70%] truncate bg-km-surface-card/95 text-km-text-primary text-xs font-semibold px-2.5 py-1 rounded-full">
                      {event.location || 'Online'}
                    </span>
                    <span
                      className={`absolute top-3 right-3 text-xs font-bold px-2.5 py-1 rounded-full ${
                        price === 'Free' ? 'bg-[#16A34A] text-white' : 'bg-km-surface-card/95 text-km-text-primary'
                      }`}
                    >
                      {price}
                    </span>
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="text-base font-semibold leading-snug text-km-text-primary line-clamp-2 min-h-[2.75rem] group-hover/event:text-km-heading transition-colors">
                      {cleanEventTitle(event.title)}
                    </h3>
                    {event.organizer && (
                      <p className="mt-1 text-sm text-km-text-secondary truncate">By {event.organizer}</p>
                    )}
                    <div className="mt-auto pt-4 border-t border-km-border-subtle flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 font-medium text-km-text-primary">
                        <CalendarBlankIcon size={16} weight="bold" className="text-km-events" aria-hidden="true" />
                        {formatEventDate(event.date)}
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-km-heading">
                        Details
                        <CaretRightIcon size={14} weight="bold" className="transition-transform group-hover/event:translate-x-0.5" aria-hidden="true" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

// --- Wallet Banner ---
const WalletBanner = () => (
  <section className={SECTION} aria-labelledby="wallet-title">
    <div className={CONTAINER}>
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-orange-500 via-orange-600 to-amber-700 text-white px-6 py-8 sm:px-10 sm:py-10 lg:px-12">
        {/* Background mark, kept away from the copy */}
        <div className="absolute right-8 lg:right-12 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-4 opacity-15 pointer-events-none select-none" aria-hidden="true">
          <WalletIcon size={120} className="text-white hidden lg:block" />
          <span className="text-6xl lg:text-7xl font-bold text-white/60">Wallet</span>
        </div>

        <div className="relative max-w-xl text-center md:text-left">
          <h2 id="wallet-title" className="text-2xl sm:text-[28px] lg:text-[32px] font-bold tracking-[-0.02em] leading-tight">
            KaamMilega Digital <span className="text-amber-200">Wallet</span>
          </h2>
          <p className="mt-2 text-[15px] sm:text-base font-medium text-white/95">
            Manage service passes, track earnings, and receive fast payouts.
          </p>
          <Link
            href="/wallet"
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-km-surface-card text-orange-700 hover:bg-orange-50 text-sm font-semibold shadow-md transition-colors"
          >
            <WalletIcon size={18} weight="bold" aria-hidden="true" />
            Open Wallet
          </Link>
        </div>
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


const TestimonialsSection = () => {
  // Only testimonials added by admins (GET /testimonials); never invented stories
  const [stories, setStories] = useState<TestimonialItem[]>([]);
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

  if (stories.length === 0) return null;

  return (
    <section className={`${SECTION} overflow-hidden font-sans`} aria-labelledby="stories-title">
      <div className={CONTAINER}>
        <SectionHeader
          id="stories-title"
          title="Verified stories from real candidates"
          description="Real workers across logistics, transportation, and technical trades hired with zero brokerage and direct HR calls."
        />
      </div>

      {/* Two Horizontal Lines of Auto-Scrolled Marquee moving in opposite directions */}
      <div className="space-y-4 sm:space-y-5 py-1">
        {/* Row 1: Moves Left */}
        <div className="relative w-full overflow-hidden group/row1">
          <div className="animate-km-marquee flex [&>*]:mr-4 w-max group-hover/row1:[animation-play-state:paused]">
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
          <div className="animate-km-marquee-reverse flex [&>*]:mr-4 w-max group-hover/row2:[animation-play-state:paused]">
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
      {selectedVideo?.youtube_video_id && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-sans">
          <div className="relative w-full max-w-3xl bg-km-ink rounded-3xl overflow-hidden shadow-2xl border border-[#1E293B] flex flex-col">
            {/* Top Bar with Candidate Info & Close (Clean & Elegant, no glowing dot) */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-km-ink border-b border-[#1E293B] text-white">
              <div className="flex items-center gap-2 pr-4 overflow-hidden">
                <span className="text-xs sm:text-sm font-semibold text-white/90 truncate">
                  {selectedVideo.name} | {selectedVideo.role} ({selectedVideo.company})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVideo(null)}
                className="w-8 h-8 rounded-full bg-km-ink-soft hover:bg-slate-700 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                aria-label="Close video"
              >
                <XIcon weight="bold" size={16} />
              </button>
            </div>

            {/* Embedded YouTube Player */}
            <div className="aspect-video w-full bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${selectedVideo.youtube_video_id}?autoplay=1&rel=0`}
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
  const hasVideo = Boolean(story.youtube_video_id);
  const thumb =
    story.thumbnail_url ||
    (hasVideo ? `https://img.youtube.com/vi/${story.youtube_video_id}/hqdefault.jpg` : "");

  return (
    <div className="w-[370px] sm:w-[400px] shrink-0 bg-km-surface-card rounded-2xl border border-km-border p-3.5 sm:p-4 flex gap-3.5 sm:gap-4 hover:border-[#0B5ED7]/40 transition-all duration-150 shadow-xs hover:shadow-md shadow-slate-200/50 group">
      {/* Thumbnail Section (Full-height match, eliminates whitespace underneath) */}
      {thumb && (
      <div
        onClick={hasVideo ? () => onOpenVideo(story) : undefined}
        className={`relative w-28 sm:w-32 self-stretch min-h-[140px] rounded-xl overflow-hidden bg-km-ink shrink-0 group/thumb ${hasVideo ? "cursor-pointer" : ""}`}
      >
        <img
          src={thumb}
          alt={story.name}
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            if (story.youtube_video_id) {
              (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${story.youtube_video_id}/hqdefault.jpg`;
            }
          }}
        />

        {/* Play button only when there is a video to play */}
        {hasVideo && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover/thumb:bg-black/30 transition-colors">
            <div className="w-8 h-8 bg-km-surface-card/95 text-km-heading rounded-full flex items-center justify-center shadow-md group-hover/thumb:scale-110 transition-transform">
              <PlayIcon weight="fill" size={12} className="ml-0.5" />
            </div>
          </div>
        )}
      </div>
      )}

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
          <p className="text-xs text-slate-500 font-medium leading-snug mt-0.5 break-words">
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
                <StarIcon weight="fill"
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
const PREMIUM_SERVICES = ['Resume Writing', 'Priority Applicant', 'Resume Display'];

const PremiumServicesBanner = () => {
  return (
    <section className={SECTION} aria-labelledby="premium-title">
      <div className={CONTAINER}>
        <div className="bg-km-surface-card border border-km-border rounded-3xl p-6 sm:p-8 lg:p-10 flex flex-col md:flex-row items-center gap-6 md:gap-10">
          <ProfileBoostArt className="w-full md:w-1/3 max-w-sm shrink-0" />

          <div className="flex-1 text-center md:text-left">
            <h2 id="premium-title" className="text-xl sm:text-2xl lg:text-[28px] font-bold tracking-[-0.02em] leading-tight text-km-text-primary">
              Accelerate your job search with premium services
            </h2>
            <p className="mt-3 text-[15px] text-km-text-secondary leading-relaxed max-w-xl">
              Get hired faster with resume optimization, priority applicant status, direct recruiter connections and skill certifications.
            </p>
            <div className="mt-5 flex flex-wrap justify-center md:justify-start gap-2">
              {PREMIUM_SERVICES.map((service) => (
                <Link
                  key={service}
                  href="/resources/premium"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-km-border text-sm font-medium text-km-text-primary hover:border-[#0B5ED7]/40 hover:text-km-heading transition-colors"
                >
                  {service}
                  <CaretRightIcon size={14} weight="bold" className="text-km-heading" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>

          <Link
            href="/resources/premium"
            className="shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#071A4D] hover:bg-[#0B1F52] text-white text-sm font-semibold transition-colors dark:bg-km-primary dark:hover:bg-km-primary-dark"
          >
            Learn more
            <ArrowRightIcon size={16} weight="bold" aria-hidden="true" />
          </Link>
        </div>
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
    <section id="faq" className={`${SECTION} scroll-mt-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto font-sans`}>
      <div className="bg-km-surface-card rounded-3xl p-6 sm:p-10 md:p-12 border border-km-border">
        <SectionHeader title="Frequently asked questions" />

        <div className="space-y-4">
          {displayFaqs.map((faq, i) => (
            <div key={i} className="border-b border-slate-100 last:border-0 pb-4">
              <button
                type="button"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex justify-between items-center py-4 text-left group cursor-pointer"
              >
                <span className={`text-base font-bold transition-colors ${openIndex === i ? 'text-km-heading' : 'text-slate-800 group-hover:text-km-heading'}`}>
                  {faq.question}
                </span>
                {openIndex === i ? (
                  <CaretUpIcon className="text-km-heading shrink-0 ml-4" size={20} />
                ) : (
                  <CaretDownIcon className="text-slate-400 group-hover:text-km-heading shrink-0 ml-4" size={20} />
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