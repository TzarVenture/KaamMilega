"use client";
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Calendar, Clock, Edit, Trash2, Check, X,
  ChevronRight, ArrowLeft, User, MessageCircle, Info,
  CheckCircle2, Video, ExternalLink, Wallet, DollarSign,
  AlertCircle, Link2, ArrowUpRight, ShieldCheck
} from 'lucide-react';
import api from '@/lib/axios';
import Link from 'next/link';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface WalletSummary {
  wallet_id: string;
  total_balance: number;
  withdrawable_balance: number;
  main_balance: number;
  earnings_balance: number;
  locked_balance: number;
}

export default function ExpertMentorshipManagement() {
  const [activeTab, setActiveTab] = useState<'sessions' | 'bookings' | 'availability'>('bookings');
  const [mentorships, setMentorships] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [availability, setAvailability] = useState<any[]>([]);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    fetchWallet();
  }, [activeTab]);

  const fetchWallet = async () => {
    try {
      const res: any = await api.get('/wallet/balance');
      setWallet(res);
    } catch (e) {
      console.warn("Could not load wallet stats", e);
    }
  };

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
      <ToastContainer position="top-right" autoClose={3000} theme="colored" />
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-6 md:pt-8">
        
        {/* Header with Quick Wallet & Payout Stats */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 md:mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-purple-100 text-purple-700 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                Expert Monetisation Portal
              </span>
            </div>
            <h1 className="text-xl md:text-3xl font-black text-gray-900 mb-0.5 md:mb-1">Mentor Dashboard</h1>
            <p className="text-[11px] md:text-sm text-gray-500 font-medium">Manage booked 1-on-1 sessions, release completed escrow earnings, and track payouts.</p>
          </div>

          {/* Quick Wallet Stats Widget */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {wallet && (
              <div className="flex items-center gap-4 bg-white border border-gray-200/80 rounded-2xl px-4 py-2.5 shadow-sm">
                <div>
                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Withdrawable Earnings</div>
                  <div className="text-base md:text-lg font-black text-emerald-600">₹{wallet.withdrawable_balance?.toLocaleString('en-IN') || 0}</div>
                </div>
                <div className="h-7 w-[1px] bg-gray-100" />
                <div>
                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">In Escrow (Held)</div>
                  <div className="text-base md:text-lg font-black text-blue-600">₹{wallet.locked_balance?.toLocaleString('en-IN') || 0}</div>
                </div>
              </div>
            )}

            <Link 
              href="/wallet"
              className="bg-km-primary hover:bg-km-primary-dark text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-md flex items-center gap-1.5 text-xs md:text-sm whitespace-nowrap"
            >
              <Wallet size={16} /> Wallet & Payouts (F71) <ArrowUpRight size={14} />
            </Link>

            {activeTab === 'sessions' && (
              <button className="bg-purple-600 hover:bg-purple-700 text-white px-4 md:px-5 py-2.5 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2 text-xs md:text-sm">
                <Plus size={16} /> Create Session
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-5 md:mb-6 overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
          {[
            { id: 'bookings', label: 'Booked Sessions', icon: <User size={14} />, count: bookings.length },
            { id: 'sessions', label: 'My Sessions', icon: <Plus size={14} />, count: mentorships.length },
            { id: 'availability', label: 'Availability Hours', icon: <Calendar size={14} /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3 md:px-6 py-2.5 md:py-3 font-black transition-all relative text-xs md:text-sm whitespace-nowrap ${
                activeTab === tab.id ? 'text-purple-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab.icon} {tab.label}
              {tab.count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {tab.count}
                </span>
              )}
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
            {activeTab === 'bookings' && <BookingsList bookings={bookings} onUpdate={() => { fetchData(); fetchWallet(); }} />}
            {activeTab === 'sessions' && <SessionsList mentorships={mentorships} />}
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
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [meetingModalBooking, setMeetingModalBooking] = useState<any | null>(null);
  const [meetingUrlInput, setMeetingUrlInput] = useState('');
  const [isSavingMeeting, setIsSavingMeeting] = useState(false);

  const handleStatus = async (booking: any, status: string) => {
    try {
      setActionLoadingId(booking.id);
      await api.patch(`/mentorships/bookings/${booking.id}/status?status=${status}`);
      if (status === 'completed') {
        toast.success(`🎉 Session Completed! ₹${booking.amount || 0} has been released from escrow into your Wallet Earnings!`);
      } else if (status === 'confirmed') {
        toast.success("Session confirmed! Candidate has been notified.");
      } else if (status === 'cancelled') {
        toast.info("Session cancelled. Escrow payment was safely refunded to the candidate.");
      }
      onUpdate();
    } catch (e: any) {
      const msg = e?.response?.data?.error || e.message || "Status update failed";
      toast.error(`Error: ${msg}`);
      console.error("Status update failed", e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSaveMeetingLink = async () => {
    if (!meetingModalBooking) return;
    try {
      setIsSavingMeeting(true);
      await api.patch(`/mentorships/bookings/${meetingModalBooking.id}/meeting-link`, {
        meeting_link: meetingUrlInput.trim()
      });
      toast.success("Meeting link updated successfully!");
      setMeetingModalBooking(null);
      onUpdate();
    } catch (e: any) {
      toast.error("Failed to update meeting link");
    } finally {
      setIsSavingMeeting(false);
    }
  };

  if (bookings.length === 0) {
    return (
      <div className="bg-white p-12 md:p-20 text-center rounded-2xl md:rounded-[32px] border border-dashed border-gray-200">
        <div className="w-12 h-12 md:w-16 md:h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
          <User className="text-gray-300" size={24} />
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-2">No Bookings Yet</h3>
        <p className="text-xs md:text-sm text-gray-500 max-w-xs mx-auto">When candidates book sessions with you, they will appear here. Funds are held in Escrow until you complete the call.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {bookings.map((b, i) => {
        const isCompleted = b.status === 'completed';
        const isConfirmed = b.status === 'confirmed';
        const isPending = b.status === 'pending';
        const isCancelled = b.status === 'cancelled';
        const isLoading = actionLoadingId === b.id;

        return (
          <div key={b.id || i} className="bg-white p-4 md:p-5 rounded-xl md:rounded-2xl border border-gray-100 shadow-sm hover:border-purple-100 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Left: Mentee & Session info */}
            <div className="flex gap-3.5 items-start">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shrink-0 font-black text-sm">
                {b.mentee_name ? b.mentee_name.charAt(0).toUpperCase() : <User size={20} />}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {b.mentorship_title || '1-on-1 Mentorship'}
                  </span>
                  
                  {/* Status Pill */}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    isCompleted ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    isConfirmed ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                    isPending ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {b.status}
                  </span>
                </div>

                <h4 className="font-bold text-gray-900 text-sm md:text-base">
                  {b.mentee_name || 'Candidate Booking'}
                </h4>
                {b.mentee_email && (
                  <p className="text-[11px] text-gray-500 font-medium">{b.mentee_email}</p>
                )}
                
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-gray-500">
                  <span className="flex items-center gap-1 font-medium">
                    <Calendar size={12} className="text-gray-400" />
                    {new Date(b.scheduled_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                  
                  <span className="flex items-center gap-1 font-bold text-emerald-600">
                    <ShieldCheck size={13} />
                    ₹{b.amount || 0} {isCompleted ? 'Credited to Earnings' : 'Held in Escrow'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex flex-wrap items-center justify-between md:justify-end gap-2.5 pt-3 md:pt-0 border-t md:border-t-0 border-gray-100">
              
              {/* Meeting Link Button */}
              {b.meeting_link ? (
                <a 
                  href={b.meeting_link.startsWith('http') ? b.meeting_link : `https://${b.meeting_link}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-purple-50 hover:bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border border-purple-200"
                >
                  <Video size={13} /> Join Meeting <ExternalLink size={11} />
                </a>
              ) : (
                isConfirmed && (
                  <button
                    onClick={() => {
                      setMeetingModalBooking(b);
                      setMeetingUrlInput('');
                    }}
                    className="text-gray-500 hover:text-purple-600 text-xs font-bold px-2.5 py-1.5 rounded-lg hover:bg-gray-50 border border-dashed border-gray-300 flex items-center gap-1"
                  >
                    <Link2 size={13} /> Add Meet Link
                  </button>
                )
              )}

              {/* Status Actions */}
              {isPending && (
                <div className="flex gap-2">
                  <button 
                    disabled={isLoading}
                    onClick={() => handleStatus(b, 'confirmed')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all shadow-sm disabled:opacity-50"
                  >
                    <Check size={14} /> Accept
                  </button>
                  <button 
                    disabled={isLoading}
                    onClick={() => handleStatus(b, 'cancelled')}
                    className="bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                  >
                    <X size={14} /> Decline
                  </button>
                </div>
              )}

              {isConfirmed && (
                <div className="flex items-center gap-2">
                  <button 
                    disabled={isLoading}
                    onClick={() => handleStatus(b, 'completed')}
                    className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <CheckCircle2 size={14} />
                    )}
                    Mark Completed & Release ₹{b.amount}
                  </button>
                  
                  <button 
                    disabled={isLoading}
                    onClick={() => {
                      if (confirm("Are you sure you want to cancel? The mentee will receive an automatic wallet refund.")) {
                        handleStatus(b, 'cancelled');
                      }
                    }}
                    className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg transition-colors"
                    title="Cancel Session & Refund"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {isCompleted && (
                <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                  <CheckCircle2 size={14} /> ₹{b.amount} Released to Earnings
                </div>
              )}

              {isCancelled && (
                <span className="text-xs font-bold text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg">
                  Refunded
                </span>
              )}

            </div>
          </div>
        );
      })}

      {/* Meeting Link Modal */}
      {meetingModalBooking && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100"
          >
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Video size={16} />
                </div>
                <h3 className="font-black text-gray-900 text-base">Add Meeting Link</h3>
              </div>
              <button onClick={() => setMeetingModalBooking(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={18} />
              </button>
            </div>
            
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Paste your Google Meet, Zoom, or Teams video call link. The mentee will see this link on their session card.
            </p>

            <input 
              type="url" 
              placeholder="https://meet.google.com/abc-defg-hij" 
              value={meetingUrlInput}
              onChange={(e) => setMeetingUrlInput(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-600 mb-5 font-mono"
            />

            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setMeetingModalBooking(null)}
                className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button 
                disabled={isSavingMeeting || !meetingUrlInput.trim()}
                onClick={handleSaveMeetingLink}
                className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md disabled:opacity-50"
              >
                {isSavingMeeting ? "Saving..." : "Save Link"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
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
