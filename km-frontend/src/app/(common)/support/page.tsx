'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { BuildingOfficeIcon, CaretDownIcon, CaretUpIcon, CheckCircleIcon, EnvelopeSimpleIcon, PaperPlaneRightIcon, PhoneIcon, QuestionIcon, ShieldWarningIcon, WarningIcon } from '@phosphor-icons/react';

export default function SupportPage() {
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    emailOrPhone: '',
    role: 'jobseeker',
    category: 'account',
    message: '',
  });

  const faqs = [
    {
      q: 'Is KaamMilega™ really 100% free for jobseekers?',
      a: 'Yes, absolutely. KaamMilega™ does not charge candidates any registration fees, interview fees, or commission cuts from their salary. If any employer or agent asks you for money in the name of KaamMilega™, please report them immediately.',
    },
    {
      q: 'How does employer verification work on KaamMilega™?',
      a: 'All employers and recruiting agencies must provide legitimate government business credentials (GSTIN / CIN / Udyam registration) and company domain emails. Our compliance team verifies each organization before their job listings become visible to candidates.',
    },
    {
      q: 'What is InstantMilega™ and how do shift payments work?',
      a: 'InstantMilega™ connects employers with verified workers for short-term, urgent shifts (e.g. event crew, delivery riders, technicians). The employer deposits the shift payout into platform escrow before the shift starts. Once the shift is marked completed and verified via OTP/biometrics, payment is credited directly into the worker’s wallet.',
    },
    {
      q: 'How do I resolve a payment dispute or wallet issue?',
      a: 'Go to your Wallet section and click "Report Dispute" on the specific transaction, or file a ticket below selecting "Wallet / Payout Dispute". Our dedicated escrow team reviews disputes within 24 to 48 hours.',
    },
    {
      q: 'Can I apply for jobs in multiple cities?',
      a: 'Yes! You can explore and apply for verified vacancies across 100+ cities in India. Simply use the city filter or search bar on the Jobs page to select your preferred locations.',
    },
    {
      q: 'How can recruiters contact our dedicated enterprise helpline?',
      a: 'Recruiters can email employer@kaammilega.com or call our business line at +91 8000 123 456 (Monday to Saturday, 9:00 AM – 7:00 PM IST) for customized enterprise hiring and candidate shortlisting.',
    },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.emailOrPhone || !formData.message) return;
    setFormSubmitted(true);
  };

  return (
    <main className="min-h-screen bg-[#F4F7FB] font-sans antialiased text-slate-800">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-[#071A4D] via-[#0B1F52] to-[#0B5ED7] text-white py-16 sm:py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/20 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/20 mb-6 shadow-xs">
            <QuestionIcon weight="bold" size={16} className="text-emerald-400" />
            <span className="text-xs sm:text-sm font-semibold tracking-wide text-white">
              Customer Happiness &amp; Trust Helpdesk
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight mb-5">
            We&apos;re Here to <span className="text-[#FF6B00]">Help You</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-200 max-w-2xl mx-auto leading-relaxed">
            Have questions about your profile, applications, employer verification, or InstantMilega™ shifts? Reach our verified support team anytime.
          </p>
        </div>
      </section>

      {/* Quick Channels Cards */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto -mt-8 relative z-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Email Support */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-[#0B5ED7] flex items-center justify-center mb-4">
              <EnvelopeSimpleIcon size={22} />
            </div>
            <h3 className="text-base font-bold text-[#071A4D] mb-1">General Inquiries</h3>
            <p className="text-xs text-slate-500 mb-3">Questions &amp; assistance for jobseekers</p>
            <a
              href="mailto:support@kaammilega.com"
              className="text-xs sm:text-sm font-bold text-[#0B5ED7] hover:underline"
            >
              support@kaammilega.com
            </a>
          </div>

          {/* Employer Desk */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 text-[#FF6B00] flex items-center justify-center mb-4">
              <BuildingOfficeIcon size={22} />
            </div>
            <h3 className="text-base font-bold text-[#071A4D] mb-1">Employer Desk</h3>
            <p className="text-xs text-slate-500 mb-3">Enterprise hiring, GST verification &amp; ads</p>
            <a
              href="mailto:employer@kaammilega.com"
              className="text-xs sm:text-sm font-bold text-[#FF6B00] hover:underline"
            >
              employer@kaammilega.com
            </a>
          </div>

          {/* Phone / WhatsApp */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mb-4">
              <PhoneIcon size={22} />
            </div>
            <h3 className="text-base font-bold text-[#071A4D] mb-1">Phone Helpline</h3>
            <p className="text-xs text-slate-500 mb-3">Mon – Sat (9:00 AM – 7:00 PM IST)</p>
            <a
              href="tel:+918000123456"
              className="text-xs sm:text-sm font-bold text-emerald-600 hover:underline"
            >
              +91 8000 123 456
            </a>
          </div>

          {/* Safety & Disputes */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center mb-4">
              <ShieldWarningIcon size={22} />
            </div>
            <h3 className="text-base font-bold text-[#071A4D] mb-1">Trust &amp; Safety</h3>
            <p className="text-xs text-slate-500 mb-3">Report fraud, scams, or escrow issues</p>
            <a
              href="mailto:safety@kaammilega.com"
              className="text-xs sm:text-sm font-bold text-purple-600 hover:underline"
            >
              safety@kaammilega.com
            </a>
          </div>
        </div>
      </section>

      {/* Main Support Grid: Ticket Form + FAQ */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Form: Submit Support Ticket */}
          <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm">
            <div className="mb-6">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#0B5ED7] bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                Direct Helpdesk
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-[#071A4D] mt-2">
                Send Us a Message
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Our support team typically responds within 2 business hours.
              </p>
            </div>

            {formSubmitted ? (
              <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-200 text-center">
                <CheckCircleIcon size={40} className="text-emerald-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-emerald-900 mb-1">
                  Message Sent Successfully!
                </h3>
                <p className="text-xs sm:text-sm text-emerald-700 leading-relaxed">
                  Thank you for contacting KaamMilega™ Support. Ticket ID: <strong>#KM-{Math.floor(100000 + Math.random() * 900000)}</strong>. A support specialist will respond to {formData.emailOrPhone} shortly.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setFormSubmitted(false);
                    setFormData({ name: '', emailOrPhone: '', role: 'jobseeker', category: 'account', message: '' });
                  }}
                  className="mt-5 px-5 py-2 bg-emerald-600 text-white rounded-full text-xs font-bold hover:bg-emerald-700 transition-colors"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Your Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter your name"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/25 focus:border-[#0B5ED7]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email or Mobile Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.emailOrPhone}
                    onChange={(e) => setFormData({ ...formData, emailOrPhone: e.target.value })}
                    placeholder="e.g. you@email.com or +91 9876543210"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/25 focus:border-[#0B5ED7]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      I am a:
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/25 focus:border-[#0B5ED7]"
                    >
                      <option value="jobseeker">Jobseeker</option>
                      <option value="employer">Employer / HR</option>
                      <option value="expert">Mentor / Expert</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Issue Topic:
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/25 focus:border-[#0B5ED7]"
                    >
                      <option value="account">Account &amp; Login</option>
                      <option value="jobs">Job Applications</option>
                      <option value="wallet">Wallet &amp; Escrow</option>
                      <option value="verification">Verification Badge</option>
                      <option value="report">Report Fraud / Spam</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    How Can We Help? *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Please describe your question or issue in detail..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/25 focus:border-[#0B5ED7] resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#071A4D] hover:bg-[#0B1F52] text-white font-bold rounded-full text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <PaperPlaneRightIcon weight="bold" size={15} />
                  <span>Submit Ticket</span>
                </button>
              </form>
            )}
          </div>

          {/* Right Column: FAQ Accordion */}
          <div className="lg:col-span-7 space-y-4">
            <div className="mb-6">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#FF6B00] bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200">
                Self-Service Knowledgebase
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-[#071A4D] mt-2">
                Frequently Asked Questions
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Quick answers to the most common questions on the KaamMilega™ platform.
              </p>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, index) => {
                const isOpen = activeFaq === index;
                return (
                  <div
                    key={index}
                    className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => setActiveFaq(isOpen ? null : index)}
                      className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-bold text-slate-900 text-sm sm:text-base hover:text-[#0B5ED7] transition-colors cursor-pointer"
                    >
                      <span>{faq.q}</span>
                      <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-slate-600">
                        {isOpen ? <CaretUpIcon weight="bold" size={16} /> : <CaretDownIcon weight="bold" size={16} />}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Zero Brokerage Security Alert Banner */}
            <div className="mt-8 p-5 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-amber-900">
              <WarningIcon size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm leading-relaxed">
                <span className="font-bold">KaamMilega™ Security Notice: </span>
                Never transfer money or share banking OTPs with anyone claiming to offer job guarantees or gatekeeper passes. KaamMilega™ hiring is 100% direct and completely free for jobseekers.
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
