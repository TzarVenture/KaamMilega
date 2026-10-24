"use client";
import { useState, useRef, useEffect, useMemo } from "react";

import { ArrowUpRightIcon, BookOpenIcon, BriefcaseIcon, BuildingsIcon, CalendarCheckIcon, CalendarPlusIcon, CaretDownIcon, CaretRightIcon, ChalkboardTeacherIcon, CheckCircleIcon, CheckIcon, FileTextIcon, GearSixIcon, LifebuoyIcon, ListIcon, MagnifyingGlassIcon, MapPinIcon, NewspaperIcon, SealCheckIcon, SignOutIcon, WalletIcon, XIcon } from '@phosphor-icons/react';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import {
  ChatNavIcon,
  EventsNavIcon,
  FeedNavIcon,
  HomeNavIcon,
  InstantNavIcon,
  JobsNavIcon,
  MentorsNavIcon,
  NetworkNavIcon,
  NotificationsNavIcon,
  ResourcesNavIcon,
  type NavIcon,
} from "./icons/NavIcons";
import CitySelector from "./CitySelector";
import BrandLogo from "./BrandLogo";
import ThemeToggle, { ThemeIconButton } from "./ThemeToggle";
import SearchHint from "./SearchHint";
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

interface NavLink {
  href: string;
  Icon: NavIcon;
  label: string;
  /** Brand-coloured icon */
  accent?: boolean;
}

// Desktop nav item: duotone icon in a rounded hit area; the active item sits on a soft blue tile
const navItemClass = (isActive: boolean) =>
  `relative w-11 h-11 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
    isActive ? "bg-[#EAF1FC] text-km-heading dark:bg-blue-500/15" : "text-slate-600 hover:bg-km-surface hover:text-km-heading"
  }`;

// Dark hover tooltip under a nav item (the item's wrapper needs the `group` class)
const NavTooltip = ({ label, align = "center" }: { label: string; align?: "center" | "right" }) => (
  <span
    className={`absolute top-full mt-1.5 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 translate-y-1 group-hover:translate-y-0 z-50 ${
      align === "right" ? "right-0" : "left-1/2 -translate-x-1/2"
    }`}
    aria-hidden="true"
  >
    <span className="block bg-[#071A4D] text-white text-xs font-medium py-1 px-2 rounded-md shadow-md whitespace-nowrap dark:bg-km-primary">
      {label}
    </span>
  </span>
);

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

  const navLinks: NavLink[] = [
    { href: "/", Icon: HomeNavIcon, label: "Home" },
    { href: "/feed", Icon: FeedNavIcon, label: "Feed" },
    ...(FEATURES.INSTANT_MILEGA
      ? [{ href: "/instant-milega", Icon: InstantNavIcon, label: "InstantMilega™" }]
      : []),
    { href: "/network", Icon: NetworkNavIcon, label: "Network" },
    { href: "/events", Icon: EventsNavIcon, label: "Events" },
    { href: "/jobs", Icon: JobsNavIcon, label: "Jobs" },
    { href: "/mentorship", Icon: MentorsNavIcon, label: "Mentors" },
    { href: "/chat", Icon: ChatNavIcon, label: "Chat" },
    ...(!isRecruiter ? [{ href: "/resources", Icon: ResourcesNavIcon, label: "Resources" }] : []),
  ];

  return (
    <>
      <nav className="bg-km-surface-card border-b border-slate-200 px-4 md:px-6 h-16 flex items-center justify-between sticky top-0 z-50 shadow-xs font-sans">
        {/* Left Section: Logo & Search */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="shrink-0 flex items-center">
            <BrandLogo size="sm" showTextOnMobile={true} />
          </div>

          {/* Desktop: City selector + Search */}
          <div className="hidden md:flex items-center gap-3 flex-1 min-w-0 max-w-lg">
            {/* City picker needs room; tablets keep just the search next to the icon bar */}
            {showCitySelector && (
              <div className="hidden lg:block shrink-0">
                <CitySelector
                  selectedCity={selectedCity}
                  onCityChange={handleCityChange}
                  variant="navbar"
                />
              </div>
            )}

            <form onSubmit={handleSearch} className="relative w-full">
              <MagnifyingGlassIcon weight="bold"
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                size={17}
              />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                aria-label="Search jobs, skills, companies and more"
                className="w-full pl-10 pr-9 py-2.5 bg-km-surface border border-km-border rounded-full text-sm font-normal text-km-text-primary focus:outline-none focus:border-[#071A4D] focus:bg-km-surface-card focus:ring-2 focus:ring-[#071A4D]/10 transition-all shadow-2xs dark:focus:border-km-link dark:focus:ring-km-link"
              />
              {!searchValue && <SearchHint className="left-10 right-8" />}
              {searchValue && (
                <button
                  type="button"
                  onClick={() => setSearchValue("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <XIcon weight="bold" size={15} />
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Right Section: Desktop nav icons with hover tooltips & Profile */}
        <div className="hidden md:flex items-center gap-2 ml-4 shrink-0">
          <div className="flex items-center gap-0.5 border-r border-slate-200 pr-2">
            {navLinks.map(({ href, Icon, label, accent }) => {
              const isActive = isLinkActive(href);
              return (
                <div key={href} className="relative group">
                  <Link
                    href={href}
                    className={navItemClass(isActive)}
                    aria-label={label}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span className="relative">
                      <Icon size={22} active={isActive} className={accent ? "text-[#FF6B00]" : undefined} />
                      {href === "/chat" && chatUnreadCount > 0 && (
                        <span className="absolute -top-1.5 -right-2 min-w-[17px] h-[17px] px-1 bg-[#FF6B00] text-white text-[10px] font-bold rounded-full flex items-center justify-center border border-white dark:border-km-surface-card">
                          {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
                        </span>
                      )}
                    </span>
                  </Link>
                  <NavTooltip label={label} />
                </div>
              );
            })}

            {FEATURES.DARK_MODE && <ThemeIconButton />}

            {/* Notifications Icon with Popover Dropdown */}
            <div
              className="relative group flex items-center justify-center"
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
                className={navItemClass(pathname === "/notifications" || notifDropdownOpen)}
                aria-label="Notifications"
              >
                <span className="relative">
                  <NotificationsNavIcon size={22} active={pathname === "/notifications" || notifDropdownOpen} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[17px] h-[17px] px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border border-white dark:border-km-surface-card">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </span>
              </button>
              {!notifDropdownOpen && <NavTooltip label="Notifications" />}

              {/* Dropdown Popover */}
              {notifDropdownOpen && (
                <div className="absolute right-0 top-12 w-84 sm:w-96 bg-km-surface-card rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-150 font-sans">
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
                              ? "bg-km-surface-card text-slate-900 font-bold shadow-xs"
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
                              ? "bg-km-surface-card text-slate-900 font-bold shadow-xs"
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
                        className="text-xs font-semibold text-km-heading hover:text-km-primary-dark transition-colors cursor-pointer flex items-center gap-1 shrink-0 dark:hover:text-km-link"
                      >
                        <CheckIcon weight="bold" size={13} />
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
                            <CheckCircleIcon size={32} weight="duotone" className="text-emerald-600 mx-auto mb-2 dark:text-emerald-400" aria-hidden="true" />
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
                                  : "bg-km-surface-card hover:bg-slate-50"
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
                                  <span className="w-8 h-8 flex items-center justify-center text-km-heading" aria-hidden="true">
                                    <ChatNavIcon size={22} />
                                  </span>
                                ) : notif.category === "jobs" ? (
                                  <span className="w-8 h-8 flex items-center justify-center text-km-heading" aria-hidden="true">
                                    <JobsNavIcon size={22} />
                                  </span>
                                ) : notif.category === "network" ? (
                                  <span className="w-8 h-8 flex items-center justify-center text-km-heading" aria-hidden="true">
                                    <NetworkNavIcon size={22} />
                                  </span>
                                ) : (
                                  <span className="w-8 h-8 flex items-center justify-center text-km-heading" aria-hidden="true">
                                    <NotificationsNavIcon size={22} />
                                  </span>
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
                      className="text-xs font-bold text-km-heading hover:text-km-primary-dark transition-colors py-1 block dark:hover:text-km-link"
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
              className={`flex items-center gap-1 p-1.5 rounded-xl transition-colors cursor-pointer ${isMenuOpen ? "bg-[#EAF1FC] dark:bg-blue-500/15" : "hover:bg-km-surface"}`}
              aria-label="Account and settings"
              aria-expanded={isMenuOpen}
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
              <CaretDownIcon weight="bold"
                size={14}
                className={`text-slate-500 transition-transform duration-200 ${isMenuOpen ? "rotate-180" : ""}`}
              />
            </button>
            {!isMenuOpen && <NavTooltip label="Account & Settings" align="right" />}

            {/* Context Menu (Dropdown) */}
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-km-surface-card rounded-2xl shadow-xl border border-slate-200 py-4 z-50 animate-in fade-in zoom-in-95 duration-150">
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
                    <span className="inline-block mt-0.5 px-2 py-0.5 bg-blue-50 text-km-heading rounded-full text-[10px] font-bold">
                      {roleLabel}
                    </span>
                  </div>
                </div>

                <div className="px-4 mb-3">
                  <Link href="/profile">
                    <button className="w-full py-1.5 border border-km-primary text-km-heading hover:bg-blue-50 rounded-xl text-xs font-bold transition-colors">
                      View Profile
                    </button>
                  </Link>
                </div>

                <hr className="border-gray-100" />

                <div className="py-2">
                  <h5 className="px-4 text-[13px] font-bold text-gray-900 mt-2">
                    Account
                  </h5>
                  <MenuItem label="Settings & privacy" href={isRecruiter ? "/recruiter/settings" : "/settings"} />
                  <MenuItem label="Wallet" href="/wallet" />
                  <MenuItem label="Language" href={`${isRecruiter ? "/recruiter/settings" : "/settings"}?tab=preferences`} />
                  <MenuItem label="Help & support" href="/support" />
                  {FEATURES.DARK_MODE && (
                    <div className="px-4 pt-3">
                      <p className="text-xs font-semibold text-km-text-secondary mb-1.5">Theme</p>
                      <ThemeToggle />
                    </div>
                  )}
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
                      <MenuItem label="Posts & activity" href="/recruiter/posts" />
                    </>
                  ) : (
                    <>
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
                      <h5 className="px-4 text-[13px] font-bold text-km-heading mt-2">
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
                      className="flex items-center text-km-heading text-xs font-bold hover:underline"
                    >
                      Create Company Page{" "}
                      <ArrowUpRightIcon weight="bold" size={14} className="ml-1" />
                    </Link>
                    {!isExpert && (
                      <Link
                        href="/expert/apply"
                        className="flex items-center text-km-heading text-xs font-bold hover:underline"
                      >
                        Apply to be an Expert{" "}
                        <ArrowUpRightIcon weight="bold" size={14} className="ml-1" />
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Right: Search + Avatar + Hamburger */}
        <div className="flex md:hidden items-center gap-1 ml-2 shrink-0">
          {FEATURES.DARK_MODE && (
            <div className="hidden sm:block">
              <ThemeIconButton />
            </div>
          )}
          <button
            onClick={() => {
              setMobileSearchOpen(!mobileSearchOpen);
              if (mobileNavOpen) setMobileNavOpen(false);
            }}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              mobileSearchOpen
                ? "bg-blue-50 text-km-heading"
                : "hover:bg-gray-100 text-gray-600"
            }`}
            aria-label="Search"
          >
            <MagnifyingGlassIcon size={20} />
          </button>
          <div className="relative flex items-center justify-center">
            <Link
              href="/notifications"
              className="p-1 block relative"
              aria-label="Notifications"
            >
              <NotificationsNavIcon
                size={22}
                active={pathname === "/notifications"}
                className={unreadCount > 0 ? "text-km-heading" : "text-gray-600"}
              />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-white shadow-2xs dark:border-km-surface-card">
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
            {mobileNavOpen ? <XIcon size={22} /> : <ListIcon size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile Search Overlay */}
      {mobileSearchOpen && (
        <>
          <div
            onClick={() => setMobileSearchOpen(false)}
            className="md:hidden fixed inset-0 top-16 z-40 bg-km-ink/40 backdrop-blur-xs transition-opacity duration-150 animate-in fade-in"
            aria-hidden="true"
          />
          <div className="md:hidden fixed top-16 inset-x-0 z-50 bg-km-surface-card border-b border-slate-200 px-4 py-3 shadow-xl animate-in slide-in-from-top-2 duration-150">
            <form
              onSubmit={handleSearch}
              className="relative flex items-center bg-km-surface rounded-xl border border-km-border px-3.5 py-2.5 gap-2 focus-within:border-[#071A4D] focus-within:bg-km-surface-card focus-within:ring-2 focus-within:ring-[#071A4D]/10 transition-all dark:focus-within:border-km-link dark:focus-within:ring-km-link"
            >
              <MagnifyingGlassIcon weight="bold" size={18} className="text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchValue}
                autoFocus
                onChange={(e) => setSearchValue(e.target.value)}
                aria-label="Search jobs, skills, companies and more"
                className="bg-transparent text-sm outline-none w-full text-km-text-primary"
              />
              {!searchValue && <SearchHint className="left-10 right-16" />}
              <button
                type="submit"
                className="bg-[#071A4D] hover:bg-[#0B1F52] text-white text-xs font-semibold px-4 py-2 rounded-lg shrink-0 transition-colors cursor-pointer shadow-2xs dark:bg-km-primary dark:hover:bg-km-primary-dark"
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
            className="md:hidden fixed inset-0 top-16 z-40 bg-km-ink/50 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
            aria-hidden="true"
          />
          <div className="md:hidden fixed top-16 inset-x-0 z-50 bg-km-surface-card border-b border-slate-200 shadow-2xl max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain animate-in slide-in-from-top duration-200">
            {/* User identity */}
            <Link
              href="/profile"
              onClick={() => setMobileNavOpen(false)}
              className="flex items-center gap-3 px-4 py-4 border-b border-km-border hover:bg-km-surface transition-colors"
            >
              <div className="w-11 h-11 bg-km-primary rounded-full flex items-center justify-center overflow-hidden text-white font-bold shrink-0">
                {user?.profile_image ? (
                  <CustomImage src={user.profile_image} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-base font-bold">{displayName?.[0]?.toUpperCase() || "U"}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-km-text-primary text-sm truncate">{displayName}</p>
                <p className="text-xs text-km-text-secondary">View profile · {roleLabel}</p>
              </div>
              <CaretRightIcon size={16} weight="bold" className="text-km-text-secondary shrink-0" aria-hidden="true" />
            </Link>

            {/* Account: the things people look for first */}
            <MobileSection title="Account">
              <MobileRow
                href={isRecruiter ? "/recruiter/settings" : "/settings"}
                Icon={GearSixIcon}
                label="Settings & privacy"
                onNavigate={() => setMobileNavOpen(false)}
              />
              <MobileRow href="/wallet" Icon={WalletIcon} label="Wallet" onNavigate={() => setMobileNavOpen(false)} />
              <MobileRow href="/support" Icon={LifebuoyIcon} label="Help & support" onNavigate={() => setMobileNavOpen(false)} />
              {FEATURES.DARK_MODE && (
                <div className="px-4 pt-2 pb-1">
                  <p className="text-xs font-semibold text-km-text-secondary mb-1.5">Appearance</p>
                  <ThemeToggle />
                </div>
              )}
            </MobileSection>

            {/* Main navigation */}
            <MobileSection title="Browse">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileNavOpen(false)}
                  aria-current={isLinkActive(link.href) ? "page" : undefined}
                  className={`group flex items-center justify-between min-h-11 px-4 text-sm font-semibold rounded-xl hover:bg-km-surface transition-colors ${isLinkActive(link.href) ? "text-km-heading bg-km-surface" : "text-km-text-primary"}`}
                >
                  <span className="flex items-center gap-3.5">
                    <link.Icon size={20} strokeWidth={1.9} active={isLinkActive(link.href)} className={link.accent ? "text-[#FF6B00]" : undefined} />
                    {link.label}
                  </span>
                  {link.href === "/chat" && chatUnreadCount > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1.5 bg-[#FF6B00] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
                    </span>
                  )}
                </Link>
              ))}
            </MobileSection>

            {/* Role-specific */}
            {isRecruiter ? (
              <MobileSection title="Hiring">
                <MobileRow href="/recruiter/jobs/list" Icon={BriefcaseIcon} label="My jobs" onNavigate={() => setMobileNavOpen(false)} />
                <MobileRow href="/recruiter/applications" Icon={FileTextIcon} label="Applications" onNavigate={() => setMobileNavOpen(false)} />
                <MobileRow href="/recruiter/interviews" Icon={CalendarCheckIcon} label="Interviews" onNavigate={() => setMobileNavOpen(false)} />
                <MobileRow href="/recruiter/posts" Icon={NewspaperIcon} label="Posts & activity" onNavigate={() => setMobileNavOpen(false)} />
              </MobileSection>
            ) : (
              <MobileSection title="Your activity">
                <MobileRow href="/applications" Icon={FileTextIcon} label="My applications" onNavigate={() => setMobileNavOpen(false)} />
                <MobileRow href="/interviews" Icon={CalendarCheckIcon} label="Interviews" onNavigate={() => setMobileNavOpen(false)} />
              </MobileSection>
            )}

            {isExpert && (
              <MobileSection title="Expert portal">
                <MobileRow href="/user/events/create" Icon={CalendarPlusIcon} label="Create event" onNavigate={() => setMobileNavOpen(false)} />
                <MobileRow href="/courses" Icon={BookOpenIcon} label="My courses" onNavigate={() => setMobileNavOpen(false)} />
                <MobileRow href="/expert/mentorship" Icon={ChalkboardTeacherIcon} label="Manage mentorships" onNavigate={() => setMobileNavOpen(false)} />
              </MobileSection>
            )}

            {!isRecruiter && (
              <MobileSection title="Grow with KaamMilega">
                <MobileRow href="/recruiter/register" Icon={BuildingsIcon} label="Create a company page" onNavigate={() => setMobileNavOpen(false)} />
                {!isExpert && (
                  <MobileRow href="/expert/apply" Icon={SealCheckIcon} label="Become an expert" onNavigate={() => setMobileNavOpen(false)} />
                )}
              </MobileSection>
            )}

            <div className="px-3 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-km-border">
              <button
                type="button"
                onClick={async () => {
                  await clearSession();
                  window.location.href = "/login";
                }}
                className="w-full min-h-11 flex items-center gap-3.5 px-4 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer dark:text-red-400 dark:hover:bg-red-500/10"
              >
                <SignOutIcon size={20} weight="bold" aria-hidden="true" />
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

const menuItemClass =
  "block w-full text-left px-4 py-2 text-xs text-km-text-secondary hover:bg-km-surface hover:text-km-text-primary cursor-pointer transition-colors focus-visible:outline-none focus-visible:bg-km-surface";

const MenuItem = ({
  label,
  onClick,
  href,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
}) =>
  href ? (
    <Link href={href} onClick={onClick} className={menuItemClass}>
      {label}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={menuItemClass}>
      {label}
    </button>
  );

// Mobile drawer building blocks: a titled group, and a 44px-tall row with an icon
const MobileSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="px-3 py-2 border-t border-km-border first:border-t-0">
    <p className="px-4 pt-1 pb-1.5 text-xs font-semibold text-km-text-secondary">{title}</p>
    <div className="flex flex-col">{children}</div>
  </div>
);

const MobileRow = ({
  href,
  Icon,
  label,
  onNavigate,
}: {
  href: string;
  Icon: PhosphorIcon;
  label: string;
  onNavigate: () => void;
}) => (
  <Link
    href={href}
    onClick={onNavigate}
    className="flex items-center gap-3.5 min-h-11 px-4 text-sm font-semibold text-km-text-primary rounded-xl hover:bg-km-surface transition-colors"
  >
    <Icon size={20} weight="regular" className="text-km-text-secondary shrink-0" aria-hidden="true" />
    {label}
  </Link>
);

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
