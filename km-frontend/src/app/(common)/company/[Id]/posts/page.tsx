'use client';
import React from 'react';
import { Settings } from 'lucide-react';
import { useCompany } from "../CompanyContext";

const FeedSection: React.FC = () => {
    const { company } = useCompany();

    return (
        <div className="flex w-full gap-6">
            {/* Sidebar (Company Info) */}
            <aside className="w-full lg:w-1/4 hidden lg:block">
                <div className="sticky top-6 bg-[#FDF4FF] rounded-2xl border border-purple-100 p-8 flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-[#3B124D] rounded-full flex items-center justify-center mb-4 overflow-hidden">
                        {company?.logo ? (
                            <img src={company.logo} alt={company?.name} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-white text-2xl uppercase">{company?.name?.charAt(0) || 'C'}</span>
                        )}
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">{company?.name || "Company Name"}</h2>
                    <p className="text-sm text-gray-600 mt-1">{company?.connections?.toLocaleString() || 0} Followers</p>
                </div>
            </aside>

            {/* Main Post Feed */}
            <section className="flex-1">
                <div className="bg-white border border-gray-200 rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
                    <div className="w-24 h-24 bg-purple-50 rounded-full flex items-center justify-center mb-6">
                        <Settings className="w-12 h-12 text-purple-600 animate-spin-slow" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Posts Under Maintenance</h3>
                    <p className="text-gray-500 max-w-md">
                        We're currently updating our posts feed to bring you a better experience. Check back soon!
                    </p>
                </div>
            </section>
        </div>
    );
};

export default FeedSection;
