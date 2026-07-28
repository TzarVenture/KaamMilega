"use client";
import { useEffect, useState, use } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Star, Clock, Calendar, CheckCircle, ChevronLeft, 
  MapPin, Award, BookOpen, Users, Play, CalendarDays,
  ShieldCheck, Info, MessageCircle, AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/axios';
import { useRouter } from 'next/navigation';

export default function MentorshipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [availability, setAvailability] = useState<any[]>([]);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const res: any = await api.get(`/mentorships/${id}`);
      setData(res);
      
      // Fetch availability for the expert
      if (res.expert.id) {
          const availRes: any = await api.get(`/mentorships/expert/${res.expert.id}/availability`);
          setAvailability(Array.isArray(availRes) ? availRes : availRes.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch details", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = async () => {
    if (!selectedDate || !selectedSlot) {
        alert("Please select a date and time slot");
        return;
    }

    try {
        setBookingLoading(true);
        const scheduledAt = new Date(selectedDate);
        const [hours, minutes] = selectedSlot.split(':');
        scheduledAt.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        await api.post('/mentorships/book', {
            mentorship_id: id,
            scheduled_at: scheduledAt.toISOString(),
            notes: notes
        });

        alert("Booking successful! Redirecting to your bookings...");
        router.push('/applications'); // Or wherever bookings are shown
    } catch (error: any) {
        alert(error.message || "Failed to book session. Please try again.");
    } finally {
        setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return <div className="p-20 text-center">Mentorship not found</div>;

  const { mentorship, expert } = data;

  return (
    <main className="min-h-screen bg-[#fafafa] pb-10 md:pb-20">
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-6 md:pt-10">
        <Link href="/mentorship" className="inline-flex items-center gap-2 text-gray-500 hover:text-purple-600 font-bold mb-6 md:mb-8 transition-all text-sm md:text-base">
          <ChevronLeft size={18} className="md:w-5 md:h-5" /> Back to Mentorships
        </Link>
        
        <div className="flex flex-col lg:flex-row gap-6 md:gap-8 lg:gap-12">
          {/* Main Content */}
          <div className="lg:flex-1 space-y-6 md:space-y-10">
            {/* Header Card */}
            <div className="bg-white rounded-2xl md:rounded-[40px] p-6 md:p-12 shadow-sm border border-gray-50 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 md:p-12 opacity-5 pointer-events-none">
                    <AwardsBackground />
                </div>
                
                <div className="flex flex-wrap items-center gap-3 md:gap-4 mb-6 md:mb-8">
                   <div className="bg-purple-100 text-purple-600 text-[9px] md:text-[10px] font-black uppercase tracking-widest px-3 md:px-4 py-1 md:py-1.5 rounded-full">
                     {mentorship.category}
                   </div>
                   <div className="flex items-center gap-1 text-yellow-500">
                     <Star size={12} className="md:w-3.5 md:h-3.5 fill-yellow-500" />
                     <span className="text-[10px] md:text-xs font-black">4.9 (120+ Reviews)</span>
                   </div>
                </div>

                <h1 className="text-2xl md:text-5xl font-black text-gray-900 mb-4 md:mb-6 leading-tight">
                  {mentorship.title}
                </h1>

                <div className="flex flex-wrap gap-4 md:gap-10">
                    <InfoItem icon={<Clock className="text-purple-500" size={18} />} label="Duration" value={`${mentorship.duration} Mins`} />
                    <InfoItem icon={<Users className="text-blue-500" size={18} />} label="Type" value="1-on-1 Session" />
                    <InfoItem icon={<MessageCircle className="text-green-500" size={18} />} label="Language" value="Hindi / English" />
                </div>
            </div>

            {/* About the Session */}
            <div className="bg-white rounded-2xl md:rounded-[40px] p-6 md:p-12 shadow-sm border border-gray-50">
               <h2 className="text-xl md:text-2xl font-black text-gray-900 mb-6 md:mb-8">About the Mentorship Session</h2>
               <div className="prose prose-purple prose-sm md:prose-base max-w-none text-gray-500 font-medium leading-relaxed">
                  <p>{mentorship.description}</p>
                  <h4 className="text-gray-900 font-black mt-6 md:mt-8 mb-3 md:mb-4">What you will learn:</h4>
                  <ul className="space-y-3 md:space-y-4">
                     {[
                        "Personalized career roadmap and strategy",
                        "In-depth industry insights and best practices",
                        "Preparation tips for interviews and challenges",
                        "Direct feedback on your profile and skills"
                     ].map((item, i) => (
                        <li key={i} className="flex gap-2 md:gap-3 items-start">
                           <CheckCircle size={16} className="text-green-500 shrink-0 mt-1 md:w-4.5 md:h-4.5" />
                           <span className="text-sm md:text-base">{item}</span>
                        </li>
                     ))}
                  </ul>
               </div>
            </div>

            {/* About the Mentor */}
            <div className="bg-[#1e1b4b] text-white rounded-2xl md:rounded-[40px] p-6 md:p-12 shadow-2xl relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
                
                <h2 className="text-xl md:text-2xl font-black mb-6 md:mb-10 relative z-10">Meet Your Mentor</h2>
                <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start relative z-10">
                    <div className="w-20 h-20 md:w-32 md:h-32 bg-white rounded-2xl md:rounded-3xl overflow-hidden shrink-0 border-4 border-white/10 shadow-xl">
                       {expert.profile_image ? (
                           <img src={expert.profile_image} alt={expert.name} className="w-full h-full object-cover" />
                       ) : (
                           <div className="w-full h-full bg-indigo-900 flex items-center justify-center text-2xl md:text-3xl font-black">{expert.name[0]}</div>
                       )}
                    </div>
                    <div>
                        <h3 className="text-xl md:text-2xl font-black mb-1 md:mb-2">{expert.name}</h3>
                        <p className="text-indigo-200 font-bold mb-4 md:mb-6 italic text-sm md:text-base">{expert.headline || "Industry Professional"}</p>
                        <p className="text-indigo-100 opacity-80 leading-relaxed mb-4 md:mb-6 text-sm md:text-base">
                            {expert.bio || "An experienced professional dedicated to helping others navigate their career paths and achieve professional excellence."}
                        </p>
                        <div className="flex flex-wrap gap-2 md:gap-4">
                            <span className="flex items-center gap-1.5 md:gap-2 bg-white/10 px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[10px] md:text-xs font-bold border border-white/10">
                                <Award size={12} className="text-yellow-400 md:w-3.5 md:h-3.5" /> Top Mentor 2024
                            </span>
                            <span className="flex items-center gap-1.5 md:gap-2 bg-white/10 px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[10px] md:text-xs font-bold border border-white/10">
                                <ShieldCheck size={12} className="text-blue-400 md:w-3.5 md:h-3.5" /> Verified Expert
                            </span>
                        </div>
                    </div>
                </div>
            </div>
          </div>

          {/* Sidebar - Booking */}
          <div className="lg:w-[400px] space-y-6 md:space-y-8">
            <div className="bg-white rounded-2xl md:rounded-[40px] p-6 md:p-8 shadow-2xl shadow-purple-900/10 border border-purple-50 lg:sticky lg:top-10">
                <div className="mb-6 md:mb-8">
                    <span className="text-[10px] md:text-xs text-gray-400 font-black uppercase block mb-1">Session Fee</span>
                    <div className="flex items-baseline gap-1.5 md:gap-2">
                        <span className="text-3xl md:text-4xl font-black text-gray-900">₹{mentorship.price}</span>
                        <span className="text-gray-400 font-bold text-sm md:text-base">/ session</span>
                    </div>
                </div>

                <div className="space-y-5 md:space-y-6">
                    <div>
                        <label className="text-[10px] md:text-xs font-black text-gray-900 uppercase mb-2 md:mb-3 flex items-center gap-2">
                           <CalendarDays size={14} className="text-purple-600" /> Select Date
                        </label>
                        <div className="grid grid-cols-4 gap-1.5 md:gap-2">
                            {/* Simple Date Mock - typically you'd use a calendar library */}
                            {[0, 1, 2, 3, 4, 5, 6, 7].map(i => {
                                const d = new Date();
                                d.setDate(d.getDate() + i);
                                const isSelected = selectedDate?.toDateString() === d.toDateString();
                                return (
                                    <button 
                                        key={i}
                                        onClick={() => setSelectedDate(d)}
                                        className={`flex flex-col items-center p-1.5 md:p-2 rounded-xl md:rounded-2xl border transition-all ${
                                            isSelected ? 'bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-200' : 'bg-gray-50 border-gray-100 text-gray-500 hover:border-purple-200'
                                        }`}
                                    >
                                        <span className="text-[8px] md:text-[10px] font-bold uppercase">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                                        <span className="text-base md:text-lg font-black">{d.getDate()}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] md:text-xs font-black text-gray-900 uppercase mb-2 md:mb-3 flex items-center gap-2">
                           <Clock size={14} className="text-purple-600" /> Select Time Slot
                        </label>
                        <div className="grid grid-cols-3 gap-1.5 md:gap-2">
                            {availability.length > 0 ? availability.map((a, i) => (
                                <button 
                                    key={i}
                                    onClick={() => setSelectedSlot(a.start_time)}
                                    className={`py-1.5 md:py-2 px-1 rounded-lg md:rounded-xl text-center text-[10px] md:text-xs font-bold border transition-all ${
                                        selectedSlot === a.start_time ? 'bg-purple-600 border-purple-600 text-white' : 'bg-gray-50 border-gray-100 text-gray-500 hover:border-purple-200'
                                    }`}
                                >
                                    {a.start_time}
                                </button>
                            )) : (
                                ["10:00", "11:00", "14:00", "15:00", "16:00", "17:00"].map(t => (
                                    <button 
                                        key={t}
                                        onClick={() => setSelectedSlot(t)}
                                        className={`py-1.5 md:py-2 px-1 rounded-lg md:rounded-xl text-center text-[10px] md:text-xs font-bold border transition-all ${
                                            selectedSlot === t ? 'bg-purple-600 border-purple-600 text-white' : 'bg-gray-50 border-gray-100 text-gray-500 hover:border-purple-200'
                                        }`}
                                    >
                                        {t}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] md:text-xs font-black text-gray-900 uppercase mb-2 md:mb-3">
                           Add Notes <span className="text-gray-400 font-medium">(Optional)</span>
                        </label>
                        <textarea 
                            className="w-full bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl p-3 md:p-4 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-medium min-h-[80px] md:min-h-[100px]"
                            placeholder="What do you want to discuss?"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>

                    <button 
                        onClick={handleBooking}
                        disabled={bookingLoading}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 md:py-5 rounded-2xl md:rounded-3xl font-black transition-all shadow-xl shadow-purple-900/10 active:scale-95 disabled:opacity-50 disabled:pointer-events-none mt-2 md:mt-4 text-sm md:text-base"
                    >
                        {bookingLoading ? "Booking..." : "Book Session Now"}
                    </button>
                    
                    <p className="text-[9px] md:text-[10px] text-gray-400 font-bold text-center">
                        <AlertCircle size={10} className="inline mr-1" /> No hidden charges, cancel anytime before 24h.
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-2xl md:rounded-[40px] p-6 shadow-sm border border-gray-50 overflow-hidden relative">
                <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0">
                        <ShieldCheck size={20} className="text-blue-600 md:w-6 md:h-6" />
                    </div>
                    <div>
                        <h4 className="font-black text-gray-900 text-xs md:text-sm">Safe & Secure</h4>
                        <p className="text-[10px] md:text-xs text-gray-500 font-medium tracking-tight">Your payments and data are always protected.</p>
                    </div>
                </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
    return (
        <div className="flex gap-3 md:gap-4">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-gray-50 rounded-lg md:rounded-xl flex items-center justify-center shrink-0">
                {icon}
            </div>
            <div>
                <p className="text-[8px] md:text-[10px] text-gray-400 font-black uppercase tracking-widest leading-none mb-1">{label}</p>
                <p className="text-xs md:text-sm font-black text-gray-900">{value}</p>
            </div>
        </div>
    );
}

function AwardsBackground() {
    return (
        <svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M100 0L122.451 69.0983H195.106L136.327 111.803L158.779 180.902L100 138.197L41.2215 180.902L63.6733 111.803L4.89435 69.0983H77.5486L100 0Z" fill="white"/>
        </svg>
    );
}
