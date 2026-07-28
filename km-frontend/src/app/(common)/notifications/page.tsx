"use client";
import { useState } from "react";
import NotificationSettingsModal from "./NotificationSettingsModal";

// --- Types ---
type NotificationType = 'job' | 'connection' | 'post' | 'mention';

interface NotificationItem {
    id: string;
    type: NotificationType;
    user?: string;
    content: string;
    time: string;
    avatar?: string;
    actionLabel?: string;
}

// --- Mock Data ---
const NOTIFICATIONS: NotificationItem[] = [
    { id: '1', type: 'post', user: 'Khushi Gupta', content: 'your new connection, shared a post you may be interested in', time: '30m' },
    { id: '2', type: 'job', content: 'Graphic designer: 18 opportunities in Noida', time: '45m', actionLabel: 'View Jobs' },
    { id: '3', type: 'connection', user: 'Jay Singh', content: 'on starting a new position as Content Design and Strategy at MH London.', time: '55m', actionLabel: 'Say Congrats' },
    { id: '4', type: 'job', content: 'Graphic designer: 18 opportunities in Delhi', time: '1h', actionLabel: 'View Jobs' },
    { id: '5', type: 'post', user: 'Rahul rajput', content: 'your new connection, shared a post you may be interested in', time: '1h' },
];

const NotificationsPage = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <div className="min-h-screen bg-gray-50/50 p-4 md:p-8">
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* LEFT SIDEBAR */}
                <aside className="lg:col-span-3">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-1">Manage Your Notifications</h2>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="text-purple-600 text-sm font-semibold hover:underline flex items-center gap-1">
                            View Settings
                        </button>
                    </div>
                </aside>

                {/* CENTER FEED */}
                <main className="lg:col-span-6 space-y-4">
                    {/* Filters */}
                    <div className="flex gap-2 mb-6">
                        <FilterChip label="All" active />
                        <FilterChip label="My Posts" />
                        <FilterChip label="Mentions" />
                    </div>

                    {/* List */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">
                        {NOTIFICATIONS.map((item) => (
                            <NotificationRow key={item.id} item={item} />
                        ))}
                    </div>
                </main>

                {/* RIGHT SIDEBAR (Ad) */}
                <aside className="lg:col-span-3">
                    <div className="bg-white rounded-2xl h-64 flex items-center justify-center border border-dashed border-gray-200 text-gray-400 font-bold text-xl shadow-sm">
                        Ad Banner
                    </div>
                </aside>
            </div>
            {/* Modal Integration */}
            <NotificationSettingsModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </div>
    );
};

// --- Sub-Components ---

const FilterChip = ({ label, active }: { label: string; active?: boolean }) => (
    <button className={`px-5 py-1.5 rounded-full text-xs font-medium transition-all border ${active
        ? 'bg-purple-100 text-purple-600 border-purple-200'
        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
        }`}>
        {label}
    </button>
);

const NotificationRow = ({ item }: { item: NotificationItem }) => (
    <div className="p-5 flex gap-4 hover:bg-gray-50/50 transition-colors group cursor-pointer">
        {/* Avatar / Icon Container */}
        <div className="relative flex-shrink-0">
            {item.type === 'job' ? (
                <div className="flex -space-x-3">
                    <div className="w-10 h-10 bg-purple-900 rounded-full border-2 border-white flex items-center justify-center text-white" />
                    <div className="w-10 h-10 bg-purple-800 rounded-full border-2 border-white flex items-center justify-center text-white" />
                </div>
            ) : (
                <div className="w-12 h-12 bg-purple-900 rounded-full flex-shrink-0" />
            )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start gap-2">
                <p className="text-sm text-gray-700 leading-relaxed">
                    {item.user && <span className="font-bold text-gray-900">{item.user}, </span>}
                    {item.content}
                </p>
                <span className="text-[11px] text-gray-400 whitespace-nowrap mt-1">{item.time}</span>
            </div>

            {item.actionLabel && (
                <button className="mt-3 px-6 py-1.5 border border-purple-500 text-purple-600 rounded-full text-xs font-bold hover:bg-purple-50 transition-all">
                    {item.actionLabel}
                </button>
            )}
        </div>
    </div>
);

export default NotificationsPage;