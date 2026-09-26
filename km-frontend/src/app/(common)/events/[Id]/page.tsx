'use client'

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Calendar, MapPin, Users, Share2, ArrowLeft,
    Clock, CheckCircle2, Ticket, Wallet, Lock, X,
    Sparkles, ShieldCheck, QrCode, Download, Printer,
    CreditCard, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Link from 'next/link';

interface EventDetails {
    id: string;
    title: string;
    description: string;
    organizer: string;
    date: string;
    time: string;
    location: string;
    image_url?: string;
    category?: string;
    is_paid?: boolean;
    price?: number;
    capacity?: number;
    available_seats?: number;
    participants?: string[];
}

interface EventTicket {
    id: string;
    ticket_number: string;
    event_id: string;
    user_id: string;
    attendee_name: string;
    attendee_email: string;
    attendee_phone?: string;
    amount: number;
    payment_status: string;
    payment_method: string;
    status: string;
    qr_code_data: string;
    event_title: string;
    event_date: string;
    event_time: string;
    event_location: string;
    created_at: string;
}

interface WalletSummary {
    main_balance: number;
    total_balance: number;
    earnings_balance: number;
}

// ─── Shimmer Skeleton ───
const DetailSkeleton = () => (
    <div className="bg-slate-50 min-h-screen animate-pulse">
        <div className="relative h-72 md:h-96 bg-slate-200 w-full" />
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 flex flex-col lg:flex-row gap-8 -mt-16 relative z-20">
            <div className="flex-1 space-y-6">
                <div className="bg-white rounded-2xl p-8 border border-slate-100">
                    <div className="h-6 bg-slate-200 rounded-lg w-1/3 mb-6" />
                    <div className="space-y-3">
                        <div className="h-4 bg-slate-100 rounded w-full" />
                        <div className="h-4 bg-slate-100 rounded w-5/6" />
                        <div className="h-4 bg-slate-100 rounded w-4/6" />
                    </div>
                </div>
            </div>
            <div className="w-full lg:w-88">
                <div className="bg-white rounded-2xl p-6 border border-slate-100 space-y-5">
                    <div className="h-4 bg-slate-200 rounded w-1/2 mb-4" />
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="w-11 h-11 bg-slate-200 rounded-xl" />
                            <div className="flex-1">
                                <div className="h-3 bg-slate-100 rounded w-1/3 mb-1.5" />
                                <div className="h-4 bg-slate-200 rounded w-2/3" />
                            </div>
                        </div>
                    ))}
                    <div className="h-12 bg-slate-200 rounded-xl w-full mt-4" />
                </div>
            </div>
        </div>
    </div>
);

const EventDetailsPage = () => {
    const { Id } = useParams();
    const router = useRouter();
    const [event, setEvent] = useState<EventDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [registering, setRegistering] = useState(false);
    const [isRegistered, setIsRegistered] = useState(false);
    const [ticket, setTicket] = useState<EventTicket | null>(null);
    const [wallet, setWallet] = useState<WalletSummary | null>(null);

    // Modal states
    const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
    const [ticketModalOpen, setTicketModalOpen] = useState(false);

    // Form & Payment state
    const [attendeeName, setAttendeeName] = useState('');
    const [attendeeEmail, setAttendeeEmail] = useState('');
    const [attendeePhone, setAttendeePhone] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'wallet'>('razorpay');
    const [paymentProcessing, setPaymentProcessing] = useState(false);

    const ticketRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchEventDetails = async () => {
            try {
                const res: any = await api.get(`/events/${Id}`);
                setEvent(res);

                // Check registration status from stored user
                const storedUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
                const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

                if (storedUser) {
                    try {
                        const user = JSON.parse(storedUser);
                        const userId = user.id || user._id;
                        if (res.participants && res.participants.includes(userId)) {
                            setIsRegistered(true);
                        }
                        if (user.name) setAttendeeName(user.name);
                        if (user.email) setAttendeeEmail(user.email);
                        if (user.mobile) setAttendeePhone(user.mobile);
                    } catch (e) {
                        console.error("Failed to parse stored user", e);
                    }
                }

                // If user logged in, check for existing digital ticket & wallet balance
                if (token) {
                    fetchUserTicket();
                    fetchWalletBalance();
                }
            } catch (error: any) {
                toast.error(error.message || "Failed to load event details");
            } finally {
                setLoading(false);
            }
        };

        if (Id) fetchEventDetails();
    }, [Id]);

    const fetchUserTicket = async () => {
        try {
            const ticketRes: any = await api.get(`/events/${Id}/ticket`);
            if (ticketRes && ticketRes.ticket_number) {
                setTicket(ticketRes);
                setIsRegistered(true);
            }
        } catch (err) {
            // Not ticketed yet or error
        }
    };

    const fetchWalletBalance = async () => {
        try {
            const walletRes: any = await api.get('/wallet/balance');
            setWallet(walletRes);
        } catch (err) {
            // Wallet load failed
        }
    };

    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
            if ((window as any).Razorpay) return resolve(true);
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    // Free Event Registration handler
    const handleFreeRegister = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            toast.info("Please login to register for this event");
            router.push(`/login?redirect=/events/${Id}`);
            return;
        }

        try {
            setRegistering(true);
            await api.post(`/events/${Id}/register`);
            toast.success("Successfully registered for the event!");
            setIsRegistered(true);
            await fetchUserTicket();
            setTicketModalOpen(true);
        } catch (error: any) {
            toast.error(error?.response?.data?.error || error.message || "Failed to register");
        } finally {
            setRegistering(false);
        }
    };

    // Open Paid Checkout Modal
    const handleOpenCheckout = () => {
        const token = localStorage.getItem('token');
        if (!token) {
            toast.info("Please login to purchase tickets");
            router.push(`/login?redirect=/events/${Id}`);
            return;
        }
        setCheckoutModalOpen(true);
    };

    // Razorpay Paid Checkout
    const handleRazorpayCheckout = async () => {
        if (!attendeeName.trim() || !attendeeEmail.trim()) {
            toast.error("Please provide attendee name and email");
            return;
        }

        try {
            setPaymentProcessing(true);
            const loaded = await loadRazorpayScript();
            if (!loaded) {
                toast.error("Failed to load Razorpay payment gateway. Please check connection.");
                setPaymentProcessing(false);
                return;
            }

            // 1. Create order
            const orderRes: any = await api.post(`/events/${Id}/create-order`, {
                attendee_name: attendeeName,
                attendee_email: attendeeEmail,
                attendee_phone: attendeePhone,
            });

            const options = {
                key: orderRes.key_id,
                amount: orderRes.amount_paise,
                currency: orderRes.currency || "INR",
                name: "KaamMilega Events",
                description: `Ticket: ${orderRes.event_title}`,
                order_id: orderRes.order_id,
                prefill: {
                    name: attendeeName,
                    email: attendeeEmail,
                    contact: attendeePhone,
                },
                theme: { color: "#1a2b8c" },
                handler: async (response: any) => {
                    try {
                        const verifyRes: any = await api.post(`/events/${Id}/verify-payment`, {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            attendee_name: attendeeName,
                            attendee_email: attendeeEmail,
                            attendee_phone: attendeePhone,
                        });

                        toast.success("Payment successful! Your ticket is confirmed.");
                        setIsRegistered(true);
                        setTicket(verifyRes.ticket);
                        setCheckoutModalOpen(false);
                        setTicketModalOpen(true);
                    } catch (err: any) {
                        toast.error(err?.response?.data?.error || "Payment verification failed");
                    } finally {
                        setPaymentProcessing(false);
                    }
                },
                modal: {
                    ondismiss: () => setPaymentProcessing(false),
                },
            };

            const rzp = new (window as any).Razorpay(options);
            rzp.on("payment.failed", (resp: any) => {
                toast.error(`Payment Failed: ${resp.error?.description || "Unknown error"}`);
                setPaymentProcessing(false);
            });
            rzp.open();
        } catch (error: any) {
            toast.error(error?.response?.data?.error || "Failed to initialize payment");
            setPaymentProcessing(false);
        }
    };

    // Wallet 1-Click Paid Checkout
    const handleWalletCheckout = async () => {
        if (!attendeeName.trim() || !attendeeEmail.trim()) {
            toast.error("Please provide attendee name and email");
            return;
        }

        try {
            setPaymentProcessing(true);
            const res: any = await api.post(`/events/${Id}/wallet-checkout`, {
                attendee_name: attendeeName,
                attendee_email: attendeeEmail,
                attendee_phone: attendeePhone,
            });

            toast.success("Ticket purchased successfully using Wallet balance!");
            setIsRegistered(true);
            setTicket(res.ticket);
            setCheckoutModalOpen(false);
            setTicketModalOpen(true);
            if (res.wallet) setWallet(res.wallet);
        } catch (error: any) {
            toast.error(error?.response?.data?.error || "Wallet checkout failed");
        } finally {
            setPaymentProcessing(false);
        }
    };

    const handlePrintTicket = () => {
        if (typeof window !== 'undefined') {
            window.print();
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    if (loading) return <DetailSkeleton />;
    if (!event) return null;

    const isPaid = event.is_paid && (event.price || 0) > 0;
    const isSoldOut = (event.capacity || 0) > 0 && (event.available_seats !== undefined && event.available_seats <= 0);
    const participantCount = event.participants?.length || 0;
    const walletBalance = wallet?.main_balance || 0;
    const isWalletSufficient = walletBalance >= (event.price || 0);

    return (
        <div className="bg-slate-50 min-h-screen pb-20">
            <ToastContainer position="top-right" autoClose={3000} theme="colored" />

            {/* ─── Hero / Banner ─── */}
            <div className="relative h-64 md:h-88 w-full bg-slate-900 overflow-hidden">
                {event.image_url ? (
                    <img
                        src={event.image_url}
                        alt={event.title}
                        className="w-full h-full object-cover opacity-60"
                    />
                ) : (
                    <div className="w-full h-full bg-linear-to-br from-slate-950 via-[#0D1B5E] to-slate-950 flex items-center justify-center">
                        <div className="w-24 h-24 bg-km-accent/20 rounded-2xl flex items-center justify-center">
                            <Calendar size={48} className="text-km-accent" />
                        </div>
                    </div>
                )}
                <div className="absolute inset-0 bg-linear-to-t from-slate-950 via-slate-950/40 to-transparent" />

                <div className="absolute top-6 left-4 md:left-8 z-20">
                    <Link
                        href="/events"
                        className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all"
                    >
                        <ArrowLeft size={16} /> Back to Events
                    </Link>
                </div>
            </div>

            {/* ─── Main Content ─── */}
            <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 flex flex-col lg:flex-row gap-8 -mt-20 relative z-20">
                {/* ── Left Column: Details ── */}
                <div className="flex-1 space-y-6">
                    <div className="bg-white rounded-2xl p-6 md:p-8 border border-slate-100 shadow-xs">
                        {/* Event Tags */}
                        <div className="flex flex-wrap items-center gap-2.5 mb-4">
                            <span className="bg-orange-50 text-km-accent text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
                                {event.category || 'Event'}
                            </span>
                            <span className={`text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider ${
                                isPaid
                                    ? 'bg-amber-100 text-amber-900'
                                    : 'bg-emerald-100 text-emerald-800'
                            }`}>
                                {isPaid ? `Paid Workshop • ₹${event.price}` : 'Free Entry'}
                            </span>
                        </div>

                        {/* Title */}
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 mb-3 leading-snug">
                            {event.title}
                        </h1>

                        <p className="text-sm text-slate-500 font-medium mb-6">
                            Organized by <span className="font-bold text-slate-700">{event.organizer}</span>
                        </p>

                        {/* Description */}
                        <div className="border-t border-slate-100 pt-6">
                            <h3 className="text-base font-black text-slate-900 mb-3">About this Event</h3>
                            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line font-normal">
                                {event.description || "Join us for this exciting event! More details will be shared with registered participants."}
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Right Column: Sidebar Registration ── */}
                <div className="w-full lg:w-88">
                    <div className="lg:sticky lg:top-24 space-y-5">
                        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-base font-black text-slate-900">Event Pass</h3>
                                <span className={`text-xs font-black uppercase px-2.5 py-1 rounded-md ${
                                    isPaid ? 'bg-orange-100 text-orange-800' : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                    {isPaid ? `₹${event.price}` : 'FREE'}
                                </span>
                            </div>

                            {/* Meta Info */}
                            <div className="space-y-4 mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-km-accent shrink-0">
                                        <Calendar size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</p>
                                        <p className="text-sm font-bold text-slate-800">{event.date}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-km-primary shrink-0">
                                        <Clock size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Time</p>
                                        <p className="text-sm font-bold text-slate-800">{event.time || 'TBA'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                                        <MapPin size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Location</p>
                                        <p className="text-sm font-bold text-slate-800">{event.location}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Participant / Seat count */}
                            <div className="bg-slate-50 rounded-xl py-3 px-4 mb-5 text-center">
                                <p className="text-xs font-bold text-slate-600">
                                    <span className="text-km-primary font-black">{participantCount}</span> {participantCount === 1 ? 'person has' : 'people have'} registered
                                </p>
                                {event.capacity && event.capacity > 0 ? (
                                    <p className="text-[11px] text-slate-500 font-semibold mt-1">
                                        {event.available_seats ?? event.capacity} seats remaining of {event.capacity} total
                                    </p>
                                ) : null}
                            </div>

                            {/* Action Buttons */}
                            {isRegistered ? (
                                <div className="space-y-3">
                                    <div className="w-full py-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2">
                                        <CheckCircle2 size={16} /> You're Registered!
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (ticket) setTicketModalOpen(true);
                                            else fetchUserTicket().then(() => setTicketModalOpen(true));
                                        }}
                                        className="w-full py-3.5 bg-linear-to-r from-[#1a2b8c] to-blue-700 hover:from-[#152370] hover:to-blue-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all active:scale-95"
                                    >
                                        <QrCode size={16} />
                                        <span>View Digital Pass & QR</span>
                                    </button>
                                </div>
                            ) : isPaid ? (
                                isSoldOut ? (
                                    <button disabled className="w-full py-3.5 bg-slate-200 text-slate-500 rounded-xl font-bold text-sm cursor-not-allowed">
                                        Sold Out
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleOpenCheckout}
                                        className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-500/20 active:scale-95 cursor-pointer"
                                    >
                                        <Ticket size={16} />
                                        <span>Buy Ticket (₹{event.price})</span>
                                    </button>
                                )
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleFreeRegister}
                                    disabled={registering || isSoldOut}
                                    className="w-full py-3.5 bg-km-accent hover:bg-km-accent-dark text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-500/20 active:scale-95 disabled:opacity-60 cursor-pointer"
                                >
                                    {registering ? "Registering..." : isSoldOut ? "Full" : "Register for Event (Free)"}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Dual Payment Checkout Modal (F63) ─── */}
            <AnimatePresence>
                {checkoutModalOpen && (
                    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden my-auto"
                        >
                            {/* Modal Header */}
                            <div className="flex justify-between items-center px-5 py-3.5 border-b border-slate-100 shrink-0 bg-white">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                                        <Ticket size={18} />
                                    </div>
                                    <h3 className="text-base sm:text-lg font-black text-slate-900">Event Ticket Checkout</h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => !paymentProcessing && setCheckoutModalOpen(false)}
                                    disabled={paymentProcessing}
                                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Modal Scrollable Body */}
                            <div className="p-5 overflow-y-auto flex-1 space-y-4 text-left">
                                {/* Order Summary */}
                                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5">
                                    <h4 className="font-extrabold text-sm text-slate-900 mb-1">{event.title}</h4>
                                    <div className="flex justify-between items-center text-xs text-slate-500 mb-2">
                                        <span>{event.date} • {event.time}</span>
                                        <span className="text-base font-black text-slate-900 font-mono">
                                            ₹{event.price}
                                        </span>
                                    </div>
                                    <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200/60 rounded-lg p-2 font-medium">
                                        ✓ Instant digital boarding pass with unique verification QR code
                                    </div>
                                </div>

                                {/* Attendee Info Form */}
                                <div className="space-y-2.5">
                                    <label className="block text-xs font-bold text-slate-700">Attendee Details:</label>
                                    <div>
                                        <input
                                            type="text"
                                            placeholder="Full Name"
                                            value={attendeeName}
                                            onChange={(e) => setAttendeeName(e.target.value)}
                                            className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a2b8c]"
                                        />
                                    </div>
                                    <div>
                                        <input
                                            type="email"
                                            placeholder="Email Address"
                                            value={attendeeEmail}
                                            onChange={(e) => setAttendeeEmail(e.target.value)}
                                            className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a2b8c]"
                                        />
                                    </div>
                                    <div>
                                        <input
                                            type="tel"
                                            placeholder="Phone Number (optional)"
                                            value={attendeePhone}
                                            onChange={(e) => setAttendeePhone(e.target.value)}
                                            className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a2b8c]"
                                        />
                                    </div>
                                </div>

                                {/* Payment Method Selector */}
                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-slate-700">Choose Payment Method:</label>

                                    {/* Razorpay */}
                                    <div
                                        onClick={() => !paymentProcessing && setPaymentMethod("razorpay")}
                                        className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                                            paymentMethod === "razorpay"
                                                ? "border-[#1a2b8c] bg-blue-50/40 ring-1 ring-[#1a2b8c]"
                                                : "border-slate-200 hover:border-slate-300"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-xl bg-blue-100/70 text-[#1a2b8c] flex items-center justify-center shrink-0">
                                                <CreditCard size={15} />
                                            </div>
                                            <div>
                                                <div className="font-bold text-xs text-slate-900">Razorpay Online Payment</div>
                                                <div className="text-[10px] text-slate-500">UPI, Cards, NetBanking</div>
                                            </div>
                                        </div>
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                            paymentMethod === "razorpay" ? "border-[#1a2b8c] bg-[#1a2b8c]" : "border-slate-300"
                                        }`}>
                                            {paymentMethod === "razorpay" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                        </div>
                                    </div>

                                    {/* KaamMilega Wallet */}
                                    <div
                                        onClick={() => !paymentProcessing && setPaymentMethod("wallet")}
                                        className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                                            paymentMethod === "wallet"
                                                ? "border-[#1a2b8c] bg-blue-50/40 ring-1 ring-[#1a2b8c]"
                                                : "border-slate-200 hover:border-slate-300"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center shrink-0">
                                                <Wallet size={15} />
                                            </div>
                                            <div>
                                                <div className="font-bold text-xs text-slate-900">KaamMilega Wallet</div>
                                                <div className="text-[10px] text-slate-500">
                                                    Available Balance: <span className="font-mono font-bold text-slate-800">₹{walletBalance.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                            paymentMethod === "wallet" ? "border-[#1a2b8c] bg-[#1a2b8c]" : "border-slate-300"
                                        }`}>
                                            {paymentMethod === "wallet" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                        </div>
                                    </div>

                                    {paymentMethod === "wallet" && !isWalletSufficient && (
                                        <div className="p-2.5 bg-amber-50 border border-amber-200/80 rounded-xl text-[11px] text-amber-800 flex items-center justify-between">
                                            <span>Insufficient balance.</span>
                                            <Link href="/wallet" className="font-bold underline text-amber-900">Top up Wallet</Link>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Modal Actions Footer */}
                            <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-slate-100 bg-slate-50/60 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setCheckoutModalOpen(false)}
                                    disabled={paymentProcessing}
                                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer disabled:opacity-50"
                                >
                                    Cancel
                                </button>

                                {paymentMethod === "razorpay" ? (
                                    <button
                                        type="button"
                                        onClick={handleRazorpayCheckout}
                                        disabled={paymentProcessing}
                                        className="bg-[#1a2b8c] hover:bg-[#152370] text-white px-5 py-2 rounded-xl font-bold text-xs transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-60"
                                    >
                                        {paymentProcessing ? (
                                            <>
                                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>Connecting...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Lock size={13} />
                                                <span>Pay ₹{event.price} with Razorpay</span>
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleWalletCheckout}
                                        disabled={paymentProcessing || !isWalletSufficient}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-bold text-xs transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                    >
                                        {paymentProcessing ? (
                                            <>
                                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>Processing...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Wallet size={14} />
                                                <span>Pay ₹{event.price} from Wallet</span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ─── Digital Boarding Pass Ticket Modal (F63) ─── */}
            <AnimatePresence>
                {ticketModalOpen && ticket && (
                    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden my-auto flex flex-col"
                        >
                            {/* Modal Close Header */}
                            <div className="flex justify-between items-center px-5 py-3 bg-slate-900 text-white shrink-0">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center">
                                        <Ticket size={14} />
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-wider text-slate-100">Official Event Ticket Pass</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setTicketModalOpen(false)}
                                    className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
                                >
                                    <X size={14} />
                                </button>
                            </div>

                            {/* Printable Boarding Pass Body */}
                            <div ref={ticketRef} className="p-5 bg-gradient-to-b from-white via-slate-50/50 to-slate-100/50 overflow-x-hidden">
                                {/* Header / Title */}
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="min-w-0 flex-1">
                                        <span className="inline-block text-[9px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 mb-1.5">
                                            ✓ Confirmed Entry Pass
                                        </span>
                                        <h3 className="text-base font-black text-slate-900 leading-snug line-clamp-2">
                                            {ticket.event_title || event.title}
                                        </h3>
                                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                            Hosted by <span className="font-semibold text-slate-700">{event.organizer}</span>
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0 bg-blue-50 border border-blue-100 rounded-xl px-2.5 py-1.5">
                                        <span className="text-[9px] font-bold text-blue-500 uppercase tracking-wider block">Pass Type</span>
                                        <span className="text-xs font-black text-[#1a2b8c] uppercase">
                                            {ticket.amount > 0 ? `₹${ticket.amount}` : 'Free Entry'}
                                        </span>
                                    </div>
                                </div>

                                {/* Event Schedule Strip */}
                                <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-100/80 rounded-xl mb-3 text-xs border border-slate-200/50">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                                            <Calendar size={12} />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-[9px] font-semibold text-slate-400 block uppercase">Date</span>
                                            <span className="font-bold text-[11px] text-slate-800 truncate block">
                                                {ticket.event_date || event.date}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                            <Clock size={12} />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-[9px] font-semibold text-slate-400 block uppercase">Time</span>
                                            <span className="font-bold text-[11px] text-slate-800 truncate block">
                                                {ticket.event_time || event.time || 'TBA'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="col-span-2 pt-1.5 border-t border-slate-200/60 flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                                            <MapPin size={12} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <span className="text-[9px] font-semibold text-slate-400 block uppercase">Location</span>
                                            <span className="font-semibold text-[11px] text-slate-800 truncate block">
                                                {ticket.event_location || event.location}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Perforated Divider with matching notched sides */}
                                <div className="relative my-3 flex items-center overflow-hidden">
                                    <div className="w-2.5 h-5 -ml-5 bg-black/75 rounded-r-full shrink-0" />
                                    <div className="flex-1 border-t-2 border-dashed border-slate-300 mx-1.5" />
                                    <div className="w-2.5 h-5 -mr-5 bg-black/75 rounded-l-full shrink-0" />
                                </div>

                                {/* Attendee Info & QR Code */}
                                <div className="flex items-center justify-between gap-3 pt-1">
                                    <div className="space-y-1.5 min-w-0 flex-1 text-left">
                                        <div>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Attendee</span>
                                            <span className="font-black text-xs text-slate-900 truncate block">{ticket.attendee_name}</span>
                                        </div>
                                        <div>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Email</span>
                                            <span className="font-medium text-[11px] text-slate-600 truncate block">{ticket.attendee_email}</span>
                                        </div>
                                        <div>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Ticket ID</span>
                                            <span className="font-mono font-black text-[11px] text-[#1a2b8c] bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60 inline-block">
                                                {ticket.ticket_number}
                                            </span>
                                        </div>
                                    </div>

                                    {/* QR Code Container */}
                                    <div className="flex flex-col items-center bg-white p-2 rounded-xl border border-slate-200 shadow-xs shrink-0">
                                        <div className="w-20 h-20 bg-slate-950 p-1.5 rounded-lg flex items-center justify-center text-white">
                                            <QrCode size={64} className="text-white" />
                                        </div>
                                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider mt-1">
                                            Scan at Entry
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Ticket Actions Footer */}
                            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-3 shrink-0">
                                <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1.5">
                                    <ShieldCheck size={15} /> Verified Platform Pass
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handlePrintTicket}
                                        className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-300 cursor-pointer shadow-xs"
                                    >
                                        <Printer size={13} />
                                        <span>Print</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTicketModalOpen(false)}
                                        className="px-4 py-1.5 bg-[#1a2b8c] hover:bg-[#152370] text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default EventDetailsPage;
