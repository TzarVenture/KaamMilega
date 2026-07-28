import React from 'react';
import { MapPin, MessageCircle, X } from 'lucide-react';

const PeopleSection: React.FC = () => {
    return (
        <div className="flex w-full gap-6 bg-gray-50 p-6">
            {/* Consistent Sidebar */}
            <aside className="w-1/4">
                <div className="sticky top-6 bg-[#FDF4FF] rounded-2xl border border-purple-100 p-8 flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-[#3B124D] rounded-full flex items-center justify-center mb-4">
                        <span className="text-white text-2xl">▲</span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">Company Name</h2>
                    <p className="text-sm text-gray-600 mt-1">10,238,546 Followers</p>
                </div>
            </aside>

            {/* Main Content Area */}
            <section className="w-3/4 space-y-12">
                {/* Top Grid: People associated with the company */}
                <div className="grid grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => (
                        <PersonCard key={i} />
                    ))}
                </div>

                {/* Popular People Section */}
                <div>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-gray-900">Popular People To Follow Across Kaam Milega</h2>
                        <button className="text-purple-600 font-semibold text-sm hover:underline">See All</button>
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                        {[...Array(6)].map((_, i) => (
                            <PopularPersonRow key={i} />
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default PeopleSection;


const PersonCard = () => (
    <div className="bg-white border border-gray-100 rounded-3xl p-5 flex flex-col items-center relative shadow-sm hover:shadow-md transition">
        <button className="absolute top-3 right-3 text-gray-300 hover:text-gray-500">
            <X size={16} />
        </button>

        <div className="relative mb-3">
            <div className="w-20 h-20 bg-[#3B124D] rounded-full flex items-center justify-center text-white">▲</div>
            <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
        </div>

        <h3 className="font-bold text-gray-900 text-sm">Person Name</h3>
        <p className="text-[10px] text-gray-400 uppercase mb-2">Person Designation</p>

        <div className="flex items-center text-gray-500 text-[10px] mb-1">
            <MapPin size={10} className="mr-1" />
            <span>Location</span>
        </div>
        <p className="text-[10px] text-gray-400 mb-4 cursor-default">10 Mutual Connects</p>

        <div className="w-full space-y-2">
            <button className="w-full py-1.5 border border-purple-600 text-purple-600 rounded-full text-xs font-semibold flex items-center justify-center space-x-1 hover:bg-purple-50">
                <MessageCircle size={12} />
                <span>Chat</span>
            </button>
            <button className="w-full py-1.5 bg-[#A872B3] text-white rounded-full text-xs font-semibold hover:bg-purple-500">
                Follow
            </button>
        </div>
    </div>
);

const PopularPersonRow = () => (
    <div className="flex items-start space-x-3 relative group">
        <button className="absolute -top-1 -right-1 text-gray-300 opacity-0 group-hover:opacity-100 transition">
            <X size={14} />
        </button>

        <div className="relative flex-shrink-0">
            <div className="w-14 h-14 bg-[#3B124D] rounded-full flex items-center justify-center text-white text-xs">▲</div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
        </div>

        <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-sm truncate">Person Name</h3>
            <p className="text-[10px] text-gray-400">Person Designation</p>
            <div className="flex items-center text-gray-500 text-[10px] mt-1">
                <MapPin size={10} className="mr-1" />
                <span>Location</span>
            </div>
            <p className="text-[9px] text-gray-400 mt-1">10 Mutual Connects</p>

            <div className="flex space-x-2 mt-3">
                <button className="flex-1 py-1 border border-purple-600 text-purple-600 rounded-full text-[10px] font-bold flex items-center justify-center space-x-1">
                    <MessageCircle size={10} />
                    <span>Chat</span>
                </button>
                <button className="flex-1 py-1 bg-[#A872B3] text-white rounded-full text-[10px] font-bold">
                    Follow
                </button>
            </div>
        </div>
    </div>
);