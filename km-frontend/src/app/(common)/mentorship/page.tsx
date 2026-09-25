"use client";

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Clock, BookOpen, Users,
  ChevronRight, Award, CheckCircle, ArrowRight, MessageSquare,
  Calendar, Video, ExternalLink, ShieldCheck, Star, AlertCircle, 
  CheckCircle2, X, RefreshCw, User
} from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

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
  const [activeMainTab, setActiveMainTab] = useState<'explore' | 'my-sessions'>('explore');
  const [mentorships, setMentorships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Candidate Bookings State
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [bookingFilter, setBookingFilter] = useState<'all' | 'upcoming' | 'completed' | 'cancelled'>('all');

  // Review Modal State (F45)
  const [reviewModalBooking, setReviewModalBooking] = useState<any | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>("");
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    setIsLoggedIn(!!token);

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'my-sessions' || tabParam === 'bookings' || tabParam === 'my') {
        setActiveMainTab('my-sessions');
      }
    }
  }, []);

  useEffect(() => {
    fetchMentorships();
  }, [selectedCategory]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchMyBookings();
    }
  }, [isLoggedIn, activeMainTab]);

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

  const fetchMyBookings = async () => {
    try {
      setLoadingBookings(true);
      const res: any = await api.get('/mentorships/bookings/my');
      const data = Array.isArray(res) ? res : (res?.data || []);
      setMyBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch my bookings", err);
    } finally {
      setLoadingBookings(false);
    }
  };

  const handleOpenReview = (booking: any) => {
    setReviewModalBooking(booking);
    setReviewRating(5);
    setReviewComment("");
  };

  const handleSubmitReview = async () => {
    if (!reviewModalBooking) return;
    try {
      setSubmittingReview(true);
      const bookingId = reviewModalBooking.id || reviewModalBooking._id;
      await api.post(`/mentorships/bookings/${bookingId}/review`, {
        rating: reviewRating,
        review: reviewComment,
      });

      toast.success("Thank you! Your review has been submitted.");
      setMyBookings(prev => prev.map(b => {
        const bId = b.id || b._id;
        if (bId === bookingId) {
          return { ...b, rating: reviewRating, review: reviewComment };
        }
        return b;
      }));
      setReviewModalBooking(null);
    } catch (err: any) {
      console.error("Failed to submit review", err);
      toast.error(err?.response?.data?.error || "Failed to submit review. Make sure session is completed.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const filteredMentorships = (mentorships || []).filter(m => 
    (m?.mentorship?.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m?.expert?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const upcomingCount = myBookings.filter(b => b.status === 'confirmed' || b.status === 'pending').length;
  const completedCount = myBookings.filter(b => b.status === 'completed').length;
  const cancelledCount = myBookings.filter(b => b.status === 'cancelled').length;

  const filteredBookings = (myBookings || []).filter(b => {
    if (bookingFilter === 'all') return true;
    if (bookingFilter === 'upcoming') return b.status === 'confirmed' || b.status === 'pending';
    if (bookingFilter === 'completed') return b.status === 'completed';
    if (bookingFilter === 'cancelled') return b.status === 'cancelled';
    return true;
  });

  return (
    <main className="min-h-screen bg-[#fafafa] pb-20">
      <ToastContainer position="top-right" autoClose={3000} theme="colored" />

      {/* Hero Section */}
      <section className="bg-linear-to-br from-slate-950 via-[#0a1128] to-[#1a2b8c] text-white py-14 md:py-20 px-6 md:px-12 rounded-b-[40px] md:rounded-b-[60px] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center md:text-left max-w-3xl"
          >
            {/* Main Mode Switcher */}
            <div className="inline-flex items-center gap-2 p-1.5 bg-white/10 backdrop-blur-md rounded-2xl mb-6 border border-white/10">
              <button
                type="button"
                onClick={() => setActiveMainTab('explore')}
                className={`px-4 md:px-5 py-2 rounded-xl font-bold text-xs md:text-sm transition-all flex items-center gap-2 cursor-pointer ${
                  activeMainTab === 'explore'
                    ? 'bg-white text-slate-900 shadow-md'
                    : 'text-white/80 hover:text-white hover:bg-white/5'
                }`}
              >
                <Search size={15} />
                <span>Explore Mentors</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMainTab('my-sessions')}
                className={`px-4 md:px-5 py-2 rounded-xl font-bold text-xs md:text-sm transition-all flex items-center gap-2 cursor-pointer ${
                  activeMainTab === 'my-sessions'
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                    : 'text-white/80 hover:text-white hover:bg-white/5'
                }`}
              >
                <Calendar size={15} />
                <span>My Booked Sessions</span>
                {myBookings.length > 0 && (
                  <span className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                    activeMainTab === 'my-sessions' ? 'bg-white text-orange-600' : 'bg-orange-500 text-white'
                  }`}>
                    {myBookings.length}
                  </span>
                )}
              </button>
            </div>

            {activeMainTab === 'explore' ? (
              <>
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
              </>
            ) : (
              <>
                <h1 className="text-3xl md:text-5xl font-black mb-4 leading-tight">
                  My Booked <span className="text-orange-400">Mentorship Sessions</span>
                </h1>
                <p className="text-sm md:text-base text-slate-300 max-w-2xl leading-relaxed">
                  Track your scheduled 1-on-1 video calls, join meetings, and access escrow-protected sessions.
                </p>
              </>
            )}
          </motion.div>
        </div>
      </section>

      {/* Main View Switching */}
      {activeMainTab === 'explore' ? (
        <>
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

          {/* Featured Mentorships Content */}
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
        </>
      ) : (
        /* My Booked Sessions View */
        <section className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-10">
          {/* Escrow Guarantee Banner */}
          <div className="bg-linear-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/80 rounded-2xl md:rounded-3xl p-4 md:p-6 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-sm md:text-base">100% Escrow-Protected Bookings</h4>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed max-w-2xl">
                  When you book a session, your payment is held securely in escrow. Funds are only transferred to the expert after the session is successfully conducted.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={fetchMyBookings}
              disabled={loadingBookings}
              className="text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <RefreshCw size={13} className={loadingBookings ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Sub Filters */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2 mb-6">
            <button
              onClick={() => setBookingFilter('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                bookingFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              All Sessions ({myBookings.length})
            </button>
            <button
              onClick={() => setBookingFilter('upcoming')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                bookingFilter === 'upcoming'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Upcoming / Confirmed ({upcomingCount})
            </button>
            <button
              onClick={() => setBookingFilter('completed')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                bookingFilter === 'completed'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Completed ({completedCount})
            </button>
            <button
              onClick={() => setBookingFilter('cancelled')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                bookingFilter === 'cancelled'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Cancelled ({cancelledCount})
            </button>
          </div>

          {/* Content States */}
          {!isLoggedIn ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8 shadow-xs max-w-lg mx-auto">
              <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-orange-500">
                <Calendar size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Log In to View Your Sessions</h3>
              <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                Please sign in to your KaamMilega candidate account to view scheduled calls, join video meetings, and manage bookings.
              </p>
              <Link
                href="/login?redirect=/mentorship?tab=my-sessions"
                className="inline-block bg-[#1a2b8c] hover:bg-[#152370] text-white px-6 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md active:scale-95"
              >
                Log In to Your Account
              </Link>
            </div>
          ) : loadingBookings ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white rounded-2xl h-48 animate-pulse border border-slate-200" />
              ))}
            </div>
          ) : filteredBookings.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredBookings.map((booking, idx) => (
                <MyBookingCard 
                  key={booking.id || booking._id || idx} 
                  booking={booking} 
                  onLeaveReview={handleOpenReview}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200 p-8">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="text-slate-400" size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">No Bookings Found</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto mb-6">
                {bookingFilter === 'all' 
                  ? "You haven't booked any mentorship sessions yet. Connect with top industry experts!"
                  : `You have no ${bookingFilter} mentorship sessions.`}
              </p>
              <button
                type="button"
                onClick={() => setActiveMainTab('explore')}
                className="bg-[#1a2b8c] hover:bg-[#152370] text-white px-6 py-2.5 rounded-xl font-bold text-xs transition-all shadow-xs active:scale-95 cursor-pointer"
              >
                Explore Mentors
              </button>
            </div>
          )}
        </section>
      )}

      {/* Leave Review Modal (F45) */}
      <AnimatePresence>
        {reviewModalBooking && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl md:rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl border border-slate-100"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-black text-slate-900">Leave Mentor Review</h3>
                <button
                  type="button"
                  onClick={() => setReviewModalBooking(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <p className="text-xs text-slate-500 mb-6">
                How was your session with <span className="font-bold text-slate-800">{reviewModalBooking.expert_name || "your mentor"}</span>? Your feedback helps the community.
              </p>

              {/* Star Rating Selector */}
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-700 mb-2">Rating</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className="p-1.5 rounded-lg hover:bg-amber-50 transition-all cursor-pointer"
                    >
                      <Star
                        size={28}
                        className={`transition-colors ${
                          star <= reviewRating
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-300"
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-amber-700 ml-2">{reviewRating} / 5 Stars</span>
                </div>
              </div>

              {/* Review Text Area */}
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-700 mb-2">Your Feedback</label>
                <textarea
                  rows={4}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Share details about what you learned, resume feedback received, interview tips, etc..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1a2b8c] font-medium"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setReviewModalBooking(null)}
                  disabled={submittingReview}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitReview}
                  disabled={submittingReview}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md shadow-orange-500/20 active:scale-95 flex items-center gap-2"
                >
                  {submittingReview ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit Review</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}

function MyBookingCard({ booking, onLeaveReview }: { booking: any; onLeaveReview: (booking: any) => void }) {
  const expertNameClean = (booking?.expert_name || "Verified Mentor").replace(/\s*\.+$/, "");
  const expertInitial = (expertNameClean[0] || "M").toUpperCase();

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
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

  const getStatusBadge = () => {
    switch (booking.status) {
      case 'confirmed':
        return (
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1">
            <ShieldCheck size={13} className="text-emerald-600" />
            <span>Confirmed (Escrow Protected)</span>
          </span>
        );
      case 'completed':
        return (
          <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1">
            <CheckCircle2 size={13} className="text-blue-600" />
            <span>Completed</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1">
            <AlertCircle size={13} className="text-red-500" />
            <span>Cancelled (Refunded)</span>
          </span>
        );
      default:
        return (
          <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1">
            <Clock size={13} className="text-amber-500" />
            <span>Pending Payment</span>
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200/80 p-5 md:p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
      <div>
        {/* Top Header: Date/Time + Status */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-800 text-xs font-bold">
            <Calendar size={14} className="text-[#1a2b8c]" />
            <span>{formatDate(booking.scheduled_at)}</span>
            <span className="text-slate-300">•</span>
            <Clock size={14} className="text-orange-500" />
            <span>{formatTime(booking.scheduled_at)}</span>
          </div>
          {getStatusBadge()}
        </div>

        {/* Mentor & Session Info */}
        <div className="flex items-start gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 overflow-hidden text-[#1a2b8c] font-black text-lg">
            {booking.expert_image ? (
              <img src={booking.expert_image} alt={expertNameClean} className="w-full h-full object-cover" />
            ) : (
              <span>{expertInitial}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-slate-900 text-sm md:text-base leading-snug line-clamp-1">
              {booking.mentorship_title || "1-on-1 Mentorship Session"}
            </h4>
            <p className="text-xs text-slate-500 font-medium line-clamp-1 mt-0.5">
              Mentor: <span className="text-slate-700 font-bold">{expertNameClean}</span> {booking.expert_headline ? `• ${booking.expert_headline}` : ''}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-extrabold text-slate-900 font-mono">₹{booking.amount || 499}</span>
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                Paid via {booking.payment_method || 'Razorpay'}
              </span>
            </div>
          </div>
        </div>

        {/* Notes if any */}
        {booking.notes && (
          <div className="bg-slate-50 rounded-xl p-3 mb-4 text-xs text-slate-600 border border-slate-100">
            <span className="font-bold text-slate-700">Topic: </span> {booking.notes}
          </div>
        )}

        {/* Review summary if already reviewed */}
        {booking.rating ? (
          <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-3 mb-4">
            <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs mb-1">
              <Star size={13} className="fill-amber-400 text-amber-400" />
              <span>You Rated: {booking.rating} / 5</span>
            </div>
            {booking.review && (
              <p className="text-xs text-slate-600 italic">"{booking.review}"</p>
            )}
          </div>
        ) : null}
      </div>

      {/* Card Actions Footer */}
      <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 mt-2">
        {/* Join Meeting Link / Button */}
        {booking.meeting_link ? (
          <a
            href={booking.meeting_link.startsWith('http') ? booking.meeting_link : `https://${booking.meeting_link}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 md:px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Video size={15} />
            <span>Join Meeting</span>
            <ExternalLink size={13} />
          </a>
        ) : booking.status === 'confirmed' ? (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50/80 px-3 py-2 rounded-xl border border-amber-200/50">
            <Clock size={13} className="shrink-0 text-amber-600" />
            <span>Mentor will share meeting link prior to the call</span>
          </div>
        ) : (
          <div />
        )}

        {/* Leave Review Action (F45) */}
        {booking.status === 'completed' && !booking.rating && (
          <button
            type="button"
            onClick={() => onLeaveReview(booking)}
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Star size={13} />
            <span>Leave a Review</span>
          </button>
        )}
      </div>
    </div>
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
