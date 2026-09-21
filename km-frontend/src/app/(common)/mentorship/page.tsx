"use client";

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, Clock, BookOpen, Users,
  ChevronRight, Award, CheckCircle, ArrowRight, MessageSquare
} from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/axios';

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

  useEffect(() => {
    fetchMentorships();
  }, [selectedCategory]);

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

  return (
    <main className="min-h-screen bg-[#fafafa] pb-20">
      {/* Hero Section */}
      <section className="bg-linear-to-br from-slate-950 via-[#0a1128] to-[#1a2b8c] text-white py-16 md:py-24 px-6 md:px-12 rounded-b-[40px] md:rounded-b-[60px] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center md:text-left max-w-3xl"
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 text-xs font-bold uppercase tracking-wider text-orange-400 mb-4 border border-white/10 backdrop-blur-xs">
              <span>Verified Industry Guidance</span>
            </div>
            <h1 className="text-3xl md:text-6xl font-black mb-4 md:mb-6 leading-tight">
              Unlock Your Potential with <br className="hidden md:block" /> <span className="text-orange-400">Expert Mentorship</span>
            </h1>
            <p className="text-sm md:text-lg text-slate-300 mb-6 md:mb-10 max-w-2xl leading-relaxed">
              Connect with vetted industry leaders and accelerate your career growth with personalized 1-on-1 sessions.
            </p>
            
            <div className="flex flex-col md:flex-row gap-3 md:gap-4 max-w-2xl mx-auto md:mx-0">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search by mentor name or topic..." 
                  className="w-full bg-white text-slate-900 py-3 md:py-4 pl-12 pr-4 rounded-xl md:rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1a2b8c] transition-all font-medium text-sm md:text-base shadow-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button 
                type="button"
                className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 md:py-4 rounded-xl md:rounded-2xl font-bold transition-all shadow-lg shadow-orange-500/20 active:scale-95 whitespace-nowrap text-sm md:text-base cursor-pointer"
              >
                Find My Mentor
              </button>
            </div>
          </motion.div>
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
                  ? 'bg-[#1a2b8c] text-white shadow-xs' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Content */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 py-10 md:py-14">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8 md:mb-10">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900">Featured Mentorships</h2>
            <p className="text-xs md:text-sm text-slate-500 font-medium tracking-tight mt-1">Top-rated experts ready to guide your career forward</p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white rounded-3xl h-[380px] animate-pulse border border-slate-100" />
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
                    Why Choose <span className="text-[#1a2b8c]">KaamMilega Mentors?</span>
                </h2>
                <div className="space-y-4">
                    <BenefitItem 
                        icon={<Award className="text-orange-500" />} 
                        title="Vetted Industry Leaders" 
                        desc="All mentors undergo a screening process to ensure practical, quality guidance." 
                    />
                    <BenefitItem 
                        icon={<MessageSquare className="text-blue-600" />} 
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
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto text-[#1a2b8c]">
                        <Users size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">Are You an Industry Expert?</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Share your knowledge, mentor aspiring candidates, and earn by hosting 1-on-1 sessions.
                    </p>
                    <Link
                      href="/expert/apply"
                      className="inline-block w-full py-3 bg-[#1a2b8c] hover:bg-[#152370] text-white text-xs font-bold rounded-xl transition shadow-xs"
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
               <span className="text-[#1a2b8c] font-black text-lg md:text-xl">{expertInitial}</span>
             )}
          </div>
          <span className="bg-blue-50 text-[#1a2b8c] text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border border-blue-100">
            {mentorship?.category || "Mentorship"}
          </span>
        </div>
 
        <Link href={`/mentorship/${mentorship?.id}`}>
          <h3 className="text-base md:text-lg font-bold text-slate-900 mb-1.5 group-hover:text-[#1a2b8c] transition-colors line-clamp-2 min-h-[44px]">
            {mentorship?.title}
          </h3>
        </Link>
        <p className="text-slate-500 text-xs font-medium mb-4 line-clamp-1">
          By {expertNameClean} • {expert?.headline || "Verified Mentor"}
        </p>
 
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 mt-auto">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Clock size={14} className="text-[#1a2b8c]" />
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
            className="bg-[#1a2b8c] hover:bg-[#152370] text-white px-4 md:px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-xs active:scale-95 flex items-center gap-1.5 cursor-pointer"
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
