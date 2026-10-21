"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import {
  Search,
  MapPin,
  ChevronDown,
  Home,
  Users,
  Briefcase,
  MessageSquare,
  BookOpen,
  Bell,
  ArrowUpRight,
  Menu,
  X,
  Calendar,
  Zap,
  Check,
} from "lucide-react";
import CitySelector from "./CitySelector";
import BrandLogo from "./BrandLogo";
import CustomImage from "@/components/ui/CustomImage";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { clearSession } from "@/lib/auth";
import { FEATURES } from "@/config/features";
import {
  useNotifications,
  sanitizeNotificationLink,
} from "@/lib/notifications";

interface NavbarProps {
  showCitySelector?: boolean;
  user?: any;
}

const Navbar = ({ showCitySelector = true, user }: NavbarProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const {
    unreadCount,
    chatUnreadCount,
    recentNotifications,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [notifPopoverTab, setNotifPopoverTab] = useState<"unread" | "all">(
    "unread",
  );
  const notifRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Close profile & notification dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (
        notifRef.current &&
        !notifRef.current.contains(event.target as Node)
      ) {
        setNotifDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close popovers on route change
  useEffect(() => {
    setNotifDropdownOpen(false);
    setIsMenuOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile drawer or mobile search is open
  useEffect(() => {
    if (mobileNavOpen || mobileSearchOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen, mobileSearchOpen]);

  // Close mobile drawers on route change
  useEffect(() => {
    setMobileNavOpen(false);
    setMobileSearchOpen(false);
  }, [pathname]);

  const displayName = user?.name || "User";

  // Determine Role
  const roles = Array.isArray(user?.roles)
    ? user.roles
    : user?.role
      ? [user.role]
      : [];
  const isRecruiter = roles.includes("recruiter");
  const isExpert = roles.includes("expert");
  const roleLabel = isRecruiter ? "Recruiter" : isExpert ? "Expert" : "User";

  const [searchValue, setSearchValue] = useState(searchParams.get("q") || "");
  const [selectedCity, setSelectedCity] = useState(
    searchParams.get("city") || "All",
  );

  const isLinkActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (searchValue) params.set("q", searchValue);
    else params.delete("q");

    if (selectedCity && selectedCity !== "All")
      params.set("city", selectedCity);
    else params.delete("city");

    router.push(`/jobs?${params.toString()}`);
    setMobileSearchOpen(false);
    setMobileNavOpen(false);
  };

  const handleCityChange = (city: string) => {
    setSelectedCity(city);
    const params = new URLSearchParams(searchParams.toString());
    if (city && city !== "All") params.set("city", city);
    else params.delete("city");

    if (searchValue) params.set("q", searchValue);
    router.push(`/jobs?${params.toString()}`);
  };

  const navLinks = [
    { href: "/", icon: <Home size={18} />, label: "Home" },
    ...(FEATURES.INSTANT_MILEGA
      ? [
          {
            href: "/instant-milega",
            icon: <Zap size={18} className="text-[#FF6B00] fill-[#FF6B00]" />,
            label: "InstantMilega™",
          },
        ]
      : []),
    { href: "/network", icon: <Users size={18} />, label: "Network" },
    { href: "/events", icon: <Calendar size={18} />, label: "Events" },
    { href: "/jobs", icon: <Briefcase size={18} />, label: "Jobs" },
    { href: "/mentorship", icon: <BookOpen size={18} />, label: "Mentors" },
    { href: "/chat", icon: <MessageSquare size={18} />, label: "Chat" },
    ...(!isRecruiter
      ? [
          {
            href: "/resources",
            icon: <BookOpen size={18} />,
            label: "Resources",
          },
        ]
      : []),
  ];

  return (
    <>
      <nav className="bg-white border-b border-slate-200 px-4 md:px-6 h-16 flex items-center justify-between sticky top-0 z-50 shadow-xs font-sans">
        {/* Left Section: Logo & Search */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="shrink-0 flex items-center">
            <BrandLogo size="sm" showTextOnMobile={true} />
          </div>

          {/* Desktop: City selector + Search */}
          <div className="hidden md:flex items-center gap-3 flex-1 min-w-0 max-w-md">
            {showCitySelector && (
              <CitySelector
                selectedCity={selectedCity}
                onCityChange={handleCityChange}
                variant="navbar"
              />
            )}

            <form onSubmit={handleSearch} className="relative w-full">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={15}
              />
              <input
                type="text"
                placeholder="Job Title, Skills or Category..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="w-full pl-9 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-km-primary focus:bg-white focus:ring-2 focus:ring-km-primary/15 transition-all"
              />
              {searchValue && (
                <button
                  type="button"
                  onClick={() => setSearchValue("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X size={13} />
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Right Section: Desktop Icons with Custom Tooltips & Profile */}
        <div className="hidden md:flex items-center gap-3 ml-4 shrink-0">
          <div className="flex items-center gap-1.5 text-slate-600 border-r border-slate-200 pr-3">
            {navLinks.map((link) => {
              const isActive = isLinkActive(link.href);
              return (
                <div
                  key={link.href}
                  className="relative group flex items-center justify-center"
                >
                  <Link
                    href={link.href}
                    className={`relative p-2 rounded-xl flex items-center justify-center transition-all duration-150 ${
                      isActive
                        ? "text-km-primary bg-blue-50/90 font-bold shadow-xs"
                        : "text-slate-600 hover:text-km-primary hover:bg-slate-50"
                    }`}
                    aria-label={link.label}
                  >
                    {link.icon}
                    {link.href === "/chat" && chatUnreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 bg-[#FF6B00] text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-white shadow-2xs animate-in zoom-in-75 duration-150">
                        {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
                      </span>
                    )}
                    {isActive && (
                      <span className="absolute -bottom-1 left-2 right-2 h-0.5 bg-km-primary rounded-full" />
                    )}
                  </Link>


                  {/* Custom Floating Tooltip */}
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 translate-y-1 group-hover:translate-y-0 z-50">
                    <div className="bg-slate-900 text-white text-[10px] font-semibold py-0.5 px-2 rounded-md shadow-md whitespace-nowrap">
                      {link.label}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Notifications Icon with Popover Dropdown */}
            <div
              className="relative flex items-center justify-center"
              ref={notifRef}
            >
              <button
                onClick={() => {
                  const nextState = !notifDropdownOpen;
                  setNotifDropdownOpen(nextState);
                  if (nextState) {
                    fetchNotifications("all", false, 8, 0).catch(() => {});
                  }
                }}
                className={`relative p-2 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer ${
                  pathname === "/notifications" || notifDropdownOpen
                    ? "text-km-primary bg-blue-50/90 font-bold shadow-xs"
                    : "text-slate-600 hover:text-km-primary hover:bg-slate-50"
                }`}
                aria-label="Notifications"
              >
                <Bell
                  size={18}
                  className={
                    unreadCount > 0
                      ? "fill-slate-600 hover:fill-km-primary text-slate-600 hover:text-km-primary"
                      : ""
                  }
                />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-xs animate-in zoom-in duration-150">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
                {(pathname === "/notifications" || notifDropdownOpen) && (
                  <span className="absolute -bottom-1 left-2 right-2 h-0.5 bg-km-primary rounded-full" />
                )}
              </button>

              {/* Dropdown Popover */}
              {notifDropdownOpen && (
                <div className="absolute right-0 top-12 w-84 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-150 font-sans">
                  {/* Header */}
                  <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-sm">
                        Notifications
                      </h3>
                      <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[11px] font-medium">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setNotifPopoverTab("unread");
                          }}
                          className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                            notifPopoverTab === "unread"
                              ? "bg-white text-slate-900 font-bold shadow-xs"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          Unread{unreadCount > 0 ? ` (${unreadCount})` : ""}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setNotifPopoverTab("all");
                          }}
                          className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                            notifPopoverTab === "all"
                              ? "bg-white text-slate-900 font-bold shadow-xs"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          All
                        </button>
                      </div>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAllAsRead();
                        }}
                        className="text-xs font-semibold text-km-primary hover:text-km-primary-dark transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        <Check size={13} />
                        Mark all read
                      </button>
                    )}
                  </div>

                  {/* Notifications List */}
                  {(() => {
                    const unreadList = recentNotifications.filter(
                      (n) => !n.is_read,
                    );
                    const displayedNotifications =
                      notifPopoverTab === "unread"
                        ? unreadList
                        : recentNotifications;

                    return (
                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                        {displayedNotifications.length === 0 ? (
                          <div className="p-8 text-center text-slate-400">
                            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
                              <Check size={18} />
                            </div>
                            <p className="text-xs font-semibold text-slate-700">
                              All caught up!
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {notifPopoverTab === "unread"
                                ? "No unread notifications right now."
                                : "No notifications right now."}
                            </p>
                          </div>
                        ) : (
                          displayedNotifications.map((notif) => (
                            <div
                              key={notif.id}
                              onClick={() => {
                                if (!notif.is_read) {
                                  markAsRead(notif.id);
                                }
                                setNotifDropdownOpen(false);
                                const targetLink = sanitizeNotificationLink(
                                  notif.link,
                                  notif,
                                );
                                router.push(targetLink);
                              }}
                              className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer relative ${
                                !notif.is_read
                                  ? "bg-blue-50/50 hover:bg-blue-50/80"
                                  : "bg-white hover:bg-slate-50"
                              }`}
                            >
                              {/* Notification Icon/Avatar */}
                              <div className="shrink-0 mt-0.5">
                                {notif.actor_avatar ? (
                                  <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-100 ring-1 ring-slate-200">
                                    <CustomImage
                                      src={notif.actor_avatar}
                                      alt={notif.actor_name || "User"}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ) : notif.category === "messages" ? (
                                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
                                    <MessageSquare
                                      size={15}
                                      className="fill-blue-700"
                                    />
                                  </div>
                                ) : notif.category === "jobs" ? (
                                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
                                    <Briefcase
                                      size={15}
                                      className="fill-amber-700"
                                    />
                                  </div>
                                ) : notif.category === "network" ? (
                                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                                    <Users
                                      size={15}
                                      className="fill-emerald-700"
                                    />
                                  </div>
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
                                    <Bell
                                      size={15}
                                      className="fill-slate-700"
                                    />
                                  </div>
                                )}
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1 mb-0.5">
                                  <p
                                    className={`text-xs truncate ${!notif.is_read ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}
                                  >
                                    {notif.title ||
                                      notif.actor_name ||
                                      "Notification"}
                                  </p>
                                  <span className="text-[10px] text-slate-400 shrink-0">
                                    {formatRelativeTime(notif.created_at)}
                                  </span>
                                </div>
                                <p
                                  className={`text-[11px] line-clamp-2 leading-relaxed ${!notif.is_read ? "text-slate-800" : "text-slate-500"}`}
                                >
                                  {notif.message}
                                </p>
                              </div>

                              {/* Unread indicator dot */}
                              {!notif.is_read && (
                                <div className="w-2 h-2 rounded-full bg-km-primary shrink-0 mt-2" />
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })()}

                  {/* Footer */}
                  <div className="p-2 border-t border-slate-100 text-center bg-slate-50/60 rounded-b-2xl">
                    <Link
                      href="/notifications"
                      onClick={() => setNotifDropdownOpen(false)}
                      className="text-xs font-bold text-km-primary hover:text-km-primary-dark transition-colors py-1 block"
                    >
                      View all notifications
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Profile Dropdown */}
          <div className="relative group" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center gap-2 hover:bg-slate-50 p-1.5 rounded-xl transition-colors border border-transparent hover:border-slate-200"
            >
              <div className="w-8 h-8 bg-km-primary rounded-full flex items-center justify-center overflow-hidden shrink-0">
                {user?.profile_image ? (
                  <CustomImage
                    src={user.profile_image}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white text-xs font-bold">
                    {displayName?.[0]?.toUpperCase() || "U"}
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold text-slate-800 hidden lg:inline">
                {displayName}
              </span>
              <ChevronDown
                size={14}
                className={`text-slate-500 transition-transform duration-200 ${isMenuOpen ? "rotate-180" : ""}`}
              />
            </button>

            {/* Profile Tooltip */}
            {!isMenuOpen && (
              <div className="absolute -bottom-8 right-0 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 translate-y-1 group-hover:translate-y-0 z-50">
                <div className="bg-slate-900 text-white text-[10px] font-semibold py-0.5 px-2 rounded-md shadow-md whitespace-nowrap">
                  Account &amp; Settings
                </div>
              </div>
            )}

            {/* Context Menu (Dropdown) */}
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                {/* User Identity */}
                <div className="px-4 pb-3 flex items-center gap-3">
                  <div className="w-11 h-11 bg-km-primary rounded-full flex items-center justify-center overflow-hidden text-white font-bold shrink-0">
                    {user?.profile_image ? (
                      <CustomImage
                        src={user.profile_image}
                        alt={displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-bold">
                        {displayName?.[0]?.toUpperCase() || "U"}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-slate-900 leading-tight truncate">
                      {displayName}
                    </h4>
                    <span className="inline-block mt-0.5 px-2 py-0.5 bg-blue-50 text-km-primary rounded-full text-[10px] font-bold">
                      {roleLabel}
                    </span>
                  </div>
                </div>

                <div className="px-4 mb-3">
                  <Link href="/profile">
                    <button className="w-full py-1.5 border border-km-primary text-km-primary hover:bg-blue-50 rounded-xl text-xs font-bold transition-colors">
                      View Profile
                    </button>
                  </Link>
                </div>

                <hr className="border-gray-100" />

                <div className="py-2">
                  <h5 className="px-4 text-[13px] font-bold text-gray-900 mt-2">
                    Account
                  </h5>
                  <MenuItem label="Digital Wallet" href="/wallet" />
                  {!isRecruiter && <MenuItem label="Try Premium" />}
                  <MenuItem
                    label="Setting & Privacy"
                    href={isRecruiter ? "/recruiter/settings" : "/settings"}
                  />
                  <MenuItem label="Help" />
                  <MenuItem label="Language" />
                </div>

                <hr className="border-gray-100" />

                <div className="py-2">
                  <h5 className="px-4 text-[13px] font-bold text-gray-900 mt-2">
                    Manage
                  </h5>
                  {isRecruiter ? (
                    <>
                      <MenuItem label="My Jobs" href="/recruiter/jobs/list" />
                      <MenuItem
                        label="Active Applications"
                        href="/recruiter/applications"
                      />
                      <MenuItem
                        label="Interviews"
                        href="/recruiter/interviews"
                      />
                    </>
                  ) : (
                    <>
                      <MenuItem label="Posts & Activity" />
                      <MenuItem label="Job Posting Account" href="/recruiter" />
                      <MenuItem
                        label="Applied Jobs Status"
                        href="/applications"
                      />
                      <MenuItem label="Interviews" href="/interviews" />
                    </>
                  )}
                  {isExpert && (
                    <>
                      <hr className="border-gray-100 my-2" />
                      <h5 className="px-4 text-[13px] font-bold text-km-primary mt-2">
                        Expert Portal
                      </h5>
                      <MenuItem
                        label="Create Event"
                        href="/user/events/create"
                      />
                      <MenuItem label="My Courses" href="/courses" />
                      <MenuItem
                        label="Manage Mentorships"
                        href="/expert/mentorship"
                      />
                    </>
                  )}
                </div>

                <hr className="border-gray-100" />

                <div className="pt-2">
                  <MenuItem
                    label="Sign Out"
                    onClick={async () => {
                      await clearSession();
                      window.location.href = "/login";
                    }}
                  />
                </div>

                {!isRecruiter && (
                  <div className="px-4 pt-4 flex flex-col gap-2">
                    <Link
                      href="/recruiter/register"
                      className="flex items-center text-km-primary text-xs font-bold hover:underline"
                    >
                      Create Company Page{" "}
                      <ArrowUpRight size={14} className="ml-1" />
                    </Link>
                    {!isExpert && (
                      <Link
                        href="/expert/apply"
                        className="flex items-center text-km-primary text-xs font-bold hover:underline"
                      >
                        Apply to be an Expert{" "}
                        <ArrowUpRight size={14} className="ml-1" />
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Right: Search + Avatar + Hamburger */}
        <div className="flex md:hidden items-center gap-2 ml-2 shrink-0">
          <button
            onClick={() => {
              setMobileSearchOpen(!mobileSearchOpen);
              if (mobileNavOpen) setMobileNavOpen(false);
            }}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              mobileSearchOpen
                ? "bg-blue-50 text-km-primary"
                : "hover:bg-gray-100 text-gray-600"
            }`}
            aria-label="Search"
          >
            <Search size={20} />
          </button>
          <div className="relative flex items-center justify-center">
            <Link
              href="/notifications"
              className="p-1 block relative"
              aria-label="Notifications"
            >
              <Bell
                size={20}
                className={
                  unreadCount > 0
                    ? "fill-gray-700 text-gray-700"
                    : "text-gray-600"
                }
              />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-white shadow-2xs">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          </div>
          <button
            onClick={() => {
              setMobileNavOpen(!mobileNavOpen);
              if (mobileSearchOpen) setMobileSearchOpen(false);
            }}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              mobileNavOpen
                ? "bg-slate-100 text-slate-900"
                : "hover:bg-gray-100 text-gray-600"
            }`}
            aria-label="Menu"
          >
            {mobileNavOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile Search Overlay */}
      {mobileSearchOpen && (
        <>
          <div
            onClick={() => setMobileSearchOpen(false)}
            className="md:hidden fixed inset-0 top-16 z-40 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-150 animate-in fade-in"
            aria-hidden="true"
          />
          <div className="md:hidden fixed top-16 inset-x-0 z-50 bg-white border-b border-slate-200 px-4 py-3 shadow-xl animate-in slide-in-from-top-2 duration-150">
            <form
              onSubmit={handleSearch}
              className="flex items-center bg-slate-50 rounded-xl border border-slate-200 px-3.5 py-2 gap-2 focus-within:border-km-primary focus-within:bg-white focus-within:ring-1 focus-within:ring-km-primary transition-all"
            >
              <Search size={16} className="text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Job Title, Skills or Category..."
                value={searchValue}
                autoFocus
                onChange={(e) => setSearchValue(e.target.value)}
                className="bg-transparent text-sm outline-none w-full text-slate-800 placeholder:text-slate-400"
              />
              <button
                type="submit"
                className="bg-km-primary hover:bg-km-primary-dark text-white text-xs font-bold px-3.5 py-1.5 rounded-lg shrink-0 transition-colors cursor-pointer shadow-2xs"
              >
                Go
              </button>
            </form>
          </div>
        </>
      )}

      {/* Mobile Nav Drawer */}
      {mobileNavOpen && (
        <>
          <div
            onClick={() => setMobileNavOpen(false)}
            className="md:hidden fixed inset-0 top-16 z-40 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
            aria-hidden="true"
          />
          <div className="md:hidden fixed top-16 inset-x-0 z-50 bg-white border-b border-slate-200 shadow-2xl max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain animate-in slide-in-from-top duration-200">
            {/* User identity */}
            <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
              <div className="w-10 h-10 bg-km-primary rounded-full flex items-center justify-center overflow-hidden text-white font-bold shrink-0">
                {user?.profile_image ? (
                  <CustomImage
                    src={user.profile_image}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="rotate-45 text-sm">▲▲</span>
                )}
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">{displayName}</p>
                <p className="text-xs text-gray-500 italic">{roleLabel}</p>
              </div>
              <Link
                href="/profile"
                className="ml-auto"
                onClick={() => setMobileNavOpen(false)}
              >
                <span className="text-xs font-bold text-km-primary border border-blue-200 px-3 py-1 rounded-full hover:bg-blue-50 transition-colors">
                  Profile
                </span>
              </Link>
            </div>

            {/* Nav links */}
            <div className="py-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileNavOpen(false)}
                  className="flex items-center justify-between px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-blue-50 hover:text-km-primary transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {link.icon} {link.label}
                  </div>
                  {link.href === "/chat" && chatUnreadCount > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1.5 bg-[#FF6B00] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
                    </span>
                  )}
                </Link>
              ))}

            </div>

            <hr className="border-gray-100" />

            {/* Account actions */}
            <div className="py-2 px-4 flex flex-col gap-1">
              <Link
                href="/wallet"
                onClick={() => setMobileNavOpen(false)}
                className="py-2 text-sm text-gray-600 hover:text-km-primary font-medium"
              >
                Digital Wallet & Ledger
              </Link>
              {!isRecruiter && (
                <Link
                  href="/settings"
                  onClick={() => setMobileNavOpen(false)}
                  className="py-2 text-sm text-gray-600 hover:text-km-primary font-medium transition-colors"
                >
                  Setting & Privacy
                </Link>
              )}
              {isRecruiter ? (
                <>
                  <Link
                    href="/recruiter/jobs/list"
                    onClick={() => setMobileNavOpen(false)}
                    className="py-2 text-sm text-gray-600 hover:text-km-primary font-medium transition-colors"
                  >
                    My Jobs
                  </Link>
                  <Link
                    href="/recruiter/applications"
                    onClick={() => setMobileNavOpen(false)}
                    className="py-2 text-sm text-gray-600 hover:text-km-primary font-medium transition-colors"
                  >
                    Active Applications
                  </Link>
                  <Link
                    href="/recruiter/interviews"
                    onClick={() => setMobileNavOpen(false)}
                    className="py-2 text-sm text-gray-600 hover:text-km-primary font-medium transition-colors"
                  >
                    Interviews
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/applications"
                    onClick={() => setMobileNavOpen(false)}
                    className="py-2 text-sm text-gray-600 hover:text-km-primary font-medium transition-colors"
                  >
                    Applied Jobs Status
                  </Link>
                  <Link
                    href="/interviews"
                    onClick={() => setMobileNavOpen(false)}
                    className="py-2 text-sm text-gray-600 hover:text-km-primary font-medium transition-colors"
                  >
                    Interviews
                  </Link>
                  {!isExpert && (
                    <Link
                      href="/expert/apply"
                      onClick={() => setMobileNavOpen(false)}
                      className="py-2 text-sm text-gray-600 hover:text-km-primary font-medium transition-colors"
                    >
                      Apply to be an Expert
                    </Link>
                  )}
                  {isExpert && (
                    <>
                      <hr className="border-gray-100 my-2" />
                      <h5 className="px-4 text-[13px] font-bold text-km-primary">
                        Expert Portal
                      </h5>
                      <Link
                        href="/events/create"
                        onClick={() => setMobileNavOpen(false)}
                        className="py-2 text-sm text-gray-600 hover:text-km-primary font-medium transition-colors"
                      >
                        Create Event
                      </Link>
                      <Link
                        href="/courses"
                        onClick={() => setMobileNavOpen(false)}
                        className="py-2 text-sm text-gray-600 hover:text-km-primary font-medium transition-colors"
                      >
                        My Courses
                      </Link>
                      <Link
                        href="/expert/mentorship"
                        onClick={() => setMobileNavOpen(false)}
                        className="py-2 text-sm text-gray-600 hover:text-km-primary font-medium transition-colors"
                      >
                        Manage Mentorships
                      </Link>
                    </>
                  )}
                </>
              )}
            </div>

            <hr className="border-gray-100" />

            <div className="px-4 py-3">
              <button
                onClick={async () => {
                  await clearSession();
                  window.location.href = "/login";
                }}
                className="w-full text-center py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

const MenuItem = ({
  label,
  onClick,
  href,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
}) => {
  const content = (
    <div
      onClick={onClick}
      className="px-4 py-1.5 text-xs text-gray-500 hover:bg-gray-50 cursor-pointer transition-colors"
    >
      {label}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
};

function formatRelativeTime(dateString: string): string {
  if (!dateString) return "";
  try {
    const now = new Date();
    const date = new Date(dateString);
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d`;
    return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export default Navbar;
