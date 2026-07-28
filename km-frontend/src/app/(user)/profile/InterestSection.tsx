import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import Link from 'next/link';

const InterestsSection = () => {
    const [activeTab, setActiveTab] = useState('Top Experts');
    const tabs = ['Top Experts', 'Companies', 'Groups', 'School'];

    return (
        <section className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm mt-6">
            <h2 className="text-xl font-bold mb-6">Interest</h2>

            {/* Tab Navigation */}
            <div className="overflow-x-auto -mx-1 mb-8">
                <div className="flex border-b border-gray-100 min-w-max">
                    {tabs.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-3 px-4 text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab
                                ? 'text-purple-600 border-b-2 border-purple-600'
                                : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Experts Grid */}
            {activeTab === 'Top Experts' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex flex-col items-center text-center group">
                            <div className="relative mb-3">
                                <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center overflow-hidden">
                                    <div className="w-8 h-8 bg-gray-500 rotate-45" />
                                </div>
                                <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                            </div>
                            <h4 className="font-bold text-sm text-gray-900">Expert Name</h4>
                            <p className="text-[10px] text-gray-500 mb-1">GATE CSE Specialist</p>
                            <p className="text-[10px] text-gray-400 mb-4">10 Mutual Connects</p>
                            <Link href="/chat" className="w-full">
                                <button className="flex items-center justify-center gap-1 w-full py-1.5 border border-purple-600 text-purple-600 rounded-full text-xs font-bold hover:bg-purple-50">
                                    <MessageCircle size={14} /> Chat
                                </button>
                            </Link>
                        </div>
                    ))}
                </div>
            )}

            <button className="w-full mt-10 pt-4 border-t border-gray-100 text-purple-600 font-bold text-sm hover:underline">
                Show All Top Experts
            </button>
        </section>
    );
};

export default InterestsSection;
