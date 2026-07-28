// pages/resources/[id].tsx
import React from 'react';
import {
    Play, Bookmark, ChevronDown, MessageCircle,
    ThumbsUp, Flag, Star, StarHalf, MoreVertical
} from 'lucide-react';

const ResourceDetailsPage = () => {
    return (
        <div className="max-w-7xl mx-auto p-6 flex flex-col lg:flex-row gap-8 bg-[#F4F2F7] min-h-screen">

            {/* Left Sidebar: Curriculum/Content */}
            <div className="hidden lg:block w-72 space-y-4">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900 mb-6">Content</h2>
                    <div className="space-y-2">
                        <AccordionItem title="Introduction" active subtitle="Lorem Ipsum Dolor Sit Amet Sed Id Diam Consectetur." />
                        <AccordionItem title="1. Understanding Learning" />
                        <AccordionItem title="2. Your Learning Self-Inventory" />
                        <AccordionItem title="3. Your Learning Self-Inventory" />
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 space-y-8">
                {/* Video Player Section */}
                <div className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-gray-100">
                    <div className="aspect-video bg-gradient-to-br from-gray-200 to-gray-400 relative group cursor-pointer">
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-20 h-20 bg-white/90 rounded-full flex items-center justify-center shadow-2xl transform group-hover:scale-110 transition-transform">
                                <Play className="text-gray-400 fill-gray-400 ml-1" size={32} />
                            </div>
                        </div>
                        <button className="absolute top-6 right-6 p-3 bg-white/20 backdrop-blur-md rounded-xl text-white hover:bg-white/40">
                            <Bookmark size={20} />
                        </button>
                    </div>

                    {/* Video Tabs & Info */}
                    <div className="p-8">
                        <div className="flex border-b border-gray-100 mb-8">
                            <button className="px-8 py-3 text-purple-600 font-bold border-b-2 border-purple-600">Overview</button>
                            <button className="px-8 py-3 text-gray-400 font-bold hover:text-gray-600 transition-colors">Q&A</button>
                        </div>

                        {/* Instructor Section */}
                        <div className="space-y-6">
                            <h3 className="text-2xl font-bold text-gray-900">Instructor</h3>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-[#1D0A1C] relative">
                                        <div className="absolute bottom-1 right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold">Expert Name</h4>
                                        <p className="text-sm text-gray-500 italic">Expert Designation</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button className="flex items-center gap-2 px-6 py-2 border border-purple-200 rounded-full text-purple-600 font-bold hover:bg-purple-50">
                                        <MessageCircle size={18} /> Chat
                                    </button>
                                    <button className="px-8 py-2 bg-[#A67DB0] text-white rounded-full font-bold hover:bg-[#9669A0]">
                                        Follow
                                    </button>
                                </div>
                            </div>

                            {/* Description */}
                            <div className="space-y-4">
                                <h3 className="text-2xl font-bold text-gray-900">Video Description</h3>
                                <p className="text-gray-600 leading-relaxed">
                                    Lorem ipsum dolor sit amet consectetur. Enim dictumst commodo diam arcu massa dui amet neque. Gravida sed euismod arcu nulla massa. Sed egestas mattis aliquam lacus interdum sit...
                                </p>
                            </div>

                            {/* Skills & Learners */}
                            <div className="flex flex-col md:flex-row gap-12 pt-4">
                                <div className="space-y-3">
                                    <h4 className="font-bold text-gray-900">Skill Covered</h4>
                                    <span className="inline-block px-4 py-1.5 border border-gray-200 rounded-full text-xs text-gray-500">Longlife Learning</span>
                                </div>
                                <div className="space-y-3">
                                    <h4 className="font-bold text-gray-900">Learners</h4>
                                    <div className="flex items-center gap-3">
                                        <div className="flex -space-x-2">
                                            {[1, 2, 3].map(i => <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-gray-300" />)}
                                        </div>
                                        <span className="text-xs text-gray-400">90 people interested in this</span>
                                    </div>
                                </div>
                            </div>

                            {/* Reviews Section */}
                            <div className="pt-12 space-y-8">
                                <h3 className="text-2xl font-bold text-gray-900">Learner Reviews</h3>
                                <div className="flex flex-col md:flex-row gap-12 items-center bg-gray-50/50 p-8 rounded-3xl">
                                    <div className="text-center">
                                        <div className="text-6xl font-black text-purple-700">4.2</div>
                                        <div className="text-gray-500 font-bold mt-2">Out Of 5</div>
                                        <div className="flex gap-1 justify-center mt-3 text-yellow-400">
                                            <Star size={20} fill="currentColor" />
                                            <Star size={20} fill="currentColor" />
                                            <Star size={20} fill="currentColor" />
                                            <Star size={20} fill="currentColor" />
                                            <StarHalf size={20} fill="currentColor" />
                                        </div>
                                    </div>
                                    <div className="flex-1 w-full space-y-2">
                                        <RatingBar label="5 Star" percent={75} />
                                        <RatingBar label="4 Star" percent={20} />
                                        <RatingBar label="3 Star" percent={4} />
                                        <RatingBar label="2 Star" percent={1} />
                                        <RatingBar label="1 Star" percent={1} />
                                    </div>
                                </div>

                                {/* Individual Review Card */}
                                <div className="bg-white border border-gray-100 rounded-[32px] p-8 space-y-6">
                                    <div className="flex justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-[#1D0A1C]" />
                                            <div>
                                                <h4 className="font-bold">Person Name</h4>
                                                <p className="text-xs text-gray-500 italic">Person Designation</p>
                                            </div>
                                        </div>
                                        <button className="text-gray-400 hover:text-gray-600"><MoreVertical size={20} /></button>
                                    </div>
                                    <div className="flex flex-col gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="flex gap-1 text-yellow-400">
                                                {[1, 2, 3, 4].map(i => <Star key={i} size={16} fill="currentColor" />)}
                                                <StarHalf size={16} fill="currentColor" />
                                            </div>
                                            <span className="text-xs text-gray-400">October 11, 2023</span>
                                        </div>
                                        <p className="text-gray-600 text-sm leading-relaxed">
                                            Lorem ipsum dolor sit amet consectetur. Enim dictumst commodo diam arcu massa dui amet neque. Gravida sed euismod arcu nulla massa.
                                        </p>
                                        <div className="flex gap-6 pt-2">
                                            <button className="flex items-center gap-2 text-xs text-gray-500 font-bold hover:text-purple-600">
                                                <ThumbsUp size={16} /> Like
                                            </button>
                                            <button className="flex items-center gap-2 text-xs text-gray-500 font-bold hover:text-red-500">
                                                <Flag size={16} /> Report
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Sidebar: Related Content */}
            <div className="w-full lg:w-80 space-y-6">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800 mb-6">Related Videos</h2>
                    <div className="space-y-6">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="flex gap-3 group cursor-pointer">
                                <div className="w-24 h-16 bg-gray-200 rounded-lg flex-shrink-0 relative overflow-hidden">
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Play size={16} className="text-white fill-white" />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-xs font-bold text-gray-800 leading-snug line-clamp-2">Lorem Ipsum Video Title Display Here</h4>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-[10px] text-gray-400">10K Viewers</span>
                                        <Bookmark size={12} className="text-purple-400" />
                                    </div>
                                </div>
                            </div>
                        ))}
                        <button className="w-full text-center text-purple-600 font-bold text-sm pt-2 hover:underline">Show All</button>
                    </div>
                </div>

                {/* Sidebar Ad */}
                <div className="bg-white rounded-3xl h-[400px] flex items-center justify-center border border-gray-100 text-gray-400 font-bold italic shadow-sm">
                    Ad Banner
                </div>
            </div>
        </div>
    );
};

export default ResourceDetailsPage;

const AccordionItem = ({ title, subtitle, active = false }: any) => (
    <div className={`p-4 rounded-xl border transition-all cursor-pointer ${active ? 'bg-purple-50 border-purple-100' : 'bg-white border-transparent hover:bg-gray-50'}`}>
        <div className="flex items-center justify-between">
            <span className={`text-sm font-bold ${active ? 'text-purple-700' : 'text-gray-800'}`}>{title}</span>
            <ChevronDown size={16} className={active ? 'text-purple-700' : 'text-gray-400'} />
        </div>
        {subtitle && <p className="text-[10px] text-purple-500/70 mt-2 font-medium leading-relaxed">{subtitle}</p>}
    </div>
);

const RatingBar = ({ label, percent }: { label: string, percent: number }) => (
    <div className="flex items-center gap-4 group">
        <span className="text-xs font-bold text-gray-500 w-12">{label}</span>
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
                className="h-full bg-yellow-400 rounded-full transition-all duration-1000"
                style={{ width: `${percent}%` }}
            />
        </div>
        <span className="text-xs font-bold text-gray-400 w-8">{percent}%</span>
    </div>
);