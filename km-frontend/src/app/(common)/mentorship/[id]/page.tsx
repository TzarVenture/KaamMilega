"use client";

import { useEffect, useState, use, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Star, Clock, Calendar, CheckCircle, ChevronLeft, 
  Award, Users, CalendarDays, ShieldCheck, 
  MessageCircle, AlertCircle, Sparkles, Check,
  Wallet, CreditCard, X, ArrowRight, ExternalLink,
  Lock, Zap, HelpCircle
} from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/axios';
import { useRouter } from 'next/navigation';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface AvailabilitySlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active?: boolean;
}

interface WalletData {
  wallet_id?: string;
  main_balance: number;
  earnings_balance: number;
  locked_balance: number;
  total_balance: number;
  currency?: string;
}

export default function MentorshipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [notes, setNotes] = useState("");

  // Payment & Checkout state for F76
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'razorpay'>('wallet');
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<any>(null);

  // Fetch candidate's wallet balance
  const fetchWallet = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res: any = await api.get('/wallet/balance');
      if (res) {
        setWalletData({
          wallet_id: res.wallet_id,
          main_balance: res.main_balance || 0,
          earnings_balance: res.earnings_balance || 0,
          locked_balance: res.locked_balance || 0,
          total_balance: res.total_balance || 0,
          currency: res.currency || "INR",
        });
      }
    } catch (err) {
      console.warn("Wallet info not available or unauthenticated", err);
    }
  }, []);

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      const res: any = await api.get(`/mentorships/${id}`);
      setData(res);
      
      // Fetch availability for the expert
      if (res?.expert?.id) {
          const availRes: any = await api.get(`/mentorships/expert/${res.expert.id}/availability`);
          const availList: AvailabilitySlot[] = Array.isArray(availRes) ? availRes : (availRes?.data || []);
          setAvailability(availList);

          // Auto-select the first available working day within next 14 days
          for (let i = 0; i < 14; i++) {
              const d = new Date();
              d.setDate(d.getDate() + i);
              const dayOfWeek = d.getDay();
              const match = availList.find(a => a.day_of_week === dayOfWeek && a.is_active !== false);
              if (match) {
                  setSelectedDate(d);
                  setSelectedSlot(match.start_time);
                  break;
              }
          }
      }
    } catch (error: any) {
      console.error("Failed to fetch details", error);
      toast.error(error.message || "Failed to load mentorship details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
    fetchWallet();
  }, [fetchDetail, fetchWallet]);

  // Dynamically load Razorpay Checkout SDK
  const loadRazorpayScript = () => {
    return new Promise<boolean>((resolve) => {
      if (typeof window === 'undefined') return resolve(false);
      if ((window as any).Razorpay) return resolve(true);

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Helper to check if expert is available on given date
  const getDayAvailability = (date: Date | null): AvailabilitySlot | null => {
    if (!date || !availability || availability.length === 0) return null;
    const day = date.getDay();
    return availability.find(a => a.day_of_week === day && a.is_active !== false) || null;
  };

  const handleDateSelect = (d: Date) => {
    setSelectedDate(d);
    const dayAvail = getDayAvailability(d);
    if (dayAvail) {
      setSelectedSlot(dayAvail.start_time);
    } else {
      setSelectedSlot(null);
    }
  };

  // Opens the checkout modal or redirects to login if unauthenticated
  const handleOpenCheckout = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem("token") : null;
    if (!token) {
      toast.warn("Please login to your account to book a mentorship session");
      setTimeout(() => {
        router.push(`/login?redirect=/mentorship/${id}`);
      }, 1200);
      return;
    }

    if (!selectedDate || !selectedSlot) {
      toast.warn("Please select an available date and time slot");
      return;
    }

    fetchWallet();
    setIsCheckoutModalOpen(true);
  };

  // 1-Click Pay with KaamMilega Wallet
  const handleWalletPayment = async () => {
    if (!selectedDate || !selectedSlot) return;

    const scheduledAt = new Date(selectedDate);
    const [hours, minutes] = selectedSlot.split(':');
    scheduledAt.setHours(parseInt(hours || "10"), parseInt(minutes || "0"), 0, 0);

    setPaymentProcessing(true);
    try {
      const res: any = await api.post('/mentorships/book-wallet', {
        mentorship_id: id,
        scheduled_at: scheduledAt.toISOString(),
        notes: notes.trim(),
      });

      setConfirmedBooking(res.booking);
      if (res.wallet) {
        setWalletData({
          wallet_id: res.wallet.wallet_id,
          main_balance: res.wallet.main_balance || 0,
          earnings_balance: res.wallet.earnings_balance || 0,
          locked_balance: res.wallet.locked_balance || 0,
          total_balance: res.wallet.total_balance || 0,
          currency: res.wallet.currency || "INR",
        });
      }

      setIsCheckoutModalOpen(false);
      setIsSuccessModalOpen(true);
      toast.success("Session confirmed & fee locked safely in Escrow!");
    } catch (err: any) {
      console.error("Wallet booking error", err);
      toast.error(err.message || "Failed to complete payment via wallet");
    } finally {
      setPaymentProcessing(false);
    }
  };

  // Online Payment via Razorpay
  const handleRazorpayPayment = async () => {
    if (!selectedDate || !selectedSlot) return;

    const scheduledAt = new Date(selectedDate);
    const [hours, minutes] = selectedSlot.split(':');
    scheduledAt.setHours(parseInt(hours || "10"), parseInt(minutes || "0"), 0, 0);

    setPaymentProcessing(true);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error("Unable to load Razorpay payment gateway. Please check your internet connection.");
        setPaymentProcessing(false);
        return;
      }

      // 1. Create order on backend
      const orderRes: any = await api.post('/mentorships/create-order', {
        mentorship_id: id,
        scheduled_at: scheduledAt.toISOString(),
        notes: notes.trim(),
      });

      if (!orderRes || !orderRes.order_id) {
        toast.error(orderRes?.error || "Failed to initialize payment order");
        setPaymentProcessing(false);
        return;
      }

      const rzpKey = orderRes.key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

      // 2. Open Razorpay Checkout Modal
      const options = {
        key: rzpKey,
        amount: orderRes.amount_paise,
        currency: orderRes.currency || 'INR',
        name: 'KaamMilega™ Mentorship',
        description: `${data?.mentorship?.title || '1-on-1 Mentorship'} with ${expertNameClean}`,
        order_id: orderRes.order_id,
        handler: async function (response: any) {
          try {
            toast.info("Verifying payment with secure Escrow ledger...");
            const verifyRes: any = await api.post('/mentorships/verify-payment', {
              booking_id: orderRes.booking_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            setConfirmedBooking(verifyRes.booking || {
              id: orderRes.booking_id,
              scheduled_at: scheduledAt.toISOString(),
              amount: orderRes.amount,
              payment_method: 'razorpay',
              status: 'confirmed',
            });

            setIsCheckoutModalOpen(false);
            setIsSuccessModalOpen(true);
            fetchWallet();
            toast.success("Payment verified! Your mentorship session is confirmed.");
          } catch (verifyErr: any) {
            console.error("Payment verification failed", verifyErr);
            toast.error(verifyErr?.response?.data?.error || verifyErr.message || "Payment verification failed. Please contact support.");
          } finally {
            setPaymentProcessing(false);
          }
        },
        theme: {
          color: '#1a2b8c',
        },
        modal: {
          ondismiss: function () {
            setPaymentProcessing(false);
          }
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (resp: any) {
        toast.error(`Payment failed: ${resp.error?.description || 'Transaction was cancelled'}`);
        setPaymentProcessing(false);
      });
      rzp.open();
    } catch (err: any) {
      console.error("Razorpay initiation error", err);
      toast.error(err?.response?.data?.error || err.message || "Failed to initiate payment. Please try again.");
      setPaymentProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#1a2b8c] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || !data.mentorship) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Mentorship Not Found</h2>
        <p className="text-sm text-slate-500 mb-6">This mentorship session may be inactive or unavailable.</p>
        <Link 
          href="/mentorship" 
          className="px-5 py-2.5 bg-[#1a2b8c] text-white text-xs font-bold rounded-xl hover:bg-[#152370] transition shadow-xs"
        >
          ← Back to Mentorships
        </Link>
      </div>
    );
  }

  const { mentorship, expert } = data;
  const currentDayAvail = getDayAvailability(selectedDate);
  const expertNameClean = (expert?.name || "Industry Expert").replace(/\s*\.+$/, "");
  const expertInitial = (expertNameClean[0] || "E").toUpperCase();
  const sessionPrice = mentorship.price || 499;
  const mainBal = walletData?.main_balance || 0;
  const hasSufficientWallet = mainBal >= sessionPrice;

  return (
    <main className="min-h-screen bg-[#fafafa] pb-10 md:pb-20">
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-6 md:pt-10">
        <Link 
          href="/mentorship" 
          className="inline-flex items-center gap-2 text-slate-500 hover:text-[#1a2b8c] font-bold mb-6 md:mb-8 transition-all text-sm md:text-base"
        >
          <ChevronLeft size={18} className="md:w-5 md:h-5" /> 
          <span>Back to Mentorships</span>
        </Link>
        
        <div className="flex flex-col lg:flex-row gap-6 md:gap-8 lg:gap-12">
          {/* Main Content */}
          <div className="lg:flex-1 space-y-6 md:space-y-8">
            {/* Header Card */}
            <div className="bg-white rounded-2xl md:rounded-3xl p-6 md:p-10 shadow-xs border border-slate-200/80 relative overflow-hidden">
                <div className="flex flex-wrap items-center gap-3 md:gap-4 mb-4 md:mb-6">
                   <span className="bg-blue-50 text-[#1a2b8c] text-[10px] md:text-xs font-extrabold uppercase tracking-wider px-3.5 py-1.5 rounded-full border border-blue-100">
                     {mentorship.category || "Mentorship"}
                   </span>
                   <div className="flex items-center gap-1.5 text-amber-500 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
                     <Star size={13} className="fill-amber-400 text-amber-400" />
                     <span className="text-xs font-bold text-amber-800">
                       {mentorship.rating || 4.9} ({mentorship.reviews || 24}+ reviews)
                     </span>
                   </div>
                </div>

                <h1 className="text-2xl md:text-4xl font-black text-slate-900 mb-4 md:mb-6 leading-tight">
                  {mentorship.title}
                </h1>

                <div className="flex flex-wrap gap-4 md:gap-8 pt-2 border-t border-slate-100">
                    <InfoItem icon={<Clock className="text-[#1a2b8c]" size={18} />} label="Duration" value={`${mentorship.duration || 45} Mins`} />
                    <InfoItem icon={<Users className="text-emerald-600" size={18} />} label="Session Format" value="1-on-1 Dedicated" />
                    <InfoItem icon={<MessageCircle className="text-orange-500" size={18} />} label="Languages" value="Hindi / English" />
                </div>
            </div>

            {/* About the Session */}
            <div className="bg-white rounded-2xl md:rounded-3xl p-6 md:p-10 shadow-xs border border-slate-200/80">
               <h2 className="text-lg md:text-xl font-bold text-slate-900 mb-4 md:mb-6 flex items-center gap-2">
                  <Sparkles size={18} className="text-orange-500" />
                  <span>About this Mentorship Session</span>
               </h2>
               <div className="text-slate-600 text-sm md:text-base leading-relaxed space-y-4">
                  <p>{mentorship.description}</p>
                  
                  <h4 className="text-slate-900 font-bold pt-4">Key Takeaways from this session:</h4>
                  <ul className="space-y-3">
                     {[
                        "Personalized career roadmap and tailored action items",
                        "Tactical industry insights and direct feedback on your profile",
                        "Practical interview questions and proven answer frameworks",
                        "Direct 1-on-1 Q&A addressing your specific career hurdles"
                     ].map((item, i) => (
                        <li key={i} className="flex gap-2.5 items-start text-xs md:text-sm text-slate-700">
                           <CheckCircle size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                           <span>{item}</span>
                        </li>
                     ))}
                  </ul>
               </div>
            </div>

            {/* Meet Your Mentor Card */}
            <div className="bg-linear-to-br from-slate-950 via-[#0f1d5e] to-[#1a2b8c] text-white rounded-2xl md:rounded-3xl p-6 md:p-10 shadow-xl shadow-blue-950/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                
                <h2 className="text-lg md:text-xl font-bold mb-6 text-white flex items-center gap-2">
                   <Award size={18} className="text-orange-400" />
                   <span>Meet Your Mentor</span>
                </h2>
                <div className="flex flex-col sm:flex-row gap-5 md:gap-6 items-start relative z-10">
                    <div className="w-18 h-18 md:w-22 md:h-22 rounded-2xl bg-white/10 border-2 border-white/20 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                       {expert?.profile_image ? (
                           <img src={expert.profile_image} alt={expertNameClean} className="w-full h-full object-cover" />
                       ) : (
                           <div className="w-full h-full bg-[#1a2b8c] flex items-center justify-center text-2xl font-black text-white">
                             {expertInitial}
                           </div>
                       )}
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg md:text-xl font-extrabold text-white">{expertNameClean}</h3>
                          <span className="p-0.5 rounded-full bg-emerald-500 text-white">
                            <Check size={10} strokeWidth={3} />
                          </span>
                        </div>
                        <p className="text-blue-200 text-xs md:text-sm font-semibold">
                          {expert?.headline || "Verified Industry Professional & Career Mentor"}
                        </p>
                        <p className="text-slate-300 text-xs md:text-sm leading-relaxed max-w-2xl">
                          {expert?.bio || "An experienced professional committed to guiding candidates, sharing practical insights, and helping you achieve your career aspirations."}
                        </p>
                        <div className="flex flex-wrap gap-2 pt-2">
                            <span className="inline-flex items-center gap-1 bg-white/10 px-3 py-1 rounded-full text-[11px] font-semibold border border-white/10 text-emerald-300">
                                <ShieldCheck size={13} />
                                <span>Verified Expert</span>
                            </span>
                            <span className="inline-flex items-center gap-1 bg-white/10 px-3 py-1 rounded-full text-[11px] font-semibold border border-white/10 text-amber-300">
                                <Star size={13} className="fill-amber-300" />
                                <span>Top Rated Mentor</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
          </div>

          {/* Sidebar - Booking */}
          <div className="lg:w-[420px] space-y-6">
            <div className="bg-white rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-lg shadow-slate-200/50 border border-slate-200/80 lg:sticky lg:top-8">
                {/* Session Fee Header */}
                <div className="mb-6 pb-5 border-b border-slate-100">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Session Fee
                    </span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl md:text-4xl font-black text-slate-900 font-mono">
                          ₹{sessionPrice}
                        </span>
                        <span className="text-slate-400 font-semibold text-xs md:text-sm">
                          / 1-on-1 session
                        </span>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Select Date */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-xs font-bold text-slate-900 uppercase flex items-center gap-1.5">
                             <CalendarDays size={15} className="text-[#1a2b8c]" />
                             <span>Select Date</span>
                          </label>
                          <span className="text-[11px] text-slate-400 font-medium">Next 7 Days</span>
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                            {[0, 1, 2, 3, 4, 5, 6].map(i => {
                                const d = new Date();
                                d.setDate(d.getDate() + i);
                                const isSelected = selectedDate?.toDateString() === d.toDateString();
                                const isAvail = !!getDayAvailability(d);

                                return (
                                    <button 
                                        key={i}
                                        type="button"
                                        onClick={() => handleDateSelect(d)}
                                        className={`flex flex-col items-center p-2 rounded-2xl border transition-all cursor-pointer active:scale-95 ${
                                            isSelected 
                                              ? 'bg-[#1a2b8c] border-[#1a2b8c] text-white shadow-md shadow-blue-900/20' 
                                              : isAvail
                                                ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                                                : 'bg-slate-100/50 border-slate-100 text-slate-400 opacity-60'
                                        }`}
                                    >
                                        <span className="text-[9px] font-bold uppercase tracking-wider">
                                          {i === 0 ? "Today" : d.toLocaleDateString('en-US', { weekday: 'short' })}
                                        </span>
                                        <span className="text-base font-black mt-0.5">
                                          {d.getDate()}
                                        </span>
                                        {!isAvail && (
                                          <span className="text-[8px] font-semibold text-rose-400 mt-0.5">Off</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Time Slot Display based on Expert's Own Timing */}
                    <div>
                        <label className="text-xs font-bold text-slate-900 uppercase mb-2 flex items-center gap-1.5">
                           <Clock size={15} className="text-[#1a2b8c]" />
                           <span>Expert's Available Time</span>
                        </label>

                        {currentDayAvail ? (
                            <div className="space-y-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedSlot(currentDayAvail.start_time)}
                                    className={`w-full py-3 px-4 rounded-xl text-center text-xs font-bold border transition-all cursor-pointer flex items-center justify-between ${
                                        selectedSlot === currentDayAvail.start_time
                                            ? 'bg-blue-50 border-[#1a2b8c] text-[#1a2b8c] ring-2 ring-[#1a2b8c]/20'
                                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                    }`}
                                >
                                    <span className="flex items-center gap-2">
                                      <Clock size={14} className="text-[#1a2b8c]" />
                                      <span>Session Window: {currentDayAvail.start_time} – {currentDayAvail.end_time}</span>
                                    </span>
                                    <span className="text-[10px] font-black uppercase bg-[#1a2b8c] text-white px-2 py-0.5 rounded-md">
                                      Active Slot
                                    </span>
                                </button>
                                <p className="text-[11px] text-slate-400 pl-1 font-medium">
                                  Configured directly by the mentor for this day.
                                </p>
                            </div>
                        ) : (
                            <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-100 text-xs text-rose-700 flex items-start gap-2">
                                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                                <span>The mentor is unavailable on this day. Please pick another day above.</span>
                            </div>
                        )}
                    </div>

                    {/* Notes Field */}
                    <div>
                        <label className="text-xs font-bold text-slate-900 uppercase mb-1.5 block">
                           Topics to Discuss <span className="text-slate-400 font-medium">(Optional)</span>
                        </label>
                        <textarea 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs md:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1a2b8c] transition-all font-medium min-h-[80px]"
                            placeholder="Share your goals, challenges, or questions for this session..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>

                    {/* Book Session CTA */}
                    <button 
                        type="button"
                        onClick={handleOpenCheckout}
                        disabled={!currentDayAvail}
                        className="w-full bg-[#1a2b8c] hover:bg-[#152370] text-white py-3.5 md:py-4 rounded-xl font-bold transition-all shadow-md shadow-blue-900/20 active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer text-xs md:text-sm flex items-center justify-center gap-2"
                    >
                        <span>Book Session (₹{sessionPrice})</span>
                        <ArrowRight size={16} />
                    </button>
                    
                    <p className="text-[10px] text-slate-400 font-semibold text-center flex items-center justify-center gap-1">
                        <ShieldCheck size={13} className="text-emerald-500" />
                        <span>Protected by KaamMilega Escrow Guarantee</span>
                    </p>
                </div>
            </div>

            <div className="bg-blue-50/60 rounded-2xl p-5 border border-blue-100/80 flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 text-[#1a2b8c] rounded-xl flex items-center justify-center shrink-0">
                    <ShieldCheck size={20} />
                </div>
                <div>
                    <h4 className="font-bold text-slate-900 text-xs">Safe & Verified</h4>
                    <p className="text-[11px] text-slate-500 font-medium">All mentors are screened and verified before sessions.</p>
                </div>
            </div>
          </div>
        </div>
      </div>

      {/* CHECKOUT MODAL (Feature F76) */}
      <AnimatePresence>
        {isCheckoutModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden relative max-h-[92vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="bg-linear-to-r from-[#1a2b8c] to-[#0f1d5e] text-white px-6 py-5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                    <ShieldCheck size={18} className="text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base leading-tight">Confirm & Checkout</h3>
                    <p className="text-blue-200 text-xs font-medium">1-on-1 Mentorship Session</p>
                  </div>
                </div>
                <button 
                  onClick={() => !paymentProcessing && setIsCheckoutModalOpen(false)}
                  disabled={paymentProcessing}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5 overflow-y-auto">
                {/* Session Summary Card */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1a2b8c] bg-blue-100/60 px-2 py-0.5 rounded-md">
                        {mentorship.category || "Mentorship"}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm mt-1 leading-snug">
                        {mentorship.title}
                      </h4>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Mentor: <span className="font-semibold text-slate-700">{expertNameClean}</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Fee</span>
                      <span className="text-2xl font-black text-slate-900 font-mono">₹{sessionPrice}</span>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-200/60 grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                      <Calendar size={13} className="text-[#1a2b8c]" />
                      <span>{selectedDate?.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                      <Clock size={13} className="text-orange-500" />
                      <span>{selectedSlot} ({mentorship.duration || 45} mins)</span>
                    </div>
                  </div>
                </div>

                {/* Payment Method Selection */}
                <div>
                  <label className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 block">
                    Select Payment Method
                  </label>
                  
                  <div className="space-y-3">
                    {/* Option 1: KaamMilega Wallet */}
                    <div 
                      onClick={() => !paymentProcessing && setPaymentMethod('wallet')}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                        paymentMethod === 'wallet' 
                          ? 'border-[#1a2b8c] bg-blue-50/40 shadow-xs' 
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            paymentMethod === 'wallet' ? 'bg-[#1a2b8c] text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            <Wallet size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">KaamMilega Wallet</span>
                              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                                Instant 1-Click
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5 font-medium">
                              Available Main Balance: <span className="font-bold text-slate-800">₹{mainBal.toFixed(2)}</span>
                            </p>
                          </div>
                        </div>

                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 ${
                          paymentMethod === 'wallet' ? 'border-[#1a2b8c] bg-[#1a2b8c]' : 'border-slate-300'
                        }`}>
                          {paymentMethod === 'wallet' && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      </div>

                      {/* Insufficient balance warning if applicable */}
                      {paymentMethod === 'wallet' && !hasSufficientWallet && (
                        <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <AlertCircle size={14} className="text-amber-600 shrink-0" />
                            <span>Short by ₹{(sessionPrice - mainBal).toFixed(2)}</span>
                          </div>
                          <Link 
                            href="/wallet" 
                            target="_blank"
                            className="text-[#1a2b8c] font-bold hover:underline flex items-center gap-1"
                          >
                            <span>Top Up Wallet</span>
                            <ExternalLink size={12} />
                          </Link>
                        </div>
                      )}
                    </div>

                    {/* Option 2: Razorpay Online Payment */}
                    <div 
                      onClick={() => !paymentProcessing && setPaymentMethod('razorpay')}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                        paymentMethod === 'razorpay' 
                          ? 'border-[#1a2b8c] bg-blue-50/40 shadow-xs' 
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            paymentMethod === 'razorpay' ? 'bg-[#1a2b8c] text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            <CreditCard size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">UPI, Cards & NetBanking</span>
                              <span className="text-[10px] font-black uppercase tracking-wider bg-blue-100 text-[#1a2b8c] px-1.5 py-0.5 rounded">
                                Razorpay
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5 font-medium">
                              Google Pay, PhonePe, Paytm, Cards & 50+ Banks
                            </p>
                          </div>
                        </div>

                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 ${
                          paymentMethod === 'razorpay' ? 'border-[#1a2b8c] bg-[#1a2b8c]' : 'border-slate-300'
                        }`}>
                          {paymentMethod === 'razorpay' && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Escrow Guarantee Callout */}
                <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200/80 flex items-start gap-2.5">
                  <Lock size={16} className="text-emerald-700 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-emerald-900 leading-relaxed font-medium">
                    <strong className="font-bold text-emerald-950">KaamMilega Escrow Protection:</strong> Your payment is held safely in escrow. Mentor will only receive the payout once the session is successfully conducted.
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCheckoutModalOpen(false)}
                  disabled={paymentProcessing}
                  className="px-4 py-3 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>

                {paymentMethod === 'wallet' ? (
                  hasSufficientWallet ? (
                    <button
                      type="button"
                      onClick={handleWalletPayment}
                      disabled={paymentProcessing}
                      className="flex-1 bg-[#1a2b8c] hover:bg-[#152370] text-white py-3 px-5 rounded-xl font-bold text-xs md:text-sm transition shadow-md shadow-blue-900/20 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                    >
                      {paymentProcessing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Processing 1-Click Pay...</span>
                        </>
                      ) : (
                        <>
                          <Zap size={16} className="fill-amber-400 text-amber-400" />
                          <span>Pay ₹{sessionPrice} via Wallet</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('razorpay')}
                      className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-3 px-5 rounded-xl font-bold text-xs md:text-sm transition shadow-md shadow-orange-900/20 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <span>Pay via Razorpay Instead</span>
                      <ArrowRight size={15} />
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={handleRazorpayPayment}
                    disabled={paymentProcessing}
                    className="flex-1 bg-[#1a2b8c] hover:bg-[#152370] text-white py-3 px-5 rounded-xl font-bold text-xs md:text-sm transition shadow-md shadow-blue-900/20 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {paymentProcessing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Opening Razorpay...</span>
                      </>
                    ) : (
                      <>
                        <Lock size={15} />
                        <span>Proceed to Pay ₹{sessionPrice}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BOOKING SUCCESS RECEIPT MODAL */}
      <AnimatePresence>
        {isSuccessModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 p-6 md:p-8 text-center relative overflow-hidden"
            >
              {/* Success Badge */}
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs">
                <CheckCircle size={36} />
              </div>

              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full border border-emerald-200">
                Booking Confirmed
              </span>

              <h3 className="text-xl md:text-2xl font-black text-slate-900 mt-3 mb-1">
                Mentorship Scheduled!
              </h3>
              <p className="text-xs text-slate-500 font-medium mb-6">
                Your 1-on-1 session is booked and secured under KaamMilega Escrow protection.
              </p>

              {/* Receipt Summary Box */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left space-y-2.5 mb-6 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Session:</span>
                  <span className="font-bold text-slate-900 text-right max-w-[200px] truncate">{mentorship.title}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Mentor:</span>
                  <span className="font-bold text-slate-900">{expertNameClean}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Date & Time:</span>
                  <span className="font-bold text-slate-900">
                    {selectedDate?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at {selectedSlot}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Amount Paid:</span>
                  <span className="font-bold text-slate-900 font-mono">₹{sessionPrice}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500 font-medium">Payment Status:</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    <ShieldCheck size={13} />
                    <span>Paid (Escrow Hold)</span>
                  </span>
                </div>
              </div>

              {/* Buttons */}
              <div className="space-y-2.5">
                <Link
                  href="/wallet"
                  className="w-full bg-[#1a2b8c] hover:bg-[#152370] text-white py-3 rounded-xl font-bold text-xs md:text-sm transition shadow-md shadow-blue-900/20 active:scale-95 flex items-center justify-center gap-2"
                >
                  <Wallet size={15} />
                  <span>View Wallet & Escrow Ledger</span>
                </Link>
                <Link
                  href="/mentorship"
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5"
                >
                  <span>Explore More Mentorships</span>
                </Link>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="flex gap-2.5 items-center">
      <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center shrink-0 border border-slate-100">
        {icon}
      </div>
      <div>
        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{label}</p>
        <p className="text-xs font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}
