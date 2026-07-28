'use client'
import React from 'react';
import { Play, Bookmark, ChevronDown, Calendar, User, Eye } from 'lucide-react';

const ResourcePage = () => {
    const videos = Array(5).fill({
        title: "Developing A Learning Mindset",
        duration: "30 Min",
        expert: "By Expert Name",
        releaseDate: "Feb 27, 2018",
        viewers: "10K Viewers",
        isRecommended: true
    });

    return (
        <div className="max-w-7xl mx-auto p-6 flex flex-col lg:flex-row gap-8 bg-[#F4F2F7] min-h-screen">

            {/* Left: Video Feed */}
            <div className="flex-1 space-y-4">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2 px-2">
                    <h1 className="text-3xl font-bold text-gray-900">
                        Learn With <span className="text-purple-600">Kaam Milega</span>
                    </h1>

                    <div className="flex items-center gap-2 text-sm text-gray-600 font-medium bg-white px-4 py-2 rounded-full shadow-sm">
                        <span>Sort by:</span>
                        <button className="flex items-center gap-1 font-bold text-gray-800 hover:text-purple-700">
                            Recently added <ChevronDown size={16} />
                        </button>
                    </div>
                </div>

                {/* Video List */}
                <div className="space-y-4">
                    {videos.map((video, idx) => (
                        <div key={idx} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-6 hover:shadow-md transition-shadow">

                            {/* Video Thumbnail Placeholder */}
                            <div className="relative w-full md:w-64 h-36 bg-gray-200 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                                {video.isRecommended && (
                                    <span className="absolute top-0 left-0 bg-purple-500 text-white text-[10px] font-bold px-3 py-1 rounded-br-lg z-10">
                                        Recommended
                                    </span>
                                )}
                                <div className="w-12 h-12 bg-white/80 rounded-full flex items-center justify-center shadow-lg">
                                    <Play className="text-gray-400 fill-gray-400 ml-1" size={20} />
                                </div>
                            </div>

                            {/* Content Info */}
                            <div className="flex-1 flex flex-col justify-between py-1">
                                <div className="flex justify-between items-start">
                                    <h2 className="text-xl font-bold text-gray-800 leading-tight">
                                        {video.title}
                                    </h2>
                                    <button className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-600 hover:text-white transition-colors">
                                        <Bookmark size={18} fill="currentColor" className="opacity-70" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-y-3 mt-4">
                                    <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                                        <span className="text-gray-400">Video Duration:</span>
                                        <span className="text-gray-700 font-bold">{video.duration}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <User size={14} className="text-purple-400" />
                                        <span>{video.expert}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <Eye size={14} className="text-purple-400" />
                                        <span className="font-bold">{video.viewers}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <Calendar size={14} className="text-purple-400" />
                                        <span>Released {video.releaseDate}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Load More Button */}
                <div className="flex justify-center pt-8 pb-12">
                    <button className="px-10 py-2.5 border-2 border-purple-300 rounded-full text-purple-700 font-bold hover:bg-purple-50 transition-colors">
                        Show More
                    </button>
                </div>
            </div>

            {/* Right: Sidebar */}
            <div className="hidden lg:block w-80">
                <div className="sticky top-6 bg-white rounded-3xl p-6 h-[400px] border border-gray-100 shadow-sm flex items-center justify-center text-gray-400 font-bold text-lg">
                    Ad Banner
                </div>
            </div>
        </div>
    );
};

export default ResourcePage;