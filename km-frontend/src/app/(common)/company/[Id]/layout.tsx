'use client'
import { Briefcase, MapPin, MessageCircle, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { CompanyProvider, useCompany } from "./CompanyContext";

const tabs = [
    { id: 1, label: 'About', links: "/company/[Id]" },
    { id: 2, label: 'Posts', links: "/company/[Id]/posts" },
    { id: 3, label: 'Jobs', links: "/company/[Id]/jobs" },
    { id: 4, label: 'People', links: "/company/[Id]/people" },
];

function CompanyLayoutContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { Id } = useParams();
    const { company, loading, error } = useCompany();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    if (error || !company) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8f9fa] gap-4">
                <h2 className="text-xl font-bold text-gray-900">Company not found</h2>
                <p className="text-gray-500">{error || "The company you are looking for does not exist."}</p>
                <Link href="/" className="px-6 py-2 bg-purple-600 text-white rounded-full font-medium hover:bg-purple-700 transition">
                    Go Home
                </Link>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-[#f8f9fa] py-8 px-4 md:px-12 lg:px-24">
            <div className="max-w-7xl mx-auto grid grid-cols-12 gap-6">

                {/* LEFT COLUMN: Main Content */}
                <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">

                    {/* Company Hero Card */}
                    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="h-44 bg-[#a87fb4] relative">
                            {/* Banner Placeholder Icon or Image */}
                            {company.cover_image ? (
                                <img src={company.cover_image} alt="Cover" className="w-full h-full object-cover" />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                    <Briefcase size={64} className="text-white" />
                                </div>
                            )}

                            {/* Profile Logo */}
                            <div className="absolute -bottom-14 left-8 p-1.5 bg-white rounded-full shadow-md">
                                <div className="w-28 h-28 bg-[#3d1d42] rounded-full flex items-center justify-center overflow-hidden">
                                    {company.logo ? (
                                        <img src={company.logo} alt={company.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <Briefcase size={48} className="text-white" />
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="pt-16 px-8 pb-8">
                            <div className="flex flex-col gap-1">
                                <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
                                <p className="text-xs font-bold text-gray-400 tracking-widest uppercase">
                                    {company.industry || "Industry N/A"}
                                </p>
                                <p className="text-sm text-gray-600 mt-1 font-medium">
                                    {company.connections || 0} Connections
                                </p>
                            </div>

                            <div className="mt-6 flex gap-4">
                                <button className="bg-[#a87fb4] text-white px-8 py-2 rounded-full text-sm font-semibold hover:bg-[#946ba0] transition-all">
                                    Follow
                                </button>
                                <a href={company.website ? (company.website.startsWith('http') ? company.website : `https://${company.website}`) : '#'} target="_blank" rel="noopener noreferrer" className="border-2 border-[#a87fb4] text-[#a87fb4] px-8 py-2 rounded-full text-sm font-semibold hover:bg-purple-50 transition-all text-center">
                                    Visit Website
                                </a>
                            </div>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="flex border-t border-gray-100 px-8 gap-10 overflow-x-auto">
                            {tabs.map((tab) => {
                                const dynamicPath = tab.links.replace("[Id]", Id as string);
                                const isActive = pathname === dynamicPath;
                                return (
                                    <Link
                                        href={dynamicPath}
                                        key={tab.id}
                                        className={`py-4 text-sm font-bold transition-colors whitespace-nowrap ${isActive ? 'text-[#a87fb4] border-b-2 border-[#a87fb4]' : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        {tab.label}
                                    </Link>
                                )
                            })}
                        </div>
                    </section>

                    {children}
                </div>

                {/* RIGHT COLUMN: Sidebar */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">

                    {/* Ad Banner Top */}
                    <div className="bg-white border border-gray-100 rounded-2xl h-48 flex items-center justify-center text-gray-400 font-bold shadow-sm">
                        Ad Banner
                    </div>

                    {/* People Also Follow */}
                    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">People Also Follow</h3>

                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-3 py-4 border-b border-gray-50 last:border-0">
                                <div className="w-12 h-12 bg-[#3d1d42] rounded-full shrink-0 flex items-center justify-center">
                                    <Users className="text-white w-6 h-6" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-gray-900">Person Name</p>
                                    <p className="text-[11px] text-gray-400 font-medium">Person Designation</p>
                                    <div className="flex items-center text-[11px] text-gray-400 mt-0.5 font-medium">
                                        <MapPin size={10} className="mr-1 text-[#a87fb4]" /> Location
                                    </div>
                                    <p className="text-[10px] text-gray-300 mt-1">10 Mutual Connects</p>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <button className="p-1.5 rounded-full border border-gray-200 text-[#a87fb4] hover:bg-gray-50">
                                        <MessageCircle size={16} />
                                    </button>
                                    <button className="p-1.5 rounded-full bg-[#a87fb4] text-white shadow-sm">
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}

                        <button className="w-full text-center py-3 text-[#a87fb4] text-sm font-bold hover:underline">
                            Show All
                        </button>
                    </section>

                    {/* Similar Companies */}
                    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Companies</h3>

                        {[1, 2].map((i) => (
                            <div key={i} className="mb-6 last:mb-0">
                                <div className="flex gap-4">
                                    <div className="w-12 h-12 bg-[#3d1d42] rounded-lg flex items-center justify-center shrink-0">
                                        <Briefcase className="text-white w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">Company Name</p>
                                        <p className="text-[11px] text-gray-400">Serve In Sector</p>
                                        <p className="text-[10px] text-gray-400 font-medium">308,800 Followers</p>
                                    </div>
                                </div>

                                <div className="mt-3 flex items-center gap-2">
                                    <div className="flex -space-x-2">
                                        <div className="w-5 h-5 rounded-full bg-gray-200 border border-white" />
                                        <div className="w-5 h-5 rounded-full bg-gray-300 border border-white" />
                                    </div>
                                    <p className="text-[10px] text-gray-500 font-medium">44 Connections Follow This Page</p>
                                </div>

                                <button className="w-full mt-4 py-1.5 rounded-full bg-[#a87fb4] text-white text-xs font-bold shadow-sm">
                                    Follow
                                </button>
                            </div>
                        ))}

                        <button className="w-full text-center mt-4 text-[#a87fb4] text-sm font-bold hover:underline">
                            Show All
                        </button>
                    </section>

                    {/* Ad Banner Bottom */}
                    <div className="bg-white border border-gray-100 rounded-2xl h-80 flex items-center justify-center text-gray-400 font-bold shadow-sm">
                        Ad Banner
                    </div>

                </div>
            </div>
        </main>
    );
}

export default function layout({ children }: { children: React.ReactNode }) {
    return (
        <CompanyProvider>
            <CompanyLayoutContent>
                {children}
            </CompanyLayoutContent>
        </CompanyProvider>
    );
}