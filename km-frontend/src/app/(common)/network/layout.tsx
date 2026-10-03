import React from 'react';
import NetworkSidebar from '@/components/network/NetworkSidebar';

export const metadata = {
  title: 'Professional Network | KaamMilega',
  description: 'Manage your connections, discover industry peers, explore verified mentors, and join networking events.',
};

export default function NetworkLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F4F7FB] py-6 md:py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Persistent Left Sidebar */}
        <aside className="lg:col-span-3 space-y-6 lg:sticky lg:top-24">
          <NetworkSidebar />
        </aside>

        {/* Dynamic Main Page Content */}
        <main className="lg:col-span-9 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
