"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Briefcase,
    PlusCircle,
    FileText,
    Users,
    LogOut,
    Building2,
    ShieldCheck,
    ChevronRight
} from "lucide-react";
import api from "@/lib/axios";

const sidebarItems = [
    { name: "Dashboard Overview", href: "/recruiter", icon: LayoutDashboard },
    { name: "Post New Job", href: "/recruiter/jobs/create", icon: PlusCircle },
    { name: "Manage Job Posts", href: "/recruiter/jobs/list", icon: Briefcase },
    { name: "Applicant Kanban", href: "/recruiter/applications", icon: FileText },
    { name: "Interviews", href: "/recruiter/interviews", icon: Users },
];

export default function RecruiterSidebar() {
    const pathname = usePathname();
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const userData = await api.get('/user/profile');
                setUser(userData);
            } catch { }
        };
        fetchUser();
    }, []);

    const companyName = user?.company_name || user?.name || "Company Portal";

    return (
        <aside className="w-64 bg-white border-r border-slate-200/80 h-[calc(100vh-3.5rem)] flex-col fixed left-0 top-14 overflow-y-auto z-30 hidden md:flex shadow-xs">
            
            {/* Header / Brand */}
            <div className="p-6 border-b border-slate-100">
                <Link href="/recruiter" className="flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-indigo-600 via-purple-600 to-violet-600 text-white flex items-center justify-center font-black shadow-md shadow-indigo-200 group-hover:scale-105 transition-transform">
                        <Briefcase className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="font-black text-lg text-slate-900 tracking-tight block leading-none">Kaam Milega</span>
                        <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-widest mt-1 block">
                            Recruiter ATS
                        </span>
                    </div>
                </Link>

                {/* Company Badge Card */}
                <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs uppercase shrink-0">
                        {companyName.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 truncate">{companyName}</p>
                        <p className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1">
                            <ShieldCheck size={11} /> Verified Partner
                        </p>
                    </div>
                </div>
            </div>

            {/* Navigation Menu */}
            <nav className="flex-1 py-6 px-4 space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-3 mb-2">Main Menu</p>
                {sidebarItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== "/recruiter" && pathname.startsWith(item.href));
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center justify-between px-3.5 py-3 rounded-2xl transition-colors duration-150 font-bold text-xs border ${
                                isActive
                                    ? "bg-indigo-50/80 text-indigo-700 border-indigo-100 shadow-xs"
                                    : "text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-900"
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <item.icon className={`w-4 h-4 transition-colors ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
                                <span>{item.name}</span>
                            </div>
                            <ChevronRight className={`w-3.5 h-3.5 transition-opacity ${isActive ? "opacity-100 text-indigo-600" : "opacity-0"}`} />
                        </Link>
                    );
                })}
            </nav>

            {/* Footer / Sign Out */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                <button
                    onClick={() => {
                        localStorage.removeItem("token");
                        localStorage.removeItem("user");
                        window.location.href = "/login";
                    }}
                    className="flex items-center gap-2.5 w-full px-4 py-3 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-2xl border border-transparent hover:border-rose-100 transition-all"
                >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out Session</span>
                </button>
            </div>
        </aside>
    );
}
