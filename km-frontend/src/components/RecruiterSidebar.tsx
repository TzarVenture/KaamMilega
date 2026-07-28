"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Briefcase,
    PlusCircle,
    FileText,
    Users,
    Settings,
    LogOut
} from "lucide-react";

const sidebarItems = [
    { name: "Dashboard", href: "/recruiter/", icon: LayoutDashboard },
    { name: "Create Job", href: "/recruiter/jobs/create", icon: PlusCircle },
    { name: "Manage Jobs", href: "/recruiter/jobs/list", icon: Briefcase },
    { name: "Applications", href: "/recruiter/applications", icon: FileText }, // Placeholder
    { name: "Interviews", href: "/recruiter/interviews", icon: Users }, // Placeholder
];

export default function RecruiterSidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 h-screen flex flex-col fixed left-0 top-0 overflow-y-auto z-10 hidden md:flex">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
                <Link href="/" className="flex items-center gap-2 font-bold text-xl text-blue-600 dark:text-blue-400">
                    <Briefcase className="w-8 h-8" />
                    <span>Kaam Milega</span>
                </Link>
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 font-medium px-1">
                    Recruiter Panel
                </div>
            </div>

            <nav className="flex-1 py-6 px-3 space-y-1">
                {sidebarItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium text-sm
                                ${isActive
                                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                                }
                            `}
                        >
                            <item.icon className={`w-5 h-5 ${isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-400 group-hover:text-gray-500"}`} />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-gray-200 dark:border-gray-800">
                <button
                    onClick={() => {
                        // Handle logout logic here
                        localStorage.removeItem("token");
                        localStorage.removeItem("user");
                        window.location.href = "/login";
                    }}
                    className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    Sign Out
                </button>
            </div>
        </aside>
    );
}
