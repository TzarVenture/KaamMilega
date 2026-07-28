"use client";
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, Filter, Star, Clock, Calendar, 
  ChevronRight, Award, BookOpen, Users,
  CheckCircle, ArrowRight, MessageSquare
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
      setMentorships(Array.isArray(res) ? res : res.data || []);
    } catch (error) {
      console.error("Failed to fetch mentorships", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMentorships = mentorships.filter(m => 
    m.mentorship.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.expert.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-[#fafafa] pb-20">
      {/* Hero Section */}
      <section className="bg-[#1e1b4b] text-white py-16 md:py-24 px-6 md:px-12 rounded-b-[40px] md:rounded-b-[80px] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center md:text-left max-w-3xl"
          >
            <h1 className="text-3xl md:text-6xl font-black mb-4 md:mb-6 leading-tight">
              Unlock Your Potential with <br className="hidden md:block" /> <span className="text-purple-400">Expert Mentorship</span>
            </h1>
            <p className="text-sm md:text-xl text-indigo-100 mb-6 md:mb-10 opacity-90 max-w-2xl">
              Connect with industry leaders and accelerate your career growth with personalize 1-on-1 sessions.
            </p>
            
            <div className="flex flex-col md:flex-row gap-3 md:gap-4 max-w-2xl mx-auto md:mx-0">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search by mentor or topic..." 
                  className="w-full bg-white text-gray-900 py-3 md:py-4 pl-12 pr-4 rounded-xl md:rounded-3xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-medium text-sm md:text-base"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 md:py-4 rounded-xl md:rounded-3xl font-bold transition-all shadow-xl shadow-purple-900/20 active:scale-95 whitespace-nowrap text-sm md:text-base">
                Find My Mentor
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Category Tabs */}
      <section className="max-w-7xl mx-auto px-6 -mt-8 relative z-20">
        <div className="bg-white p-2 rounded-[24px] md:rounded-[40px] shadow-xl shadow-black/5 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-6 py-3 rounded-full font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat 
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-200' 
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Content */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8 md:mb-10">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-gray-900">Featured Mentorships</h2>
            <p className="text-xs md:text-base text-gray-500 font-medium tracking-tight">Top-rated experts ready to guide you</p>
          </div>
          <button className="flex items-center gap-2 text-purple-600 text-sm md:text-base font-bold hover:gap-3 transition-all shrink-0">
            View All <ArrowRight size={18} />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white rounded-[32px] h-[400px] animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : filteredMentorships.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredMentorships.map((m, i) => (
              <MentorshipCard key={m.mentorship.id || i} data={m} index={i} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-[40px] border border-dashed border-gray-200">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen className="text-gray-300" size={40} />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">No Mentorships Found</h3>
            <p className="text-gray-500 max-w-xs mx-auto">Try adjusting your filters or search query to find what you're looking for.</p>
          </div>
        )}
      </section>

      {/* Benefits Section */}
      <section className="max-w-7xl mx-auto px-6 pb-20">
        <div className="bg-[#f0f9ff] rounded-[40px] p-8 md:p-16 flex flex-col md:flex-row items-center gap-12 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                <Users size={300} />
            </div>
            <div className="md:w-1/2">
                <h2 className="text-3xl md:text-5xl font-black text-blue-900 mb-8 leading-tight">
                    Why Choose <span className="text-blue-600">Our Experts?</span>
                </h2>
                <div className="space-y-6">
                    <BenefitItem 
                        icon={<Award className="text-orange-500" />} 
                        title="Vetted Industry Leaders" 
                        desc="All mentors undergo a rigorous screening process to ensure quality guidance." 
                    />
                    <BenefitItem 
                        icon={<MessageSquare className="text-blue-500" />} 
                        title="Interactive Sessions" 
                        desc="Engage in meaningful conversations, get answers to your specific questions." 
                    />
                    <BenefitItem 
                        icon={<CheckCircle className="text-green-500" />} 
                        title="Practical Insights" 
                        desc="Learn real-world strategies and avoid common career pitfalls." 
                    />
                </div>
            </div>
            <div className="md:w-1/2 relative">
                <div className="w-full aspect-square bg-white rounded-[40px] shadow-2xl overflow-hidden p-4 rotate-3">
                   <div className="w-full h-full bg-blue-100 rounded-[32px] flex items-center justify-center text-blue-300">
                        <Users size={120} />
                   </div>
                </div>
                <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-3xl shadow-xl -rotate-6 hidden md:block">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                            <Star className="text-green-600 fill-green-600" size={20} />
                        </div>
                        <div>
                            <p className="font-black text-gray-800">4.9/5 Rating</p>
                            <p className="text-xs text-gray-400 font-bold">BY 1000+ STUDENTS</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </section>
    </main>
  );
}

function MentorshipCard({ data, index }: { data: any, index: number }) {
  const { mentorship, expert } = data;
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="bg-white rounded-[32px] overflow-hidden shadow-[0_10px_40px_-15px_rgba(0,0,0,0.05)] border border-gray-50 flex flex-col group hover:shadow-2xl hover:shadow-purple-500/10 transition-all duration-500 hover:-translate-y-2"
    >
      <div className="p-6 md:p-8 pb-4">
        <div className="flex justify-between items-start mb-4 md:mb-6">
          <div className="w-12 h-12 md:w-16 md:h-16 bg-purple-50 rounded-xl md:rounded-2xl flex items-center justify-center overflow-hidden border-2 border-white shadow-sm transition-transform group-hover:scale-110 duration-500">
             {expert.profile_image ? (
               <img src={expert.profile_image} alt={expert.name} className="w-full h-full object-cover" />
             ) : (
               <span className="text-purple-600 font-black text-xl md:text-2xl">{expert.name[0]}</span>
             )}
          </div>
          <div className="bg-purple-50 text-purple-600 text-[9px] md:text-[10px] font-black uppercase tracking-wider px-2 md:px-3 py-1 rounded-full">
            {mentorship.category}
          </div>
        </div>
 
        <Link href={`/mentorship/${mentorship.id}`}>
          <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2 group-hover:text-purple-600 transition-colors line-clamp-2 min-h-[44px] md:min-h-[56px]">
            {mentorship.title}
          </h3>
        </Link>
        <p className="text-gray-500 text-[10px] md:text-sm font-medium mb-4 md:mb-6 line-clamp-2">
          {expert.headline || "Industry Expert"}
        </p>
 
        <div className="grid grid-cols-2 gap-3 md:gap-4 pt-4 md:pt-6 border-t border-gray-50">
          <div className="flex items-center gap-2 text-gray-400">
            <Clock size={16} />
            <span className="text-[9px] md:text-xs font-bold uppercase tracking-tight">{mentorship.duration} Mins</span>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <Users size={16} />
            <span className="text-[9px] md:text-xs font-bold uppercase tracking-tight">1-on-1 Session</span>
          </div>
        </div>
      </div>
 
      <div className="p-6 md:p-8 mt-auto flex items-center justify-between bg-gray-50/50">
        <div>
          <span className="text-[9px] md:text-xs text-gray-400 font-bold uppercase block mb-0.5 md:mb-1">Starting from</span>
          <span className="text-xl md:text-2xl font-black text-gray-900">₹{mentorship.price}</span>
        </div>
        <Link href={`/mentorship/${mentorship.id}`}>
          <button className="bg-purple-600 hover:bg-purple-700 text-white px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl font-black text-xs md:text-sm transition-all shadow-lg shadow-purple-200 active:scale-95 group/btn flex items-center gap-1.5 md:gap-2">
            Book <span className="hidden sm:inline">Now</span> <ChevronRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
          </button>
        </Link>
      </div>
    </motion.div>
  );
}

function BenefitItem({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
    return (
        <div className="flex gap-4 p-4 rounded-3xl hover:bg-white/50 transition-colors">
            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center shrink-0">
                {icon}
            </div>
            <div>
                <h4 className="font-black text-gray-900 mb-1">{title}</h4>
                <p className="text-sm text-gray-500 font-medium leading-relaxed">{desc}</p>
            </div>
        </div>
    );
}
