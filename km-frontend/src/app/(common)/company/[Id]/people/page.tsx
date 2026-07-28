'use client';
import React, { useEffect, useState } from 'react';
import { MapPin, MessageCircle, X } from 'lucide-react';
import { useCompany } from "../CompanyContext";
import api from '@/lib/axios';
import Link from 'next/link';

interface Person {
    id: string;
    name: string;
    designation: string;
    location?: string;
    avatar?: string;
    mutual_connects?: number;
}

const PeopleSection: React.FC = () => {
    const { company } = useCompany();
    const [people, setPeople] = useState<Person[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPeople = async () => {
            if (!company?.id) return;
            setLoading(true);
            try {
                // Fetch people working in company. Assuming /users endpoint with filter
                const res: any = await api.get('/users', {
                    params: {
                        company_id: company.id,
                        limit: 8
                    }
                });

                const peopleList = res.users || res.data || [];
                setPeople(peopleList);
            } catch (error) {
                console.error("Failed to fetch people", error);
                // Could not fetch people, show empty or mock for presentation if needed
            } finally {
                setLoading(false);
            }
        };

        fetchPeople();
    }, [company?.id]);


    return (
        <div className="flex w-full gap-6">
            {/* Consistent Sidebar */}
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

            {/* Main Content Area */}
            <section className="flex-1 space-y-12">
                {/* Top Grid: People associated with the company */}
                <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-6">People at {company?.name}</h3>
                    {loading ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[1, 2, 3, 4].map(n => <div key={n} className="h-48 bg-gray-100 rounded-3xl animate-pulse" />)}
                        </div>
                    ) : people.length === 0 ? (
                        <div className="bg-white border border-gray-200 rounded-3xl p-8 text-center">
                            <h3 className="text-lg font-bold text-gray-900">No people found</h3>
                            <p className="text-gray-500">We couldn't find anyone working here yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {people.map((person) => (
                                <PersonCard key={person.id} person={person} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Popular People Section (Placeholder or Global Fetch) */}
                {/* Keeping static for now as requested "people should show peoples working in that company" is the main task */}
            </section>
        </div>
    );
};

export default PeopleSection;


const PersonCard = ({ person }: { person: Person }) => (
    <div className="bg-white border border-gray-100 rounded-3xl p-5 flex flex-col items-center relative shadow-sm hover:shadow-md transition">
        {/* <button className="absolute top-3 right-3 text-gray-300 hover:text-gray-500">
            <X size={16} />
        </button> */}

        <div className="relative mb-3">
            <div className="w-20 h-20 bg-[#3B124D] rounded-full flex items-center justify-center overflow-hidden">
                {person.avatar ? (
                    <img src={person.avatar} alt={person.name} className="w-full h-full object-cover" />
                ) : (
                    <span className="text-white text-2xl uppercase">{person.name.charAt(0)}</span>
                )}
            </div>
            {/* <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div> */}
        </div>

        <h3 className="font-bold text-gray-900 text-sm text-center truncate w-full">{person.name}</h3>
        <p className="text-[10px] text-gray-400 uppercase mb-2 text-center w-full truncate">{person.designation || 'Member'}</p>

        <div className="flex items-center text-gray-500 text-[10px] mb-1">
            <MapPin size={10} className="mr-1" />
            <span>{person.location || 'Location N/A'}</span>
        </div>
        <p className="text-[10px] text-gray-400 mb-4 cursor-default">{person.mutual_connects || 0} Mutual Connects</p>

        <div className="w-full space-y-2">
            {(() => {
                const storedUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
                let currentUserId = '';
                if (storedUser) {
                    try {
                        const parsed = JSON.parse(storedUser);
                        currentUserId = parsed.id || parsed._id;
                    } catch (e) {}
                }
                const isSelf = (person.id === currentUserId);
                
                return !isSelf && (
                    <>
                        <Link href={`/chat?userId=${person.id}`}>
                            <button className="w-full py-1.5 border border-purple-600 text-purple-600 rounded-full text-xs font-semibold flex items-center justify-center space-x-1 hover:bg-purple-50 transition-colors">
                                <MessageCircle size={12} />
                                <span>Chat</span>
                            </button>
                        </Link>
                        <button className="w-full py-1.5 bg-[#A872B3] text-white rounded-full text-xs font-semibold hover:bg-purple-500 transition-colors">
                            Follow
                        </button>
                    </>
                );
            })()}
        </div>
    </div>
);