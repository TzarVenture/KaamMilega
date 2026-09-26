"use client";

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, Clock, Video, ExternalLink, ShieldCheck, Star, 
  AlertCircle, CheckCircle2, X, RefreshCw, ArrowLeft, BookOpen,
  Users, MessageSquare
} from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function MyMentorshipSessionsPage() {
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
    if (token) {
      fetchMyBookings();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchMyBookings = async () => {
    try {
      setLoading(true);
      const res: any = await api.get('/mentorships/bookings/my');
      const data = Array.isArray(res) ? res : (res?.data || []);
      setMyBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch my bookings", err);
      toast.error("Could not load booked sessions");
    } finally {
      setLoading(false);
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
    <main className="min-h-screen bg-[#fafafa] pb-24">
      <ToastContainer position="top-right" autoClose={3000} theme="colored" />

      {/* Clean Dashboard Header */}
      <section className="bg-white border-b border-slate-200/80 pt-8 pb-8 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Back Navigation */}
          <Link
            href="/mentorship"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#1a2b8c] transition-colors mb-4 group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Mentorship Marketplace</span>
          </Link>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                  My Booked Sessions
                </h1>
                {myBookings.length > 0 && (
                  <span className="bg-orange-50 text-orange-600 border border-orange-200/80 text-xs font-black px-2.5 py-0.5 rounded-full">
                    {myBookings.length} {myBookings.length === 1 ? 'Booking' : 'Bookings'}
                  </span>
                )}
              </div>
              <p className="text-xs md:text-sm text-slate-500 font-medium mt-1 max-w-xl">
                Track your scheduled 1-on-1 mentorship calls, join video meetings, and manage escrow-protected sessions.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={fetchMyBookings}
                disabled={loading}
                className="inline-flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
                <span>Refresh</span>
              </button>
              <Link
                href="/mentorship"
                className="inline-flex items-center gap-1.5 bg-[#1a2b8c] hover:bg-[#152370] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95"
              >
                <span>Find More Mentors</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Main Body */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 pt-8">
        {/* Escrow Guarantee Banner */}
        <div className="bg-linear-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/80 rounded-2xl md:rounded-3xl p-4 md:p-6 mb-8 flex items-start gap-4 shadow-2xs">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h4 className="font-black text-slate-900 text-sm md:text-base">100% Escrow-Protected Guarantee</h4>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              Every mentorship session is protected by KaamMilega Escrow. Your payment is safely held until the session is successfully conducted. If the mentor cancels or does not attend, your money is immediately refunded.
            </p>
          </div>
        </div>

        {/* Filter Pills */}
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

        {/* Dynamic States */}
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
              href="/login?redirect=/mentorship/my-sessions"
              className="inline-block bg-[#1a2b8c] hover:bg-[#152370] text-white px-6 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md active:scale-95"
            >
              Log In to Your Account
            </Link>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-2xl h-52 animate-pulse border border-slate-200" />
            ))}
          </div>
        ) : filteredBookings.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredBookings.map((booking, idx) => (
              <BookingCard
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
                ? "You haven't booked any mentorship sessions yet. Accelerate your career with 1-on-1 industry guidance!"
                : `You currently have no ${bookingFilter} mentorship sessions.`}
            </p>
            <Link
              href="/mentorship"
              className="inline-block bg-[#1a2b8c] hover:bg-[#152370] text-white px-6 py-2.5 rounded-xl font-bold text-xs transition-all shadow-xs active:scale-95"
            >
              Explore Mentors Now
            </Link>
          </div>
        )}
      </section>

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
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitReview}
                  disabled={submittingReview}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md shadow-orange-500/20 active:scale-95 flex items-center gap-2 cursor-pointer"
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

function BookingCard({ booking, onLeaveReview }: { booking: any; onLeaveReview: (booking: any) => void }) {
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
