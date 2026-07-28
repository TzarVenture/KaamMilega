"use client";
import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  MessageCircle, Briefcase, CheckCircle, MapPin,
  PhoneCall, Users, ChevronLeft, ChevronRight, Star,
  Home, Clock, UserRound, Play, Calendar, Gift, Wallet,
  ChevronUp, ChevronDown
} from 'lucide-react';


import Link from 'next/link';
import api from '@/lib/axios';
import { useRouter } from 'next/navigation';
import { ConnectJustLikeYou } from '@/components/network/ConnectJustLikeYou';

export default function LandingPage() {
  const router = useRouter();
  const [cities, setCities] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [experts, setExperts] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [citiesRes, questionsRes, jobsRes, usersRes, expertsRes, eventsRes] = await Promise.allSettled([
          api.get('/cities'),
          api.get('/admin/questions').catch(() => []), // Fallback if regular endpoint fails
          api.get('/jobs?limit=50'), // Get some jobs to extract companies
          api.get('/admin/users').catch(() => []),
          api.get('/users/experts').catch(() => []),
          api.get('/events?limit=5').catch(() => [])
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
          setExperts(filtered.slice(0, 5));
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
      <HeroSection />
      <AutoMovingSlider />
      <LocationSection cities={cities} />
      <div className="bg-gray-50 pb-20">
        <TrustCard />
        <FeatureBar />
      </div>
      <JobRolesGrid />
      <CompaniesSlider companies={companies} />
      {users.length > 0 && (
        <ConnectJustLikeYou 
          users={users} 
          onChat={(id) => router.push(`/chat?userId=${id}`)} 
          onFollow={async (id) => {
            try {
                await api.post('/network/connect', { receiver_id: id });
                alert("Connection request sent!");
            } catch (e: any) {
                console.error("Failed to connect", e);
                alert(e.message || "Could not send connection request");
            }
          }} 
        />
      )}
      <FeaturedCompanies companies={companies} />
      <QualificationSearch />
      <JobTypeSection />
      <DiversityBanner />
      <LearnSection />
      {experts.length > 0 && <ExpertSlider experts={experts} />}
      <EventsSection events={events} />
      <WalletBanner />
      <TestimonialsSection />
      <PremiumServicesBanner />
      <PopularQuestions questions={questions} />
    </main>
  );
}

// --- Components ---

const HeroSection = () => (
  <section className="relative bg-[#3b1641] rounded-[24px] md:rounded-[40px] mx-3 md:mx-4 py-12 md:py-20 px-4 md:px-6 overflow-hidden text-center text-white">
    {/* Background Pattern Mockup */}
    <div className="absolute inset-0 opacity-10 pointer-events-none">
      <div className="absolute top-10 left-10 w-20 h-20 border border-white rounded-full" />
      <div className="absolute bottom-10 right-20 w-32 h-32 border border-white rounded-full" />
    </div>

    <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
      Find <span className="text-[#c084fc]">Local Jobs</span><br />
      With Better Salary!
    </h1>
    <p className="text-base md:text-lg opacity-90 mb-8">Call HR Directly To Fix Interview For FREE</p>

    <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
      <Link href="/login">
        <button className="bg-[#a855f7] hover:bg-[#9333ea] px-8 py-3 rounded-full font-bold flex items-center justify-center gap-2 transition-all w-full sm:w-auto">
          <MessageCircle size={20} /> Chat With HR
        </button>
      </Link>
      <Link href="/jobs">
        <button className="bg-transparent border-2 border-white hover:bg-white hover:text-[#3b1641] px-8 py-3 rounded-full font-bold transition-all w-full sm:w-auto">
          Get A Job Now
        </button>
      </Link>
    </div>
  </section>
);

const AutoMovingSlider = () => {
  // Mock data for the infinite slider
  const testimonials = Array(10).fill({ name: "Dharmender", status: "Has Fixed An Interview" });

  return (
    <div className="bg-[#fdf4ff] py-6 overflow-hidden whitespace-nowrap border-y border-purple-50">
      <motion.div
        className="flex gap-12"
        animate={{ x: [0, -1000] }}
        transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
      >
        {[...testimonials, ...testimonials].map((item, idx) => (
          <div key={idx} className="flex items-center gap-3 min-w-[250px]">
            <div className="w-12 h-12 bg-[#3b1641] rounded-full flex items-center justify-center text-white">
              <span className="rotate-45 text-xl">▲</span>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter leading-none">
                {item.status}
              </p>
              <p className="text-sm font-bold text-gray-800">{item.name}</p>
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
};

const LocationSection = ({ cities }: { cities: any[] }) => {
  const scrollRef = useRef<HTMLDivElement>(null);


  const displayCities = cities.length > 0 ? cities : [
    { name: "Mumbai", count: "Wait..." },
    { name: "Bangalore", count: "Wait..." }
  ];

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left'
        ? scrollLeft - clientWidth / 2
        : scrollLeft + clientWidth / 2;

      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  return (
    <section className="py-12 md:py-20 px-4 md:px-6 text-center max-w-7xl mx-auto">
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-800 mb-8 md:mb-12">
        Where Do You Want To <span className="text-[#a855f7]">Work?</span>
      </h2>

      <div className="relative flex items-center group">
        <button
          onClick={() => scroll('left')}
          className="hidden sm:flex absolute -left-4 z-10 p-3 bg-white rounded-full shadow-xl text-gray-400 hover:text-[#a855f7] hover:scale-110 transition-all border border-gray-50 active:scale-95"
        >
          <ChevronLeft size={28} />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-4 md:gap-6 overflow-x-auto pb-6 md:pb-10 scroll-smooth scrollbar-hide w-full snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {displayCities.map((city, idx) => (
            <Link key={idx} href={`/jobs?city=${city.id || city.name}`}>
              <div
                className="min-w-[160px] sm:min-w-[200px] md:min-w-[220px] bg-white p-5 md:p-8 rounded-[24px] md:rounded-[32px] shadow-[0_15px_40px_-12px_rgba(0,0,0,0.08)] hover:shadow-[0_20px_50px_-12px_rgba(168,85,247,0.15)] transition-all cursor-pointer border border-gray-50 snap-center"
              >
                <h3 className="text-lg md:text-2xl font-black text-gray-800 mb-2">{city.name}</h3>
                <p className="text-xs md:text-sm text-gray-400 font-semibold tracking-wide uppercase">
                  {city.vacancies || 'View Jobs'}
                </p>
              </div>
            </Link>
          ))}
        </div>

        <button
          onClick={() => scroll('right')}
          className="hidden sm:flex absolute -right-4 z-10 p-3 bg-white rounded-full shadow-xl text-gray-400 hover:text-[#a855f7] hover:scale-110 transition-all border border-gray-50 active:scale-95"
        >
          <ChevronRight size={28} />
        </button>
      </div>
    </section>
  );
};

const TrustCard = () => (
  <div className="bg-white p-6 md:p-10 rounded-[28px] md:rounded-[40px] shadow-2xl flex flex-col items-center md:items-start max-w-2xl mx-3 md:mx-auto -mt-10 relative z-20 border border-purple-50">
    <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-gray-800 mb-4 md:mb-6 leading-tight text-center md:text-left">
      More Than <span className="text-[#a855f7]">10 Lakh Indians</span> Trust Job Hai 🤝
    </h3>
    <div className="flex flex-col sm:flex-row flex-wrap gap-3 md:gap-4 w-full sm:w-auto">
      <Link href="/register" className="w-full sm:w-auto">
        <button className="w-full sm:w-auto bg-[#a855f7] hover:bg-[#9333ea] text-white px-8 py-3 rounded-full font-bold transition-all shadow-lg shadow-purple-200">
          Register Now
        </button>
      </Link>
      <Link href="/jobs" className="w-full sm:w-auto">
        <button className="w-full sm:w-auto border-2 border-[#a855f7] text-[#a855f7] hover:bg-purple-50 px-6 py-3 rounded-full font-bold transition-all text-sm">
          Chat With HR & Similar Profile
        </button>
      </Link>
    </div>
  </div>
);

const FeatureBar = () => {
  const features = [
    { icon: <CheckCircle className="text-blue-500" />, text: "100 % FREE & Verified Jobs", link: "/jobs?verified=true" },
    { icon: <MapPin className="text-red-500" />, text: "Best Jobs In Your Locality", link: "/jobs" },
    { icon: <PhoneCall className="text-orange-500" />, text: "Direct Calls With HR For Interview", link: "/jobs" },
    { icon: <MessageCircle className="text-pink-500" />, text: "Chat With HR", link: "/chat" },
    { icon: <Users className="text-blue-600" />, text: "Chat With Like You", link: "/chat" },
  ];

  return (
    <div className="bg-gray-50 py-10 md:py-16 px-4 md:px-6">
      <div className="max-w-7xl mx-auto grid grid-cols-3 sm:grid-cols-5 justify-items-center gap-6 md:gap-8">
        {features.map((f, i) => (
          <Link key={i} href={f.link}>
            <div className="flex flex-col items-center text-center cursor-pointer hover:scale-105 transition-transform">
              <div className="mb-3 transform scale-110 md:scale-125">{f.icon}</div>
              <p className="text-[10px] md:text-[11px] font-bold text-gray-800 leading-snug">{f.text}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};



// --- Job Roles Grid ---
const JobRolesGrid = () => {
  const roles = [
    { title: "Delivery", img: "/delivery.jpg" },
    { title: "Driver", img: "/driver.jpg" },
    { title: "Warehouse / Logistics", img: "/warehouse.jpg" },
    { title: "Manufacturer", img: "/factory.jpg" },
    { title: "Housekeeping / Peon", img: "/housekeeping.jpg" },
    { title: "Security Guard", img: "/security.jpg" },
    { title: "Painter", img: "/painter.jpg" },
    { title: "Labour / Helper", img: "/labour.jpg" },
    { title: "Technician", img: "/tech.jpg" },
    { title: "Refrigerator & AC Technician", img: "/ac.jpg" },
  ];

  return (
    <section className="py-10 md:py-16 px-4 md:px-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
        {roles.map((role, i) => (
          <Link key={i} href={`/jobs?role=${role.title}`}>
            <div className="relative h-36 sm:h-44 md:h-48 rounded-xl md:rounded-2xl overflow-hidden group cursor-pointer">
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors z-10" />
              <div className="absolute inset-0 bg-gray-300 grayscale group-hover:grayscale-0 transition-all duration-500" />
              <div className="absolute bottom-3 left-3 z-20 text-white">
                <h4 className="font-bold text-xs leading-tight">{role.title}</h4>
                <p className="text-[9px] opacity-80">View 5,50,000+ Vacancies</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
      <div className="text-center mt-6 md:mt-8">
        <Link href="/jobs">
          <button className="px-6 py-2 border border-purple-300 text-purple-600 rounded-full text-sm font-bold hover:bg-purple-50">
            See All Job Roles
          </button>
        </Link>
      </div>
    </section>
  );
};

// --- Companies Hiring Slider ---
const CompaniesSlider = ({ companies }: { companies: any[] }) => {
  const displayCompanies = companies.length > 0 ? companies : Array(5).fill({ name: "Company" });

  return (
    <section className="py-16 bg-white overflow-hidden">
      <h2 className="text-center text-3xl font-black mb-10">
        <span className="text-purple-500">Companies</span> Hiring With Us
      </h2>
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide snap-x">
          {displayCompanies.map((co, i) => (
            <Link key={i} href={`/jobs?company=${co.name === 'Company' ? '' : co.name}`}>
              <div className="min-w-[280px] bg-white p-6 rounded-3xl border border-gray-100 shadow-sm snap-start hover:border-purple-200 transition-colors cursor-pointer">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-gray-800 truncate max-w-[180px]" title={co.name}>{co.name} <ChevronRight size={16} className="inline" /></h4>
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                </div>
                <p className="text-xs text-gray-400 mb-4">Actively Hiring</p>
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map(n => (
                    <div key={n} className="w-10 h-10 rounded-full bg-purple-50 border-2 border-white flex items-center justify-center">
                      <div className="w-5 h-5 bg-purple-200 rounded-sm rotate-45" />
                    </div>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};



// --- Featured Companies Slider ---
const FeaturedCompanies = ({ companies }: { companies: any[] }) => {
  const displayCompanies = companies.length > 0 ? companies : [
    { name: "No companies found", rating: "0", reviews: "0", desc: "No featured companies available at the moment." }
  ];

  return (
    <section className="py-16 bg-white overflow-hidden">
      <h2 className="text-center text-4xl font-black mb-12">
        Featured Companies <span className="text-purple-500">Actively Hiring</span>
      </h2>
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="flex gap-6 overflow-x-auto pb-8 scrollbar-hide snap-x">
          {displayCompanies.map((co, i) => (
            <div key={i} className="min-w-[300px] bg-white rounded-[32px] p-8 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.08)] border border-gray-50 snap-center text-center">
              <div className="w-24 h-12 bg-gradient-to-r from-blue-400 to-purple-400 rounded-lg mx-auto mb-6 opacity-60 flex items-center justify-center text-white font-bold italic">LOGO</div>
              <h4 className="font-bold text-gray-800 mb-1">{co.name}</h4>
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400 mb-4">
                <span className="flex items-center gap-1"><Star size={12} className="fill-yellow-400 text-yellow-400" /> {co.rating}</span>
                <span>|</span>
                <span>{co.reviews}</span>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed mb-6 line-clamp-3">{co.desc}</p>
              <Link href={`/jobs?company=${co.name}`}>
                <button className="text-purple-600 font-bold text-sm hover:underline">View Jobs</button>
              </Link>
            </div>
          ))}
        </div>
        <div className="text-center mt-8">
          <Link href="/jobs">
            <button className="px-8 py-2 border border-purple-200 text-purple-600 rounded-full text-sm font-bold hover:bg-purple-50">
              View All Companies
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
    { label: "Below 10th", vacancies: "9,30,000+", icon: "✏️" },
    { label: "10th Pass", vacancies: "4,00,000+", icon: "📖" },
    { label: "12th Pass", vacancies: "9,00,000+", icon: "📚" },
    { label: "Diploma", vacancies: "50,000+", icon: "📜" },
    { label: "Graduate", vacancies: "7,30,000+", icon: "🎓" },
    { label: "Post Graduate", vacancies: "25,000+", icon: "🎓" },
  ];

  return (
    <section className="py-12 md:py-20 bg-gray-50 px-4 md:px-6">
      <div className="max-w-7xl mx-auto text-center">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black mb-6 md:mb-8">
          Search Job Based On Your <span className="text-purple-500">Qualification</span>
        </h2>

        {/* Toggle Switch */}
        <div className="inline-flex bg-white border border-purple-100 rounded-full p-1 mb-8 md:mb-12 shadow-sm">
          <button className="px-5 md:px-8 py-2 bg-purple-500 text-white rounded-full text-sm font-bold">Qualification</button>
          <button className="px-5 md:px-8 py-2 text-gray-400 text-sm font-bold">Skill</button>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 md:gap-4">
          {qualifications.map((q, i) => (
            <Link key={i} href={`/jobs?qualification=${q.label}`}>
              <div className="bg-white p-3 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer flex flex-col items-center">
                <span className="text-2xl md:text-3xl mb-2 md:mb-4">{q.icon}</span>
                <h4 className="font-bold text-gray-800 text-[11px] md:text-sm mb-1">{q.label}</h4>
                <p className="text-[9px] md:text-[10px] text-gray-400">View {q.vacancies}</p>
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
          What <span className="text-purple-500">Type Of Job</span> Do You Want?
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          {types.map((t, i) => (
            <Link key={i} href={`/jobs?job_type=${t.label}`}>
              <div className="flex items-center gap-3 md:gap-4 bg-white border-2 border-dashed border-gray-200 rounded-2xl md:rounded-3xl p-4 md:p-6 hover:border-purple-200 transition-colors cursor-pointer">
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
              <div className="flex items-center gap-3 md:gap-4 bg-white border-2 border-dashed border-gray-200 rounded-2xl md:rounded-3xl p-4 md:p-6 hover:border-purple-200 transition-colors cursor-pointer">
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
    <div className="relative min-h-[280px] md:h-[300px] rounded-[24px] md:rounded-[40px] overflow-hidden flex items-center px-6 md:px-12 text-white py-8 md:py-0">
      <div className="absolute inset-0 bg-gradient-to-r from-[#3b1641] via-[#4a1d52] to-[#250d29] z-10" />

      <div className="relative z-20 max-w-lg">
        <div className="flex items-center gap-2 mb-3 md:mb-4">
          <div className="w-8 h-8 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center">▲</div>
          <span className="text-xs font-bold">Company Name <Star size={10} className="inline fill-yellow-400 border-none" /> 4.2</span>
        </div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black leading-tight mb-4">
          Our Diversity And Inclusion At Workplace
        </h2>
        <button className="text-sm font-bold underline hover:text-purple-300">Learn More</button>
      </div>

      <div className="hidden md:flex absolute right-12 z-20 w-72 h-44 bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl items-center justify-center">
        <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
          <Play fill="white" size={20} className="ml-1" />
        </div>
      </div>
    </div>
  </section>
);

// --- Video Learning Section ---
const LearnSection = () => {
  const playlist = [
    { title: "Lorem Ipsum Dolor Sit Amet Consectetur.", time: "2min 20sec", active: true },
    { title: "Lorem Ipsum Dolor Sit Amet Consectetur.", time: "2min 22sec", active: false },
    { title: "Lorem Ipsum Dolor Sit Amet Consectetur.", time: "2min 36sec", active: false },
  ];

  return (
    <section className="py-12 md:py-20 px-4 md:px-6 max-w-7xl mx-auto">
      <h2 className="text-center text-2xl sm:text-3xl md:text-4xl font-black mb-8 md:mb-12">
        Learn With <span className="text-purple-500">Kaam Milega</span>
      </h2>
      <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
        {/* Main Video Player */}
        <div className="w-full md:flex-1 aspect-video bg-[#1a0b1d] rounded-[24px] md:rounded-[40px] flex items-center justify-center relative group cursor-pointer overflow-hidden">
          <Play size={50} className="text-white opacity-80 group-hover:scale-110 transition-transform" />
        </div>

        {/* Playlist */}
        <div className="w-full md:w-[400px] space-y-3 md:space-y-4">
          {playlist.map((video, i) => (
            <div
              key={i}
              className={`p-3 md:p-4 rounded-2xl md:rounded-3xl border transition-all cursor-pointer ${video.active ? 'bg-purple-50 border-purple-200' : 'bg-white border-gray-100 hover:bg-gray-50'
                }`}
            >
              <div className="flex gap-3 md:gap-4">
                <div className={`w-16 md:w-20 h-10 md:h-12 rounded-lg md:rounded-xl shrink-0 flex items-center justify-center ${video.active ? 'bg-purple-400' : 'bg-gray-200'}`}>
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
const ExpertSlider = ({ experts }: { experts: any[] }) => {
  return (
    <section className="py-12 md:py-20 bg-white overflow-hidden">
      <h2 className="text-center text-2xl sm:text-3xl md:text-4xl font-black mb-8 md:mb-12">
        Connect With Our <span className="text-purple-500">Experts</span>
      </h2>
      <div className="flex gap-4 md:gap-6 px-4 md:px-6 overflow-x-auto scrollbar-hide max-w-7xl mx-auto snap-x" style={{ scrollbarWidth: 'none' }}>
        {experts.map((expert, i) => (
          <div key={i} className="min-w-[200px] sm:min-w-[220px] md:min-w-[240px] bg-white rounded-[24px] md:rounded-[32px] p-5 md:p-8 shadow-[0_15px_40px_-10px_rgba(0,0,0,0.06)] border border-gray-50 text-center snap-center">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="w-full h-full bg-indigo-950 rounded-full flex items-center justify-center overflow-hidden">
                {expert.profile_image ? (
                    <img src={expert.profile_image} alt={expert.name} className="w-full h-full object-cover" />
                ) : (
                    <span className="text-white font-bold text-2xl">{expert.name?.[0]?.toUpperCase() || 'E'}</span>
                )}
              </div>
              <div className="absolute bottom-0 right-1 w-5 h-5 bg-green-500 border-4 border-white rounded-full" />
            </div>
            <h4 className="font-bold text-gray-900 text-lg">{expert.name || 'Expert'}</h4>
            <p className="text-[10px] text-gray-400 italic font-medium mb-3 tracking-wide">{expert.headline || expert.roles?.join(', ') || 'Expert'}</p>
            <div className="flex items-center justify-center gap-1 text-[11px] text-gray-500 font-bold mb-4 uppercase">
              <MapPin size={12} className="text-purple-400" /> {expert.city || 'Location'}
            </div>
            <p className="text-[11px] font-bold text-gray-400 mb-6">0 Mutual Connects</p>
            <div className="space-y-3">
              {(() => {
                const storedUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
                let currentUserId = '';
                if (storedUser) {
                    try {
                        const parsed = JSON.parse(storedUser);
                        currentUserId = parsed.id || parsed._id;
                    } catch (e) {}
                }
                const isSelf = (expert.id === currentUserId || expert._id === currentUserId);
                
                return !isSelf && (
                  <>
                    <Link href={`/chat?userId=${expert.id || expert._id}`}>
                      <button className="w-full py-2.5 border border-purple-200 rounded-full text-purple-600 text-xs font-bold flex items-center justify-center gap-2 hover:bg-purple-50 transition-colors">
                        <MessageCircle size={14} /> Chat
                      </button>
                    </Link>
                    <button 
                      onClick={async () => {
                          try {
                              let id = expert.id || expert._id;
                              await api.post('/network/connect', { receiver_id: id });
                              alert("Invitation sent to expert!");
                          } catch (e: any) {
                              console.error("Failed to connect", e);
                              alert(e.message || "Could not send invitation");
                          }
                      }}
                      className="w-full py-2.5 bg-purple-500 text-white rounded-full text-xs font-bold hover:bg-purple-600 shadow-lg shadow-purple-100 transition-all mt-3">
                      Follow
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        ))}
      </div>
      {/* Indicator */}
      <div className="flex justify-center gap-2 mt-10">
        <div className="w-6 h-2 bg-purple-900 rounded-full" />
        <div className="w-2 h-2 bg-gray-300 rounded-full" />
        <div className="w-2 h-2 bg-gray-300 rounded-full" />
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
            Upcoming <span className="text-purple-500">Events And Challenges</span>
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-6 md:mb-8">
            Lorem ipsum dolor sit amet consectetur. Viverra scelerisque leo cursus facilisis dui.
            A bibendum commodo id at id integer.
          </p>
          <Link href="/events">
            <button className="bg-purple-500 hover:bg-purple-600 text-white px-6 md:px-8 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all">
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
              <Link href={`/events/${event.id}`} key={i} className="min-w-[280px] sm:min-w-[320px] md:min-w-[340px] bg-white rounded-[24px] md:rounded-[32px] overflow-hidden shadow-lg border border-gray-50 flex flex-col group transition-all hover:shadow-xl">
                <div className="h-40 bg-gray-200 relative overflow-hidden">
                  {event.image_url ? (
                      <img src={event.image_url} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                      <div className="w-full h-full bg-[#1D0A1C] flex items-center justify-center relative overflow-hidden">
                          <div className="flex items-center justify-center opacity-60">
                              <div className="w-10 h-10 bg-purple-400 clip-path-triangle transform -rotate-12 -translate-x-2" />
                              <div className="w-8 h-8 bg-purple-300 clip-path-triangle translate-x-2 translate-y-2" />
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
                    <span className="flex items-center gap-1"><Calendar size={12} className="text-purple-500" /> {event.date}</span>
                    <span className="flex items-center gap-1"><Users size={12} className="text-purple-500" /> 1K+ Joined</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-black mt-auto">
                    <span className="text-pink-500">🔥 Selling Fast</span>
                    <span className="text-purple-600 bg-purple-50 px-4 py-2 rounded-full hover:bg-purple-100 transition-colors">Register</span>
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
  <section className="px-3 md:px-6 py-6 md:py-10 max-w-7xl mx-auto">
    <div className="bg-gradient-to-r from-purple-400 via-purple-600 to-[#2d0a31] rounded-[24px] md:rounded-[40px] p-8 md:p-12 relative overflow-hidden flex flex-col md:flex-row items-center justify-center md:justify-between text-white">
      <div className="absolute left-10 opacity-10 text-4xl font-black uppercase tracking-widest pointer-events-none hidden md:block">Graphic Pending</div>

      <div className="relative z-10 text-center md:text-left">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black mb-2">Recharge Your <span className="text-purple-300">Wallet</span> And<br />Get Faster Job</h2>
        <p className="text-sm opacity-80 mb-5 md:mb-6">Nothing Casual About This Job App</p>
        <button className="bg-white text-purple-900 px-6 md:px-8 py-3 rounded-2xl font-bold flex items-center gap-2 mx-auto md:mx-0 shadow-xl">
          <Wallet size={18} /> Recharge Now
        </button>
      </div>
    </div>
  </section>
);

// --- Testimonials Slider ---
const TestimonialsSection = () => {
  const testimonials = Array(5).fill({
    name: "Vipul Shah",
    rating: 4.6,
    text: "Lorem ipsum dolor sit amet consectetur. Viverra scelerisque leo cursus facilisis dui. A bibendum commodo id at id integer. Nunc pellentesque turpis tempus cras velit interdum nunc. Purus porta id aliquet et enim sed. Risus donec justo facilisis enim consequat morbi quam sollicitudin."
  });

  return (
    <section className="py-16 md:py-24 bg-gray-50 overflow-hidden relative">
      <h2 className="text-center text-2xl sm:text-3xl md:text-4xl font-black mb-10 md:mb-16 px-4">
        What People Are Saying About <span className="text-purple-500">Kaam Milega</span>
      </h2>

      <div className="relative max-w-7xl mx-auto px-4 md:px-6 flex items-center">
        {/* Navigation */}
        <button className="hidden sm:flex absolute left-2 z-20 p-3 bg-white rounded-full shadow-lg text-gray-300 hover:text-purple-600 transition-all">
          <ChevronLeft size={24} />
        </button>

        <div className="flex gap-4 md:gap-8 overflow-x-auto scrollbar-hide snap-x px-0 sm:px-12 pb-6 md:pb-10 w-full" style={{ scrollbarWidth: 'none' }}>
          {testimonials.map((t, i) => (
            <div key={i} className="min-w-[300px] sm:min-w-[480px] md:min-w-[600px] bg-white rounded-[24px] md:rounded-[40px] p-6 md:p-12 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-gray-50 flex flex-col sm:flex-row gap-4 md:gap-8 snap-center">
              <div className="w-16 h-16 sm:w-24 sm:h-24 bg-gray-100 rounded-full flex items-center justify-center shrink-0 relative overflow-hidden mx-auto sm:mx-0">
                <Play fill="#cbd5e1" className="text-gray-300" />
                <div className="absolute inset-0 bg-purple-900/10" />
              </div>
              <div className="text-left">
                <h4 className="text-lg md:text-2xl font-black text-purple-600 mb-1">{t.name}</h4>
                <div className="flex items-center gap-2 mb-3 md:mb-4">
                  <span className="text-sm font-bold text-gray-700">{t.rating}</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map(s => <Star key={s} size={12} className="fill-yellow-400 text-yellow-400" />)}
                  </div>
                </div>
                <p className="text-xs md:text-sm text-gray-400 leading-relaxed italic line-clamp-4 md:line-clamp-none">"{t.text}"</p>
              </div>
            </div>
          ))}
        </div>

        <button className="hidden sm:flex absolute right-2 z-20 p-3 bg-white rounded-full shadow-lg text-gray-300 hover:text-purple-600 transition-all">
          <ChevronRight size={24} />
        </button>
      </div>
    </section>
  );
};

// --- Premium Services Banner ---
const PremiumServicesBanner = () => {
  return (
    <section className="px-3 md:px-6 py-6 md:py-10 max-w-7xl mx-auto">
      <div className="bg-white border-2 border-purple-100 rounded-[24px] md:rounded-[40px] p-6 md:p-10 flex flex-col md:flex-row items-center gap-6 md:gap-12 relative overflow-hidden">
        {/* Placeholder for Graphic */}
        <div className="w-full md:w-1/3 aspect-video bg-gray-50 rounded-2xl md:rounded-3xl flex items-center justify-center border-2 border-dashed border-gray-200">
          <span className="text-gray-400 font-black uppercase tracking-widest text-xs md:text-sm">Graphic Pending</span>
        </div>

        <div className="flex-1 text-center md:text-left">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900 mb-3 md:mb-4">
            Accelerate Your Job Search With Premium Services
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-5 md:mb-8 max-w-xl">
            Service to help you get hired, faster: from preparing your CV, getting recruiter attention,
            finding the right jobs, and more!
          </p>

          <div className="flex flex-wrap justify-center md:justify-start gap-2 md:gap-3 mb-5 md:mb-8">
            {['Resume Writing', 'Priority Applicant', 'Resume Display'].map((service) => (
              <button key={service} className="px-4 md:px-5 py-2 border border-purple-200 rounded-full text-[10px] md:text-[11px] font-bold text-gray-700 hover:bg-purple-50 transition-colors flex items-center gap-2">
                {service} <ChevronRight size={12} className="text-purple-400" />
              </button>
            ))}
          </div>
        </div>

        <Link href="/resources/premium">
          <button className="bg-purple-500 hover:bg-purple-600 text-white px-6 md:px-8 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-purple-100">
            Learn More
          </button>
        </Link>
      </div>
    </section>
  );
};

// --- Popular Questions (Accordion) ---
const PopularQuestions = ({ questions }: { questions: any[] }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const displayFaqs = questions.length > 0 ? questions : [
    { question: "No questions found.", answer: "Please check back later." }
  ];

  return (
    <section className="py-12 md:py-20 px-3 md:px-6 max-w-5xl mx-auto">
      <div className="bg-white rounded-[24px] md:rounded-[40px] p-6 md:p-16 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.03)] border border-gray-50">
        <h2 className="text-center text-2xl sm:text-3xl md:text-4xl font-black mb-8 md:mb-16">
          Popular <span className="text-purple-500">Questions</span>
        </h2>

        <div className="space-y-4">
          {displayFaqs.map((faq, i) => (
            <div key={i} className="border-b border-gray-100 last:border-0 pb-4">
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex justify-between items-center py-4 text-left group"
              >
                <span className={`font-bold transition-colors ${openIndex === i ? 'text-purple-600' : 'text-gray-800 hover:text-purple-500'}`}>
                  {faq.question}
                </span>
                {openIndex === i ? (
                  <ChevronUp className="text-purple-500" size={20} />
                ) : (
                  <ChevronDown className="text-gray-400 group-hover:text-purple-500" size={20} />
                )}
              </button>

              {openIndex === i && (
                <div className="pb-4 text-sm text-gray-400 leading-relaxed animate-in fade-in slide-in-from-top-2 duration-300">
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