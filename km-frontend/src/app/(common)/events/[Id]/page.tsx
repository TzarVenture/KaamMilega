'use client'

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeftIcon, ArrowRightIcon, ArrowSquareOutIcon, CalendarBlankIcon, CheckCircleIcon, CheckIcon, ClockIcon, CreditCardIcon, LockIcon, PrinterIcon, QrCodeIcon, ShieldCheckIcon, TicketIcon, UsersIcon, VideoCameraIcon, WalletIcon, WarningCircleIcon, XIcon } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/axios';
import { isAuthenticated } from '@/lib/auth';
import { notify } from "@/lib/notify";
import Link from 'next/link';
import AttendeeListModal from '@/components/km/AttendeeListModal';

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

// ─── Design.md Shimmer Skeleton ───
const DetailSkeleton = () => (
    <div className="bg-km-surface min-h-screen">
        <div className="relative h-64 md:h-80 bg-[#E5ECF5] animate-shimmer w-full dark:bg-white/5" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8 -mt-16 relative z-20">
            <div className="flex-1 space-y-6">
                <div className="bg-km-surface-card rounded-2xl p-8 border border-km-border space-y-4">
                    <div className="h-6 bg-km-surface animate-shimmer rounded-md w-1/3" />
                    <div className="h-8 bg-km-surface animate-shimmer rounded-md w-3/4" />
                    <div className="space-y-2 pt-4">
                        <div className="h-4 bg-km-surface animate-shimmer rounded w-full" />
                        <div className="h-4 bg-km-surface animate-shimmer rounded w-5/6" />
                        <div className="h-4 bg-km-surface animate-shimmer rounded w-4/6" />
                    </div>
                </div>
            </div>
            <div className="w-full lg:w-96">
                <div className="bg-km-surface-card rounded-2xl p-6 border border-km-border space-y-5">
                    <div className="h-5 bg-km-surface animate-shimmer rounded w-1/2" />
                    <div className="h-12 bg-km-surface animate-shimmer rounded-xl w-full" />
                    <div className="h-12 bg-km-surface animate-shimmer rounded-xl w-full" />
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
    const [isAttendeeModalOpen, setIsAttendeeModalOpen] = useState(false);

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
                if (isAuthenticated()) {
                    fetchUserTicket();
                    fetchWalletBalance();
                }
            } catch (error: any) {
                notify.error(error, "Failed to load workshop details");
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
            // Not ticketed yet
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
            if (typeof window !== "undefined" && (window as any).Razorpay) {
                resolve(true);
                return;
            }
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    // Free 1-Click Registration
    const handleFreeRegister = async () => {
        if (!isAuthenticated()) {
            notify.info("Please login to register for this session");
            router.push(`/login?redirect=/events/${Id}`);
            return;
        }

        try {
            setRegistering(true);
            await api.post(`/events/${Id}/register`);
            notify.success("Successfully registered for the workshop!");
            setIsRegistered(true);
            await fetchUserTicket();
            setTicketModalOpen(true);
        } catch (error: any) {
            notify.error(error, "Failed to register");
        } finally {
            setRegistering(false);
        }
    };

    // Open Paid Checkout Modal
    const handleOpenCheckout = () => {
        if (!isAuthenticated()) {
            notify.info("Please login to purchase workshop tickets");
            router.push(`/login?redirect=/events/${Id}`);
            return;
        }
        setCheckoutModalOpen(true);
    };

    // Razorpay Paid Checkout
    const handleRazorpayCheckout = async () => {
        if (!attendeeName.trim() || !attendeeEmail.trim()) {
            notify.error("Please provide attendee name and email");
            return;
        }

        try {
            setPaymentProcessing(true);
            const loaded = await loadRazorpayScript();
            if (!loaded) {
                notify.error("Failed to load Razorpay payment gateway. Please check connection.");
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
                name: "KaamMilega Workshops",
                description: `Pass: ${orderRes.event_title}`,
                order_id: orderRes.order_id,
                prefill: {
                    name: attendeeName,
                    email: attendeeEmail,
                    contact: attendeePhone,
                },
                theme: { color: "#071A4D" },
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

                        notify.success("Payment successful! Your workshop seat is confirmed.");
                        setIsRegistered(true);
                        setTicket(verifyRes.ticket);
                        setCheckoutModalOpen(false);
                        setTicketModalOpen(true);
                    } catch (err: any) {
                        notify.error(err, "Payment verification failed");
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
                notify.error(`Payment Failed: ${resp.error?.description || "Unknown error"}`);
                setPaymentProcessing(false);
            });
            rzp.open();
        } catch (error: any) {
            notify.error(error, "Failed to initialize payment");
            setPaymentProcessing(false);
        }
    };

    // Wallet 1-Click Paid Checkout
    const handleWalletCheckout = async () => {
        if (!attendeeName.trim() || !attendeeEmail.trim()) {
            notify.error("Please provide attendee name and email");
            return;
        }

        try {
            setPaymentProcessing(true);
            const res: any = await api.post(`/events/${Id}/wallet-checkout`, {
                attendee_name: attendeeName,
                attendee_email: attendeeEmail,
                attendee_phone: attendeePhone,
            });

            notify.success("Workshop pass booked successfully using Wallet balance!");
            setIsRegistered(true);
            setTicket(res.ticket);
            setCheckoutModalOpen(false);
            setTicketModalOpen(true);
            if (res.wallet) setWallet(res.wallet);
        } catch (error: any) {
            notify.error(error, "Wallet checkout failed");
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

    // Meeting link resolution (if event.location contains meet/zoom or is online)
    const isOnlineSession = !event.location || event.location.toLowerCase().includes('online') || event.location.toLowerCase().includes('zoom') || event.location.toLowerCase().includes('meet') || event.location.startsWith('http');
    const meetingUrl = event.location?.startsWith('http') 
        ? event.location 
        : `https://meet.google.com/new`;

    return (
        <div className="bg-km-surface min-h-screen pb-20 font-sans">

            {/* ─── Hero Banner with Master Deep Navy ─── */}
            <div className="relative h-60 sm:h-72 lg:h-80 w-full bg-[#071A4D] overflow-hidden border-b border-[#0B1F52] dark:border-km-link">
                {event.image_url ? (
                    <img
                        src={event.image_url}
                        alt={event.title}
                        className="w-full h-full object-cover opacity-35"
                    />
                ) : (
                    <div className="w-full h-full bg-[#071A4D] flex items-center justify-center dark:bg-km-primary">
                        <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#F59E0B]">
                            <CalendarBlankIcon size={40} />
                        </div>
                    </div>
                )}
                
                {/* Back to Events Nav Button */}
                <div className="absolute top-6 left-4 sm:left-8 z-20">
                    <Link
                        href="/events"
                        className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-all border border-white/20 shadow-xs"
                    >
                        <ArrowLeftIcon weight="bold" size={15} /> Back to Workshops
                    </Link>
                </div>
            </div>

            {/* ─── Main Content Container ─── */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8 -mt-20 relative z-20">
                {/* ── Left Column: Details & Live Meeting Access ── */}
                <div className="flex-1 space-y-6">
                    {/* Primary Workshop Card */}
                    <div className="bg-km-surface-card rounded-2xl p-6 sm:p-8 border border-km-border shadow-xs">
                        {/* Event Tags */}
                        <div className="flex flex-wrap items-center gap-2.5 mb-3.5">
                            <span className="text-[11px] font-semibold text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] px-2.5 py-0.5 rounded-md dark:text-orange-400 dark:bg-amber-500/15">
                                {event.category || 'Skill Workshop'}
                            </span>
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-md ${
                                isPaid
                                    ? 'bg-[#FF6B00] text-white'
                                    : 'bg-[#071A4D] text-white dark:bg-km-primary'
                            }`}>
                                {isPaid ? `Paid Masterclass • ₹${event.price}` : 'Free Entry Pass'}
                            </span>
                            {isOnlineSession && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                                    <VideoCameraIcon weight="bold" size={12} className="text-emerald-600 dark:text-emerald-400" /> Live Video Session
                                </span>
                            )}
                        </div>

                        {/* Title */}
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-km-text-primary mb-2 leading-snug">
                            {event.title}
                        </h1>

                        <p className="text-sm text-km-text-secondary font-normal mb-6">
                            Conducted by <span className="font-semibold text-km-text-primary">{event.organizer}</span>
                            <span className="text-km-link ml-2 text-xs font-medium">• Verified Expert Practitioner</span>
                        </p>

                        {/* Description */}
                        <div className="border-t border-km-border pt-6">
                            <h3 className="text-base font-bold text-km-text-primary mb-3">About this Masterclass</h3>
                            <p className="text-sm text-km-text-secondary leading-relaxed whitespace-pre-line font-normal">
                                {event.description || "Join this expert-led masterclass to acquire practical skills, trade techniques, and career insights. Interactive Q&A will be conducted at the end of the session."}
                            </p>
                        </div>
                    </div>

                    {/* ── Live Session & Meeting Link Section (Google Meet / Zoom) ── */}
                    {isRegistered ? (
                        <div className="bg-km-surface-card rounded-2xl p-6 sm:p-7 border-2 border-[#10B981]/40 shadow-xs space-y-4">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2.5 text-emerald-700 font-bold text-sm">
                                    <VideoCameraIcon size={20} className="text-emerald-600 shrink-0 dark:text-emerald-400" aria-hidden="true" />
                                    <span>Live Video Conference & Room Access</span>
                                </div>
                                <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                    <CheckCircleIcon weight="bold" size={12} /> Entry Pass Active
                                </span>
                            </div>

                            <p className="text-xs text-km-text-secondary leading-relaxed">
                                Your pass has been issued. Use the secure meeting link below to join the live video session at the scheduled date and time:
                            </p>

                            <div className="p-4 bg-km-surface rounded-xl border border-km-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    <VideoCameraIcon size={24} weight="duotone" className="text-km-link shrink-0" aria-hidden="true" />
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-km-text-primary truncate">
                                            {isOnlineSession ? "Interactive Google Meet / Zoom Room" : event.location}
                                        </p>
                                        <p className="text-[11px] text-km-text-secondary truncate">
                                            Ticket Pass ID: <span className="font-mono font-semibold text-km-heading">{ticket?.ticket_number || "CONFIRMED"}</span>
                                        </p>
                                    </div>
                                </div>

                                <a
                                    href={meetingUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-accent text-xs px-4 py-2.5 shrink-0 inline-flex items-center gap-1.5 shadow-xs"
                                >
                                    <VideoCameraIcon weight="bold" size={14} />
                                    <span>Join Meeting Room</span>
                                    <ArrowSquareOutIcon weight="bold" size={12} />
                                </a>
                            </div>

                            <p className="text-[11px] text-km-text-secondary">
                                Note: Please join 5 minutes before scheduled start ({event.time || "scheduled time"}). The expert host admits participants with verified ticket pass numbers.
                            </p>
                        </div>
                    ) : (
                        <div className="bg-[#FFFBEB] rounded-2xl p-5 sm:p-6 border border-[#FDE68A] shadow-xs dark:bg-amber-500/15">
                            <div className="flex items-start gap-3.5">
                                <LockIcon size={22} className="text-[#B45309] shrink-0 mt-0.5 dark:text-orange-400" aria-hidden="true" />
                                <div className="flex-1">
                                    <h4 className="text-sm font-bold text-km-text-primary">Live Session Meeting Room (Google Meet / Zoom)</h4>
                                    <p className="text-xs text-km-text-secondary mt-1 leading-relaxed">
                                        The direct video conference link, meeting ID, and workshop handouts unlock automatically for your account once you reserve a pass for this session.
                                    </p>
                                    <div className="mt-3 flex items-center gap-2">
                                        <span className="text-[11px] font-semibold text-[#B45309] bg-km-surface-card border border-[#FDE68A] px-2.5 py-1 rounded-lg dark:text-orange-400">
                                            Locked for Registered Learners
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* What You'll Learn / Inclusions Grid */}
                    <div className="bg-km-surface-card rounded-2xl p-6 sm:p-7 border border-km-border shadow-xs">
                        <h3 className="text-base font-bold text-km-text-primary mb-4">Workshop Deliverables</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs text-km-text-secondary">
                            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-km-surface border border-km-border/70">
                                <CheckIcon weight="bold" size={16} className="text-[#10B981] shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold text-km-text-primary">Direct Live Interaction</p>
                                    <p className="text-[11px] text-km-text-secondary mt-0.5">Interactive Q&A with real-time feedback from the expert.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-km-surface border border-km-border/70">
                                <CheckIcon weight="bold" size={16} className="text-[#10B981] shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold text-km-text-primary">Verified Skill Takeaways</p>
                                    <p className="text-[11px] text-km-text-secondary mt-0.5">Practical knowledge you can immediately apply to jobs.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-km-surface border border-km-border/70">
                                <CheckIcon weight="bold" size={16} className="text-[#10B981] shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold text-km-text-primary">Digital Boarding Pass</p>
                                    <p className="text-[11px] text-km-text-secondary mt-0.5">Unique QR-verified pass stored inside your account.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-km-surface border border-km-border/70">
                                <CheckIcon weight="bold" size={16} className="text-[#10B981] shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold text-km-text-primary">Direct Mentorship Connect</p>
                                    <p className="text-[11px] text-km-text-secondary mt-0.5">Opportunity to book follow-up 1-on-1 expert sessions.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Host Sessions Banner (Callout for Practitioners) */}
                    <div className="bg-km-surface-card rounded-2xl p-6 border border-km-border shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <h4 className="text-sm font-bold text-km-text-primary">Are you an experienced trade professional or expert?</h4>
                                <p className="text-xs text-km-text-secondary max-w-lg leading-relaxed">
                                    Apply to become a verified expert on KaamMilega. Host workshops, teach candidates, and earn directly with integrated video links and wallet payouts.
                                </p>
                            </div>
                            <Link
                                href="/expert/apply"
                                className="btn-outline text-xs px-4 py-2 shrink-0 inline-flex items-center gap-1.5"
                            >
                                <span>Apply as Expert</span>
                                <ArrowRightIcon weight="bold" size={13} />
                            </Link>
                        </div>
                    </div>
                </div>

                {/* ── Right Column: Sidebar Registration Pass ── */}
                <div className="w-full lg:w-96">
                    <div className="lg:sticky lg:top-24 space-y-5">
                        <div className="km-card p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-5 pb-3 border-b border-km-border">
                                <h3 className="text-base font-bold text-km-text-primary">Workshop Pass</h3>
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                                    isPaid ? 'bg-[#FF6B00] text-white' : 'bg-[#071A4D] text-white dark:bg-km-primary'
                                }`}>
                                    {isPaid ? `₹${event.price}` : 'Free Entry'}
                                </span>
                            </div>

                            {/* Meta Info */}
                            <div className="space-y-3.5 mb-6">
                                <div className="flex items-center gap-3">
                                    <CalendarBlankIcon size={24} weight="duotone" className="text-[#F59E0B] shrink-0" aria-hidden="true" />
                                    <div>
                                        <p className="text-[10px] font-semibold text-km-text-secondary uppercase tracking-wider">Date</p>
                                        <p className="text-sm font-bold text-km-text-primary">{event.date}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <ClockIcon size={24} weight="duotone" className="text-km-heading shrink-0" aria-hidden="true" />
                                    <div>
                                        <p className="text-[10px] font-semibold text-km-text-secondary uppercase tracking-wider">Time</p>
                                        <p className="text-sm font-bold text-km-text-primary">{event.time || 'TBA'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <VideoCameraIcon size={24} weight="duotone" className="text-[#FF6B00] shrink-0" aria-hidden="true" />
                                    <div>
                                        <p className="text-[10px] font-semibold text-km-text-secondary uppercase tracking-wider">Format</p>
                                        <p className="text-sm font-bold text-km-text-primary">
                                            {isOnlineSession ? "Online (Google Meet / Zoom)" : event.location}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Participant / Seat count (Clickable for Attendee Modal) */}
                            <div 
                                onClick={() => setIsAttendeeModalOpen(true)}
                                className="bg-km-surface hover:bg-blue-50/70 border border-km-border hover:border-[#0B5ED7]/40 rounded-xl py-3 px-4 mb-5 text-center transition-all cursor-pointer group shadow-2xs"
                                title="Click to view confirmed attendees"
                            >
                                <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-km-text-primary group-hover:text-km-link transition-colors flex-wrap">
                                    <UsersIcon weight="bold" size={14} className="text-km-heading group-hover:scale-110 transition-transform" />
                                    <span className="text-km-heading font-bold">{participantCount}</span> 
                                    <span>{participantCount === 1 ? 'learner has' : 'learners have'} registered</span>
                                    <span className="text-[10px] text-km-heading bg-km-surface-card border border-km-border px-2 py-0.5 rounded-full font-bold ml-1 transition-all">
                                        View All
                                    </span>
                                </div>
                                {event.capacity && event.capacity > 0 ? (
                                    <p className="text-[11px] text-km-text-secondary font-medium mt-1">
                                        {event.available_seats ?? event.capacity} seats remaining of {event.capacity} total
                                    </p>
                                ) : null}
                            </div>

                            {/* Action Buttons */}
                            {isRegistered ? (
                                <div className="space-y-3">
                                    <div className="w-full py-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2">
                                        <CheckCircleIcon weight="bold" size={16} /> You're Registered!
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (ticket) setTicketModalOpen(true);
                                            else fetchUserTicket().then(() => setTicketModalOpen(true));
                                        }}
                                        className="btn-primary w-full py-3.5 text-xs shadow-md cursor-pointer"
                                    >
                                        <QrCodeIcon weight="bold" size={16} />
                                        <span>View Digital Pass & QR</span>
                                    </button>
                                    {isOnlineSession && (
                                        <a
                                            href={meetingUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn-accent w-full py-3 text-xs shadow-md inline-flex items-center justify-center gap-2"
                                        >
                                            <VideoCameraIcon weight="bold" size={15} />
                                            <span>Join Live Session</span>
                                        </a>
                                    )}
                                </div>
                            ) : isPaid ? (
                                isSoldOut ? (
                                    <button disabled className="w-full py-3.5 bg-[#E5ECF5] text-km-text-secondary rounded-xl font-bold text-sm cursor-not-allowed dark:bg-white/5">
                                        Workshop Full
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleOpenCheckout}
                                        className="btn-accent w-full py-3.5 text-sm shadow-md cursor-pointer"
                                    >
                                        <TicketIcon weight="bold" size={16} />
                                        <span>Book Pass • ₹{event.price}</span>
                                    </button>
                                )
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleFreeRegister}
                                    disabled={registering || isSoldOut}
                                    className="btn-primary w-full py-3.5 text-sm shadow-md cursor-pointer disabled:opacity-60"
                                >
                                    {registering ? "Reserving Pass..." : isSoldOut ? "Workshop Full" : "Register for Workshop (Free)"}
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
                            className="bg-km-surface-card rounded-2xl max-w-md w-full max-h-[90vh] flex flex-col shadow-2xl border border-km-border overflow-hidden my-auto"
                        >
                            {/* Modal Header */}
                            <div className="flex justify-between items-center px-5 py-3.5 border-b border-km-border shrink-0 bg-km-surface-card">
                                <div className="flex items-center gap-2">
                                    <TicketIcon size={20} className="text-[#F59E0B]" aria-hidden="true" />
                                    <h3 className="text-base font-bold text-km-text-primary">Workshop Pass Checkout</h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => !paymentProcessing && setCheckoutModalOpen(false)}
                                    disabled={paymentProcessing}
                                    className="w-8 h-8 rounded-full bg-km-surface hover:bg-[#D9E0EA] flex items-center justify-center text-km-text-secondary transition-colors cursor-pointer dark:hover:bg-white/10"
                                >
                                    <XIcon weight="bold" size={16} />
                                </button>
                            </div>

                            {/* Modal Scrollable Body */}
                            <div className="p-5 overflow-y-auto flex-1 space-y-4 text-left">
                                {/* Order Summary */}
                                <div className="bg-km-surface border border-km-border rounded-2xl p-4">
                                    <h4 className="font-bold text-sm text-km-text-primary mb-1">{event.title}</h4>
                                    <div className="flex justify-between items-center text-xs text-km-text-secondary mb-2">
                                        <span>{event.date} • {event.time}</span>
                                        <span className="text-base font-bold text-km-heading font-mono">
                                            ₹{event.price}
                                        </span>
                                    </div>
                                    <div className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200/60 rounded-lg p-2 font-medium">
                                        ✓ Includes live Google Meet / Zoom link and verified entry boarding pass
                                    </div>
                                </div>

                                {/* Attendee Info Form */}
                                <div className="space-y-2.5">
                                    <label className="block text-xs font-semibold text-km-text-primary">Attendee Details:</label>
                                    <div>
                                        <input
                                            type="text"
                                            placeholder="Full Name"
                                            value={attendeeName}
                                            onChange={(e) => setAttendeeName(e.target.value)}
                                            className="w-full text-xs font-medium bg-km-surface-card border border-km-border rounded-xl px-3.5 py-2.5 focus:outline-hidden focus:border-[#0B5ED7] focus:ring-2 focus:ring-[#0B5ED7]/10"
                                        />
                                    </div>
                                    <div>
                                        <input
                                            type="email"
                                            placeholder="Email Address"
                                            value={attendeeEmail}
                                            onChange={(e) => setAttendeeEmail(e.target.value)}
                                            className="w-full text-xs font-medium bg-km-surface-card border border-km-border rounded-xl px-3.5 py-2.5 focus:outline-hidden focus:border-[#0B5ED7] focus:ring-2 focus:ring-[#0B5ED7]/10"
                                        />
                                    </div>
                                    <div>
                                        <input
                                            type="tel"
                                            placeholder="Phone Number (optional)"
                                            value={attendeePhone}
                                            onChange={(e) => setAttendeePhone(e.target.value)}
                                            className="w-full text-xs font-medium bg-km-surface-card border border-km-border rounded-xl px-3.5 py-2.5 focus:outline-hidden focus:border-[#0B5ED7] focus:ring-2 focus:ring-[#0B5ED7]/10"
                                        />
                                    </div>
                                </div>

                                {/* Payment Method Selector */}
                                <div className="space-y-2">
                                    <label className="block text-xs font-semibold text-km-text-primary">Choose Payment Method:</label>

                                    {/* Razorpay */}
                                    <div
                                        onClick={() => !paymentProcessing && setPaymentMethod("razorpay")}
                                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                            paymentMethod === "razorpay"
                                                ? "border-[#071A4D] bg-[#071A4D]/5 ring-1 ring-[#071A4D] dark:border-km-link dark:bg-km-primary dark:ring-km-link"
                                                : "border-km-border hover:border-slate-300"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <CreditCardIcon size={20} className="text-km-heading shrink-0" aria-hidden="true" />
                                            <div>
                                                <div className="font-bold text-xs text-km-text-primary">Razorpay Online Checkout</div>
                                                <div className="text-[10px] text-km-text-secondary">UPI, Cards, NetBanking</div>
                                            </div>
                                        </div>
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                            paymentMethod === "razorpay" ? "border-[#071A4D] bg-[#071A4D] dark:border-km-link dark:bg-km-primary" : "border-slate-300"
                                        }`}>
                                            {paymentMethod === "razorpay" && <div className="w-1.5 h-1.5 rounded-full bg-km-surface-card" />}
                                        </div>
                                    </div>

                                    {/* KaamMilega Wallet */}
                                    <div
                                        onClick={() => !paymentProcessing && setPaymentMethod("wallet")}
                                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                            paymentMethod === "wallet"
                                                ? "border-[#071A4D] bg-[#071A4D]/5 ring-1 ring-[#071A4D] dark:border-km-link dark:bg-km-primary dark:ring-km-link"
                                                : "border-km-border hover:border-slate-300"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <WalletIcon size={20} className="text-emerald-700 shrink-0" aria-hidden="true" />
                                            <div>
                                                <div className="font-bold text-xs text-km-text-primary">KaamMilega Wallet</div>
                                                <div className="text-[10px] text-km-text-secondary">
                                                    Available Balance: <span className="font-mono font-bold text-km-text-primary">₹{walletBalance.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                            paymentMethod === "wallet" ? "border-[#071A4D] bg-[#071A4D] dark:border-km-link dark:bg-km-primary" : "border-slate-300"
                                        }`}>
                                            {paymentMethod === "wallet" && <div className="w-1.5 h-1.5 rounded-full bg-km-surface-card" />}
                                        </div>
                                    </div>

                                    {paymentMethod === "wallet" && !isWalletSufficient && (
                                        <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center gap-1.5">
                                            <WarningCircleIcon weight="bold" size={13} className="text-amber-600 shrink-0 dark:text-amber-400" />
                                            <span>Insufficient wallet balance. Please select Razorpay or refill wallet.</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="px-5 py-3.5 bg-km-surface border-t border-km-border flex items-center justify-between shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setCheckoutModalOpen(false)}
                                    disabled={paymentProcessing}
                                    className="px-4 py-2 text-xs font-semibold text-km-text-secondary hover:text-km-text-primary cursor-pointer disabled:opacity-50"
                                >
                                    Cancel
                                </button>

                                {paymentMethod === "razorpay" ? (
                                    <button
                                        type="button"
                                        onClick={handleRazorpayCheckout}
                                        disabled={paymentProcessing}
                                        className="btn-primary text-xs px-5 py-2.5 shadow-md active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-60"
                                    >
                                        {paymentProcessing ? (
                                            <>
                                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>Connecting...</span>
                                            </>
                                        ) : (
                                            <>
                                                <LockIcon weight="bold" size={13} />
                                                <span>Pay ₹{event.price} with Razorpay</span>
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleWalletCheckout}
                                        disabled={paymentProcessing || !isWalletSufficient}
                                        className="btn-accent text-xs px-5 py-2.5 shadow-md active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                    >
                                        {paymentProcessing ? (
                                            <>
                                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>Processing...</span>
                                            </>
                                        ) : (
                                            <>
                                                <WalletIcon weight="bold" size={13} />
                                                <span>Confirm & Pay from Wallet</span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ─── Digital Pass & QR Code Modal (F63) ─── */}
            <AnimatePresence>
                {ticketModalOpen && ticket && (
                    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 15 }}
                            className="bg-km-surface-card rounded-2xl max-w-sm sm:max-w-md w-full shadow-2xl border border-km-border overflow-hidden my-auto"
                        >
                            {/* Modal Action Bar */}
                            <div className="flex justify-between items-center px-5 py-3 border-b border-km-border bg-km-surface-card">
                                <span className="text-xs font-bold text-km-text-primary flex items-center gap-1.5 uppercase tracking-wider">
                                    <TicketIcon weight="bold" size={14} className="text-[#FF6B00]" /> Digital Workshop Pass
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setTicketModalOpen(false)}
                                    className="w-8 h-8 rounded-full bg-km-surface hover:bg-[#D9E0EA] flex items-center justify-center text-km-text-secondary transition-colors cursor-pointer dark:hover:bg-white/10"
                                >
                                    <XIcon weight="bold" size={16} />
                                </button>
                            </div>

                            {/* Printable Ticket Container */}
                            <div ref={ticketRef} className="p-5 sm:p-6 bg-km-surface-card">
                                {/* Ticket Header */}
                                <div className="flex items-start justify-between gap-3 mb-4">
                                    <div>
                                        <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1 mb-1">
                                            <CheckCircleIcon weight="bold" size={11} className="text-emerald-600 dark:text-emerald-400" /> Pass Confirmed
                                        </span>
                                        <h3 className="font-bold text-base text-km-text-primary leading-snug line-clamp-2">
                                            {ticket.event_title || event.title}
                                        </h3>
                                        <p className="text-xs text-km-text-secondary">
                                            By {event.organizer}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0 bg-km-surface border border-km-border rounded-xl px-2.5 py-1.5">
                                        <span className="text-[9px] font-semibold text-km-text-secondary uppercase tracking-wider block">Pass Type</span>
                                        <span className="text-xs font-bold text-km-heading uppercase">
                                            {ticket.amount > 0 ? `₹${ticket.amount}` : 'Free Entry'}
                                        </span>
                                    </div>
                                </div>

                                {/* Event Schedule Strip */}
                                <div className="grid grid-cols-2 gap-2 p-3 bg-km-surface rounded-xl mb-3 text-xs border border-km-border">
                                    <div className="flex items-center gap-2">
                                        <CalendarBlankIcon weight="bold" size={16} className="text-[#F59E0B] shrink-0" aria-hidden="true" />
                                        <div className="min-w-0">
                                            <span className="text-[9px] font-semibold text-km-text-secondary block uppercase">Date</span>
                                            <span className="font-bold text-[11px] text-km-text-primary truncate block">
                                                {ticket.event_date || event.date}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <ClockIcon weight="bold" size={16} className="text-km-heading shrink-0" aria-hidden="true" />
                                        <div className="min-w-0">
                                            <span className="text-[9px] font-semibold text-km-text-secondary block uppercase">Time</span>
                                            <span className="font-bold text-[11px] text-km-text-primary truncate block">
                                                {ticket.event_time || event.time || 'TBA'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="col-span-2 pt-2 border-t border-km-border flex items-center gap-2">
                                        <VideoCameraIcon weight="bold" size={16} className="text-emerald-700 shrink-0" aria-hidden="true" />
                                        <div className="min-w-0 flex-1">
                                            <span className="text-[9px] font-semibold text-km-text-secondary block uppercase">Room / Location</span>
                                            <span className="font-semibold text-[11px] text-km-text-primary truncate block">
                                                {isOnlineSession ? "Online Video Room (Google Meet / Zoom)" : (ticket.event_location || event.location)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Perforated Divider with matching notched sides */}
                                <div className="relative my-3 flex items-center overflow-hidden">
                                    <div className="w-2.5 h-5 -ml-5 bg-black/75 rounded-r-full shrink-0" />
                                    <div className="flex-1 border-t-2 border-dashed border-km-border mx-1.5" />
                                    <div className="w-2.5 h-5 -mr-5 bg-black/75 rounded-l-full shrink-0" />
                                </div>

                                {/* Attendee Info & QR Code */}
                                <div className="flex items-center justify-between gap-3 pt-1">
                                    <div className="space-y-1.5 min-w-0 flex-1 text-left">
                                        <div>
                                            <span className="text-[9px] font-semibold text-km-text-secondary uppercase tracking-wider block">Attendee</span>
                                            <span className="font-bold text-xs text-km-text-primary truncate block">{ticket.attendee_name}</span>
                                        </div>
                                        <div>
                                            <span className="text-[9px] font-semibold text-km-text-secondary uppercase tracking-wider block">Email</span>
                                            <span className="font-medium text-[11px] text-km-text-secondary truncate block">{ticket.attendee_email}</span>
                                        </div>
                                        <div>
                                            <span className="text-[9px] font-semibold text-km-text-secondary uppercase tracking-wider block">Pass ID</span>
                                            <span className="font-mono font-bold text-[11px] text-km-heading bg-km-surface px-2 py-0.5 rounded border border-km-border inline-block">
                                                {ticket.ticket_number}
                                            </span>
                                        </div>
                                    </div>

                                    {/* QR Code Container */}
                                    <div className="flex flex-col items-center bg-km-surface-card p-2 rounded-xl border border-km-border shadow-2xs shrink-0">
                                        <div className="w-20 h-20 bg-[#071A4D] p-1.5 rounded-lg flex items-center justify-center text-white dark:bg-km-primary">
                                            <QrCodeIcon size={64} className="text-white" />
                                        </div>
                                        <span className="text-[8px] font-bold uppercase text-km-text-secondary tracking-wider mt-1">
                                            Pass Verification
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Ticket Actions Footer */}
                            <div className="px-5 py-3.5 bg-km-surface border-t border-km-border flex items-center justify-between gap-3 shrink-0">
                                <span className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1.5">
                                    <ShieldCheckIcon weight="bold" size={15} className="text-emerald-600 dark:text-emerald-400" /> Verified KaamMilega Pass
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handlePrintTicket}
                                        className="px-3.5 py-1.5 bg-km-surface-card hover:bg-km-surface text-km-text-primary rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border border-km-border cursor-pointer shadow-2xs"
                                    >
                                        <PrinterIcon weight="bold" size={13} />
                                        <span>Print</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTicketModalOpen(false)}
                                        className="btn-primary text-xs px-4 py-1.5 shadow-2xs cursor-pointer"
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Attendee List Modal (F64) */}
            {isAttendeeModalOpen && (
                <AttendeeListModal
                    isOpen={isAttendeeModalOpen}
                    onClose={() => setIsAttendeeModalOpen(false)}
                    eventId={event.id}
                    eventTitle={event.title}
                    totalJoinedCount={participantCount}
                />
            )}
        </div>
    );
};

export default EventDetailsPage;
