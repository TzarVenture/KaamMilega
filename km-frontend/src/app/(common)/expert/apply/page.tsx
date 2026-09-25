"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, CheckCircle2, ShieldCheck, Star, Calendar, 
  ArrowRight, Award, Zap, Users, DollarSign, Wallet, 
  Clock, ArrowUpRight, X, Lock
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

interface PlanDetails {
  plan_type: string;
  name: string;
  price: number;
  duration_days: number;
  savings_percent: number;
  description: string;
  perks: string[];
}

interface WalletSummary {
  main_balance: number;
  total_balance: number;
  earnings_balance: number;
}

export default function ExpertProSubscriptionPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<PlanDetails[]>([]);
  const [selectedPlanType, setSelectedPlanType] = useState<string>("yearly");
  const [activeSub, setActiveSub] = useState<any | null>(null);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Checkout Modal State
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"razorpay" | "wallet">("razorpay");
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    setIsLoggedIn(!!token);

    fetchPlans();
    if (token) {
      fetchMySubscription();
      fetchWallet();
    }
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const res: any = await api.get("/subscriptions/expert/plans");
      const data = Array.isArray(res) ? res : (res?.data || []);
      if (data.length > 0) {
        setPlans(data);
      } else {
        // Fallback default plans
        setPlans([
          {
            plan_type: "monthly",
            name: "Monthly Pro Expert",
            price: 499,
            duration_days: 30,
            savings_percent: 0,
            description: "Flexible month-to-month access to monetize your industry expertise.",
            perks: [
              "Verified Pro Expert Golden Badge",
              "Featured Placement in Mentorship Directory",
              "Host Unlimited 1-on-1 Paid Sessions",
              "0% Platform Commission on Session Fees",
              "Interactive Availability Schedule Manager",
              "Instant Bank & UPI Earnings Payouts"
            ],
          },
          {
            plan_type: "yearly",
            name: "Annual Pro Expert",
            price: 4499,
            duration_days: 365,
            savings_percent: 25,
            description: "Best value plan for dedicated mentors. Save 25% compared to monthly.",
            perks: [
              "All Monthly Pro Expert Perks",
              "Priority Top-Ranking in Expert Search",
              "Golden Verified Pro Badge Highlight",
              "Save ₹1,489 with Annual Billing (₹375/mo)",
              "Priority VIP Candidate Support",
              "Annual Verified Mentor Certificate"
            ],
          }
        ]);
      }
    } catch (err) {
      console.warn("Failed to fetch plans from backend, using defaults", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMySubscription = async () => {
    try {
      const res: any = await api.get("/subscriptions/expert/my");
      if (res?.is_active && res?.subscription) {
        setActiveSub(res);
      }
    } catch (err) {
      console.warn("Could not check subscription status", err);
    }
  };

  const fetchWallet = async () => {
    try {
      const res: any = await api.get("/wallet/balance");
      setWallet(res);
    } catch (err) {
      console.warn("Could not load wallet", err);
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

  const handleStartCheckout = (planType: string) => {
    if (!isLoggedIn) {
      router.push(`/login?redirect=/expert/apply`);
      return;
    }
    setSelectedPlanType(planType);
    setCheckoutModalOpen(true);
  };

  const selectedPlan = plans.find(p => p.plan_type === selectedPlanType) || plans[0] || {
    plan_type: "monthly",
    name: "Monthly Pro Expert",
    price: 499,
    duration_days: 30,
  };

  const handleRazorpayPayment = async () => {
    try {
      setPaymentProcessing(true);
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error("Failed to load Razorpay checkout gateway. Please check your connection.");
        setPaymentProcessing(false);
        return;
      }

      // 1. Create Order on backend
      const orderRes: any = await api.post("/subscriptions/expert/create-order", {
        plan_type: selectedPlan.plan_type,
      });

      const rzpKey = orderRes.key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

      // 2. Open Razorpay Checkout Modal
      const options = {
        key: rzpKey,
        amount: orderRes.amount_paise,
        currency: orderRes.currency || "INR",
        name: "KaamMilega Pro Expert",
        description: `${selectedPlan.name} Subscription`,
        order_id: orderRes.order_id,
        handler: async (response: any) => {
          try {
            // 3. Verify Payment on backend
            await api.post("/subscriptions/expert/verify-payment", {
              plan_type: selectedPlan.plan_type,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            toast.success("🎉 Welcome to KaamMilega Pro Expert! Subscription activated.");
            setCheckoutModalOpen(false);
            setTimeout(() => {
              router.push("/expert/mentorship");
            }, 1200);
          } catch (err: any) {
            console.error("Verification failed", err);
            toast.error(err?.response?.data?.error || "Payment verification failed. Please contact support.");
          } finally {
            setPaymentProcessing(false);
          }
        },
        theme: {
          color: "#1a2b8c",
        },
        modal: {
          ondismiss: () => {
            setPaymentProcessing(false);
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      console.error("Order creation failed", err);
      toast.error(err?.response?.data?.error || "Failed to initiate payment. Please try again.");
      setPaymentProcessing(false);
    }
  };

  const handleWalletPayment = async () => {
    try {
      setPaymentProcessing(true);
      const res: any = await api.post("/subscriptions/expert/wallet-checkout", {
        plan_type: selectedPlan.plan_type,
      });

      toast.success("🎉 Subscribed successfully via KaamMilega Wallet!");
      setCheckoutModalOpen(false);
      setTimeout(() => {
        router.push("/expert/mentorship");
      }, 1200);
    } catch (err: any) {
      console.error("Wallet checkout failed", err);
      toast.error(err?.response?.data?.error || "Wallet checkout failed. Please check your balance.");
    } finally {
      setPaymentProcessing(false);
    }
  };

  const walletBalance = wallet?.main_balance || 0;
  const isWalletSufficient = walletBalance >= selectedPlan.price;

  return (
    <main className="min-h-screen bg-[#fafafa] pb-24 text-slate-800">
      <ToastContainer position="top-right" autoClose={3000} theme="colored" />

      {/* Hero Banner */}
      <section className="bg-linear-to-br from-slate-950 via-[#0a1128] to-[#1a2b8c] text-white py-16 md:py-24 px-6 md:px-12 rounded-b-[40px] md:rounded-b-[60px] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 text-xs font-bold uppercase tracking-wider text-orange-400 mb-6 border border-white/10 backdrop-blur-xs">
              <Sparkles size={14} />
              <span>KaamMilega Pro Expert Program</span>
            </div>

            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black mb-6 leading-tight tracking-tight">
              Turn Your Industry Expertise <br className="hidden sm:block" /> Into <span className="text-orange-400">Sustainable Income</span>
            </h1>

            <p className="text-sm md:text-lg text-slate-300 max-w-3xl mx-auto leading-relaxed mb-8">
              Join vetted tech leaders, managers, and career coaches hosting 1-on-1 mentorship calls. Set your own session prices, keep 100% of your earnings, and rank at the top of India's expert directory.
            </p>

            {/* Quick Proof Badges */}
            <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 text-xs font-semibold text-slate-300 pt-2">
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-xl">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <span>Zero Commission on Sessions</span>
              </div>
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-xl">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <span>Instant Bank & UPI Payouts</span>
              </div>
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-xl">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <span>Verified Pro Golden Badge</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main Content Container */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 -mt-8 relative z-20">
        {/* Active Subscription Alert if already subscribed */}
        {activeSub && (
          <div className="bg-linear-to-r from-emerald-500 via-teal-600 to-[#1a2b8c] text-white p-5 md:p-6 rounded-3xl mb-10 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white shrink-0">
                <Award size={26} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-white text-emerald-800 px-2.5 py-0.5 rounded-full">
                    Active Subscription
                  </span>
                  <h3 className="font-extrabold text-base md:text-lg">
                    {activeSub.plan_type === "yearly" ? "Annual Pro Expert" : "Monthly Pro Expert"}
                  </h3>
                </div>
                <p className="text-xs text-emerald-100 mt-1">
                  You have <span className="font-bold text-white">{activeSub.days_remaining} days remaining</span> in your billing cycle.
                </p>
              </div>
            </div>
            <Link
              href="/expert/mentorship"
              className="bg-white text-slate-900 hover:bg-slate-100 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <span>Manage Mentorship Dashboard</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        )}

        {/* Plan Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-20 pt-4">
          {plans.map((plan) => {
            const isYearly = plan.plan_type === "yearly";

            return (
              <div
                key={plan.plan_type}
                className={`bg-white rounded-3xl p-6 md:p-8 border transition-all flex flex-col justify-between relative ${
                  isYearly
                    ? "border-orange-500 shadow-xl ring-2 ring-orange-500/20 md:-translate-y-2"
                    : "border-slate-200 shadow-sm hover:border-slate-300"
                }`}
              >
                {isYearly && (
                  <div className="absolute -top-3.5 right-6 bg-linear-to-r from-orange-500 to-amber-500 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-md">
                    Most Popular • Best Value
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1a2b8c]">
                      {isYearly ? <Award size={26} /> : <Zap size={26} />}
                    </div>
                    {isYearly && (
                      <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                        Save 25% Annually
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl md:text-2xl font-black text-slate-900 mb-2">{plan.name}</h3>
                  <p className="text-xs text-slate-500 font-medium mb-6 min-h-[36px]">{plan.description}</p>

                  <div className="flex items-baseline gap-1.5 mb-6 pb-6 border-b border-slate-100">
                    <span className="text-3xl md:text-4xl font-black text-slate-900 font-mono">
                      ₹{plan.price}
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      / {isYearly ? "year (₹375/mo)" : "month"}
                    </span>
                  </div>

                  {/* Perks list */}
                  <div className="space-y-3 mb-8">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                      What's Included:
                    </p>
                    {plan.perks.map((perk, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-xs text-slate-700 font-medium">
                        <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                        <span>{perk}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleStartCheckout(plan.plan_type)}
                  className={`w-full py-3.5 rounded-2xl font-bold text-xs md:text-sm transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${
                    isYearly
                      ? "bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20"
                      : "bg-[#1a2b8c] hover:bg-[#152370] text-white shadow-[#1a2b8c]/20"
                  }`}
                >
                  <span>{activeSub ? "Switch to this Plan" : isYearly ? "Upgrade to Annual" : "Upgrade to Monthly"}</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Dual-Payment Checkout Modal */}
      <AnimatePresence>
        {checkoutModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl border border-slate-100"
            >
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1a2b8c] flex items-center justify-center">
                    <Sparkles size={16} />
                  </div>
                  <h3 className="text-lg font-black text-slate-900">Upgrade to Pro Expert</h3>
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

              {/* Order Summary */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 mb-6">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900">{selectedPlan.name}</h4>
                    <p className="text-xs text-slate-500">
                      Duration: {selectedPlan.duration_days} Days access
                    </p>
                  </div>
                  <span className="text-lg font-black text-slate-900 font-mono">
                    ₹{selectedPlan.price}
                  </span>
                </div>
                <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200/60 rounded-lg p-2 font-medium">
                  ✓ Instant activation of Verified Pro Badge & Mentorship Hosting
                </div>
              </div>

              {/* Select Payment Method */}
              <div className="mb-6 space-y-3">
                <label className="block text-xs font-bold text-slate-700">Choose Payment Method:</label>

                {/* Option 1: Razorpay */}
                <div
                  onClick={() => !paymentProcessing && setPaymentMethod("razorpay")}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    paymentMethod === "razorpay"
                      ? "border-[#1a2b8c] bg-blue-50/30 ring-1 ring-[#1a2b8c]"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-100/70 text-[#1a2b8c] flex items-center justify-center">
                      <CreditCardIcon />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-900">Razorpay Online Payment</div>
                      <div className="text-[10px] text-slate-500">UPI (GPay/PhonePe), Cards, NetBanking</div>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    paymentMethod === "razorpay" ? "border-[#1a2b8c] bg-[#1a2b8c]" : "border-slate-300"
                  }`}>
                    {paymentMethod === "razorpay" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>

                {/* Option 2: Wallet */}
                <div
                  onClick={() => !paymentProcessing && setPaymentMethod("wallet")}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    paymentMethod === "wallet"
                      ? "border-[#1a2b8c] bg-blue-50/30 ring-1 ring-[#1a2b8c]"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center">
                      <Wallet size={18} />
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
                    <span>Insufficient wallet balance.</span>
                    <Link href="/wallet" className="font-bold underline text-amber-900">Top up Wallet</Link>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
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
                    onClick={handleRazorpayPayment}
                    disabled={paymentProcessing}
                    className="bg-[#1a2b8c] hover:bg-[#152370] text-white px-6 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {paymentProcessing ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <Lock size={13} />
                        <span>Pay ₹{selectedPlan.price} with Razorpay</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleWalletPayment}
                    disabled={paymentProcessing || !isWalletSufficient}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {paymentProcessing ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Deducting Wallet...</span>
                      </>
                    ) : (
                      <>
                        <Wallet size={14} />
                        <span>Pay ₹{selectedPlan.price} from Wallet</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}

function CreditCardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}
