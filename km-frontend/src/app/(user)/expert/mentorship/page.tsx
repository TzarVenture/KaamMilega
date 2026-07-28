"use client";
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Calendar, Clock, Edit, Trash2, Check, X,
  ChevronRight, ArrowLeft, User, MessageCircle, Info
} from 'lucide-react';
import api from '@/lib/axios';
import Link from 'next/link';

export default function ExpertMentorshipManagement() {
  const [activeTab, setActiveTab] = useState<'sessions' | 'availability' | 'bookings'>('sessions');
  const [mentorships, setMentorships] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [availability, setAvailability] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'sessions') {
        const res: any = await api.get('/mentorships/expert/my');
        setMentorships(res || []);
      } else if (activeTab === 'bookings') {
        const res: any = await api.get('/mentorships/bookings/expert');
        setBookings(res || []);
      } else if (activeTab === 'availability') {
        const res: any = await api.get('/mentorships/availability');
        setAvailability(res || []);
      }
    } catch (error) {
      console.error("Failed to fetch expert data", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fafafa] pb-20">
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-6 md:pt-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6 mb-6 md:mb-8">
          <div>
            <h1 className="text-xl md:text-3xl font-black text-gray-900 mb-0.5 md:mb-1">Mentor Dashboard</h1>
            <p className="text-[10px] md:text-sm text-gray-500 font-medium">Manage your sessions, availability, and bookings.</p>
          </div>
          {activeTab === 'sessions' && (
             <button className="w-full md:w-auto bg-purple-600 hover:bg-purple-700 text-white px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl font-black transition-all shadow-xl shadow-purple-900/10 active:scale-95 flex items-center justify-center gap-2 text-xs md:text-sm">
                <Plus size={16} className="md:w-4 md:h-4" /> Create New Session
             </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-5 md:mb-6 overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
            {[
                { id: 'sessions', label: 'My Sessions', icon: <Plus size={14} /> },
                { id: 'bookings', label: 'Bookings', icon: <User size={14} /> },
                { id: 'availability', label: 'Availability', icon: <Calendar size={14} /> }
            ].map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-3 md:px-6 py-2.5 md:py-3 font-black transition-all relative text-xs md:text-sm whitespace-nowrap ${
                        activeTab === tab.id ? 'text-purple-600' : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                    {tab.icon} {tab.label}
                    {activeTab === tab.id && (
                        <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 rounded-full" />
                    )}
                </button>
            ))}
        </div>

        {loading ? (
            <div className="flex items-center justify-center py-20">
                <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
        ) : (
            <div className="min-h-[400px]">
                {activeTab === 'sessions' && <SessionsList mentorships={mentorships} />}
                {activeTab === 'bookings' && <BookingsList bookings={bookings} onUpdate={fetchData} />}
                {activeTab === 'availability' && <AvailabilityManager availability={availability} />}
            </div>
        )}
      </div>
    </main>
  );
}

function SessionsList({ mentorships }: { mentorships: any[] }) {
    if (mentorships.length === 0) {
        return (
            <div className="bg-white p-12 md:p-20 text-center rounded-2xl md:rounded-[32px] border border-dashed border-gray-200">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
                    <Plus className="text-gray-300" size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">No Mentorship Sessions</h3>
                <p className="text-xs md:text-sm text-gray-500 mb-6 md:mb-8 max-w-xs mx-auto">Create your first session to start helping others and growing your professional network.</p>
                <button className="text-purple-600 text-xs md:text-sm font-bold border border-purple-200 px-5 py-2 rounded-full hover:bg-purple-50">Create Now</button>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {mentorships.map((m, i) => (
                <div key={m.id || i} className="bg-white p-5 md:p-6 rounded-xl md:rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="bg-purple-50 text-purple-600 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">{m.category}</div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-blue-500 transition-colors"><Edit size={14} /></button>
                            <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                        </div>
                    </div>
                    <h3 className="text-base md:text-lg font-bold text-gray-900 mb-3 md:mb-4">{m.title}</h3>
                    <div className="flex items-center justify-between pt-3 md:pt-4 border-t border-gray-50">
                        <div className="flex items-center gap-1.5 text-gray-400 text-[10px] font-bold uppercase">
                            <Clock size={12} /> {m.duration} Mins
                        </div>
                        <div className="text-base md:text-lg font-black text-gray-900">₹{m.price}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function BookingsList({ bookings, onUpdate }: { bookings: any[], onUpdate: () => void }) {
    const handleStatus = async (bookingID: string, status: string) => {
        try {
            await api.patch(`/mentorships/bookings/${bookingID}/status?status=${status}`);
            onUpdate();
        } catch (e) {
            console.error("Status update failed", e);
        }
    };

    if (bookings.length === 0) {
        return (
            <div className="bg-white p-12 md:p-20 text-center rounded-2xl md:rounded-[32px] border border-dashed border-gray-200">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
                    <User className="text-gray-300" size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">No Bookings Yet</h3>
                <p className="text-xs md:text-sm text-gray-500 max-w-xs mx-auto">When users book sessions with you, they will appear here for you to manage.</p>
            </div>
        );
    }

    return (
        <div className="space-y-2 md:space-y-3">
            {bookings.map((b, i) => (
                <div key={b.id || i} className="bg-white p-4 md:p-5 rounded-xl md:rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
                    <div className="flex gap-3 items-center">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-gray-50 rounded-lg md:rounded-xl flex items-center justify-center shrink-0">
                            <User className="text-gray-400" size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <span className="text-[8px] md:text-[9px] text-gray-400 font-bold uppercase tracking-wider block mb-0.5">Session Invitation</span>
                            <h4 className="font-bold text-gray-900 text-xs md:text-sm truncate">Session: {b.id?.substring(0, 8)}...</h4>
                            <p className="text-[9px] md:text-[10px] text-gray-500 font-medium">Scheduled: {new Date(b.scheduled_at).toLocaleString()}</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-3 md:gap-4 pt-2 md:pt-0 border-t md:border-t-0 border-gray-50">
                        <div className={`px-2.5 md:px-3 py-1 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest ${
                            b.status === 'confirmed' ? 'bg-green-100 text-green-600' :
                            b.status === 'pending' ? 'bg-orange-100 text-orange-600' :
                            'bg-gray-100 text-gray-600'
                        }`}>
                            {b.status}
                        </div>
                        
                        {b.status === 'pending' && (
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => handleStatus(b.id, 'confirmed')}
                                    className="w-8 h-8 md:w-9 md:h-9 bg-green-500 text-white rounded-lg flex items-center justify-center hover:bg-green-600 transition-colors shadow-lg shadow-green-200"
                                >
                                    <Check size={16} />
                                </button>
                                <button 
                                    onClick={() => handleStatus(b.id, 'cancelled')}
                                    className="w-8 h-8 md:w-9 md:h-9 bg-red-500 text-white rounded-lg flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg shadow-red-200"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        )}
                        
                        <button className="flex items-center gap-1.5 text-gray-400 hover:text-purple-600 font-black text-[10px] md:text-xs transition-colors">
                            Details <ChevronRight size={12} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}

function AvailabilityManager({ availability }: { availability: any[] }) {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    return (
        <div className="bg-white p-5 md:p-8 rounded-xl md:rounded-2xl border border-gray-50 shadow-sm max-w-3xl">
            <h3 className="text-lg md:text-xl font-black text-gray-900 mb-4 md:mb-6">Weekly Availability</h3>
            <p className="text-[10px] md:text-xs text-gray-500 mb-6 md:mb-8 font-medium">Define the time slots you're available for sessions. Users book within these hours.</p>

            <div className="space-y-3 md:space-y-4">
                {days.map((day, idx) => (
                    <div key={day} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 pb-3 sm:pb-4 border-b border-gray-50 last:border-0">
                        <div className="sm:w-28 font-bold text-gray-900 text-xs md:text-sm">{day}</div>
                        <div className="flex-1 flex items-center gap-2 md:gap-3">
                            <input type="time" defaultValue="09:00" className="flex-1 sm:flex-none bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 text-[10px] md:text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-medium" />
                            <span className="text-gray-300 text-[10px]">to</span>
                            <input type="time" defaultValue="17:00" className="flex-1 sm:flex-none bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 text-[10px] md:text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-medium" />
                        </div>
                        <div className="flex items-center justify-between sm:justify-start gap-3">
                           <span className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase">Available</span>
                           <div className="w-8 h-4 md:w-10 md:h-5 bg-purple-600 rounded-full relative p-0.5 cursor-pointer">
                              <div className="w-3 h-3 md:w-4 md:h-4 bg-white rounded-full absolute right-0.5" />
                           </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-6 md:mt-10 flex flex-col-reverse sm:flex-row justify-end gap-2 md:gap-3">
                <button className="px-4 md:px-6 py-2 text-[10px] md:text-xs text-gray-400 font-black hover:text-gray-600 transition-all">Discard Changes</button>
                <button className="bg-purple-600 hover:bg-purple-700 text-white px-6 md:px-8 py-2 md:py-2.5 rounded-lg md:rounded-xl font-black transition-all shadow-xl shadow-purple-900/10 active:scale-95 text-xs">
                   Save Availability
                </button>
            </div>
        </div>
    );
}
