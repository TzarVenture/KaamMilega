// pages/events/[id].tsx
import React from 'react';
import {
    Calendar, Video, Users, Bookmark, Share2,
    MapPin, Clock, MessageCircle, MoreVertical, CheckCircle2
} from 'lucide-react';

const EventDetailsPage = () => {
    return (
        <div className="max-w-7xl mx-auto p-6 flex flex-col lg:flex-row gap-8 bg-[#F4F2F7] min-h-screen">

            {/* Main Content Area */}
            <div className="flex-1 space-y-6">

                {/* Event Header Card */}
                <div className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-gray-100">
                    {/* Cover Image Placeholder */}
                    <div className="h-64 bg-[#1D0A1C] flex items-center justify-center relative">
                        <div className="flex items-center justify-center opacity-40 scale-150">
                            <div className="w-16 h-16 bg-purple-400 clip-path-triangle transform -rotate-12 -translate-x-4" />
                            <div className="w-14 h-14 bg-purple-300 clip-path-triangle translate-x-4 translate-y-4" />
                        </div>
                        {/* Action Buttons on Cover */}
                        <div className="absolute bottom-6 right-6 flex gap-3">
                            <button className="p-3 bg-white/10 backdrop-blur-md rounded-xl text-white hover:bg-white/20 transition-all">
                                <Bookmark size={20} />
                            </button>
                            <button className="p-3 bg-white/10 backdrop-blur-md rounded-xl text-white hover:bg-white/20 transition-all">
                                <Share2 size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Event Brief Info */}
                    <div className="p-8 space-y-6">
                        <div className="space-y-2">
                            <h1 className="text-4xl font-black text-gray-900 leading-tight">
                                Lorem Ipsum Event Name Display Here
                            </h1>
                            <p className="text-gray-500 font-medium">
                                Event By <span className="text-purple-600 font-bold cursor-pointer hover:underline">Company Name</span>
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-y-4 gap-x-12 py-4 border-y border-gray-50">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-purple-50 rounded-xl text-purple-600">
                                    <Calendar size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Date & Time</p>
                                    <p className="text-sm font-bold text-gray-800">Thu, Oct 12, 2023, 8:30 PM</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-purple-50 rounded-xl text-purple-600">
                                    <Video size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Event Format</p>
                                    <p className="text-sm font-bold text-gray-800">Online Event</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-purple-50 rounded-xl text-purple-600">
                                    <Users size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Attendance</p>
                                    <p className="text-sm font-bold text-gray-800">18,000+ Attendees</p>
                                </div>
                            </div>
                        </div>

                        {/* Attendance Call to Action */}
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-[#FDFBFF] p-6 rounded-2xl border border-purple-50">
                            <div className="flex items-center gap-4">
                                <div className="flex -space-x-3">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-gray-200" />
                                    ))}
                                    <div className="w-10 h-10 rounded-full border-2 border-white bg-purple-600 flex items-center justify-center text-[10px] font-bold text-white">
                                        +18k
                                    </div>
                                </div>
                                <p className="text-sm font-bold text-gray-700">Are You Attending This Event?</p>
                            </div>
                            <div className="flex gap-3 w-full md:w-auto">
                                <button className="flex-1 md:flex-none px-10 py-3 bg-[#A67DB0] hover:bg-[#9669A0] text-white font-bold rounded-full transition-all shadow-lg shadow-purple-200">
                                    Attend
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* About Event Section */}
                <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">About Event</h2>
                    <div className="text-gray-600 leading-relaxed space-y-4 text-sm">
                        <p>
                            Lorem ipsum dolor sit amet consectetur. Enim dictumst commodo diam arcu massa dui amet neque. Gravida sed euismod arcu nulla massa. Sed egestas mattis aliquam lacus interdum sit...
                        </p>
                        <p>
                            In this event, you will learn how to master the art of lorem ipsum with practical examples and expert guidance. Join thousands of other professionals in this session.
                        </p>
                    </div>
                </div>

                {/* Speakers Section */}
                <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100">
                    <h2 className="text-2xl font-bold text-gray-900 mb-8">Speakers</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {[1, 2].map((i) => (
                            <div key={i} className="flex items-center gap-5 p-4 rounded-2xl border border-gray-50 hover:border-purple-100 transition-colors">
                                <div className="w-20 h-20 rounded-2xl bg-[#1D0A1C] flex-shrink-0" />
                                <div className="flex-1">
                                    <h4 className="text-lg font-bold text-gray-900">Speaker Name</h4>
                                    <p className="text-xs text-gray-500 italic mb-3">Speaker Designation</p>
                                    <div className="flex gap-2">
                                        <button className="flex-1 py-1.5 border border-purple-200 rounded-full text-[10px] font-bold text-purple-700 hover:bg-purple-50">
                                            Chat
                                        </button>
                                        <button className="flex-1 py-1.5 bg-[#A67DB0] rounded-full text-[10px] font-bold text-white">
                                            Follow
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Column: Sidebar */}
            <div className="w-full lg:w-80 space-y-6">
                {/* Attendees Preview */}
                <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="font-bold text-gray-900">Attendees</h2>
                        <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-md">View All</span>
                    </div>
                    <div className="space-y-5">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-[#1D0A1C]" />
                                    <div>
                                        <p className="text-xs font-bold text-gray-800">Person Name</p>
                                        <p className="text-[10px] text-gray-400 italic">Person Designation</p>
                                    </div>
                                </div>
                                <button className="text-gray-300 hover:text-purple-600">
                                    <MessageCircle size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Ad Banner */}
                <div className="bg-white rounded-[32px] h-[500px] flex items-center justify-center border border-gray-100 shadow-sm text-gray-400 font-bold text-xl italic p-12 text-center">
                    Ad Banner
                </div>
            </div>
        </div>
    );
};

export default EventDetailsPage;