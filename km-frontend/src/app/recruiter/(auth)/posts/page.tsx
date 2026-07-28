import React from 'react';

const FeedSection: React.FC = () => {
    return (
        <div className="flex w-full gap-6 bg-gray-50 p-6">
            {/* Left Sidebar - Relative 25% width */}
            <aside className="w-1/4">
                <div className="sticky top-6 bg-[#FDF4FF] rounded-2xl border border-purple-100 p-8 flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-[#3B124D] rounded-full flex items-center justify-center mb-4">
                        <span className="text-white text-2xl">▲</span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">Company Name</h2>
                    <p className="text-sm text-gray-600 mt-1">10,238,546 Followers</p>
                </div>
            </aside>

            {/* Main Post Feed - Relative 75% width */}
            <section className="w-3/4 space-y-6">
                {[1, 2, 3].map((id) => (
                    <PostCard key={id} />
                ))}
            </section>
        </div>
    );
};

export default FeedSection;

import { MoreVertical, ThumbsUp, MessageSquare, Repeat2 } from 'lucide-react';

const PostCard = () => {
    return (
        <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
            {/* Header */}
            <div className="p-4 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-[#3B124D] rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">▲</span>
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 leading-tight">Name Surname</h3>
                        <p className="text-xs text-gray-500 uppercase">Designation / Promote Tag</p>
                    </div>
                </div>
                <button className="text-gray-400 hover:bg-gray-100 p-2 rounded-full transition">
                    <MoreVertical size={20} />
                </button>
            </div>

            {/* Media Content */}
            <div className="aspect-[16/9] bg-[#F9F9F9] flex items-center justify-center border-y border-gray-100">
                <span className="text-gray-300 text-7xl opacity-50">▲</span>
            </div>

            {/* Engagement Stats */}
            <div className="px-6 py-3 flex justify-between items-center text-[13px] text-gray-500 border-b border-gray-50">
                <span>Anuj Pandey and 326 others</span>
                <div className="flex space-x-3">
                    <span>44 comments</span>
                    <span>•</span>
                    <span>14 reposts</span>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex px-4 py-2">
                <ActionButton icon={<ThumbsUp size={20} />} label="Like" />
                <ActionButton icon={<MessageSquare size={20} />} label="Comment" />
                <ActionButton icon={<Repeat2 size={20} />} label="Reshare" />
            </div>
        </div>
    );
};

const ActionButton = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
    <button className="flex-1 flex items-center justify-center space-x-2 py-3 text-gray-600 hover:bg-gray-50 rounded-xl transition font-medium">
        {icon}
        <span>{label}</span>
    </button>
);
