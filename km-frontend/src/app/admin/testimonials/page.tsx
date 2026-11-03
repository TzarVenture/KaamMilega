"use client";

import React, { useState, useEffect } from "react";
import { CheckCircleIcon, CircleNotchIcon, EyeIcon, PencilSimpleIcon, PlayIcon, PlusIcon, StarIcon, TrashIcon, VideoCameraIcon, XCircleIcon, XIcon } from '@phosphor-icons/react';
import { notify } from "@/lib/notify";
import api from "@/lib/axios";
import { AdminPageHeader, SearchInput, btn, table } from "@/components/admin/ui";
import { extractYouTubeVideoId, getYouTubeThumbnail } from "@/lib/youtube";

interface Testimonial {
    id: string;
    name: string;
    role: string;
    company: string;
    city: string;
    trade_tag: string;
    rating: number;
    review?: string;
    youtube_url: string;
    youtube_video_id: string;
    thumbnail_url: string;
    is_active: boolean;
    order: number;
    created_at?: string;
}

export default function AdminTestimonialsPage() {
    const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Testimonial | null>(null);
    const [saving, setSaving] = useState(false);

    // Form fields
    const [name, setName] = useState("");
    const [role, setRole] = useState("");
    const [company, setCompany] = useState("");
    const [tradeTag, setTradeTag] = useState("");
    const [rating, setRating] = useState(5);
    const [review, setReview] = useState("");
    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [thumbnailUrl, setThumbnailUrl] = useState("");
    const [isActive, setIsActive] = useState(true);
    const [order, setOrder] = useState(1);

    // Preview video modal
    const [previewVideoId, setPreviewVideoId] = useState<string | null>(null);

    // Extracted video ID for live preview in form
    const extractedId = extractYouTubeVideoId(youtubeUrl);

    const fetchTestimonials = async () => {
        try {
            setLoading(true);
            const res: any = await api.get("/admin/testimonials");
            setTestimonials(res.data || []);
        } catch (error: any) {
            console.error("Failed to load testimonials:", error);
            notify.error(error, "Couldn't load testimonials");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTestimonials();
    }, []);

    const handleOpenCreate = () => {
        setEditingItem(null);
        setName("");
        setRole("");
        setCompany("");
        setTradeTag("");
        setRating(5);
        setReview("");
        setYoutubeUrl("");
        setThumbnailUrl("");
        setIsActive(true);
        setOrder(1);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (t: Testimonial) => {
        setEditingItem(t);
        setName(t.name);
        setRole(t.role);
        setCompany(t.company);
        setTradeTag(t.trade_tag || "");
        setRating(t.rating || 5);
        setReview(t.review || "");
        setYoutubeUrl(t.youtube_url);
        setThumbnailUrl(t.thumbnail_url || "");
        setIsActive(t.is_active);
        setOrder(t.order || 1);
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) return notify.error("Enter a name");
        if (!role.trim()) return notify.error("Enter a role");
        if (!company.trim()) return notify.error("Enter a company");
        if (!review.trim()) return notify.error("Enter the review");
        if (review.trim().length > 100) return notify.error("Keep the review to 100 characters");
        if (!extractedId) return notify.error("Paste a YouTube link");

        try {
            setSaving(true);
            const payload = {
                name: name.trim(),
                role: role.trim(),
                company: company.trim(),
                city: "",
                trade_tag: editingItem?.trade_tag || "",
                rating: Number(rating) || 5,
                review: review.trim().slice(0, 100),
                youtube_url: youtubeUrl.trim(),
                thumbnail_url: thumbnailUrl.trim() || undefined,
                is_active: isActive,
                order: editingItem?.order || 1,
            };

            if (editingItem) {
                await api.put(`/admin/testimonials/${editingItem.id}`, payload);
                notify.success("Story updated");
            } else {
                await api.post("/admin/testimonials", payload);
                notify.success("Story published");
            }

            setIsModalOpen(false);
            fetchTestimonials();
        } catch (error: any) {
            notify.error(error, "Couldn't save the story");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string, candidateName: string) => {
        if (!window.confirm(`Are you sure you want to delete the testimonial for ${candidateName}?`)) {
            return;
        }

        try {
            await api.delete(`/admin/testimonials/${id}`);
            notify.success("Story deleted");
            setTestimonials((prev) => prev.filter((t) => t.id !== id));
        } catch (error: any) {
            notify.error(error, "Couldn't delete the story");
        }
    };

    const filtered = testimonials.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.role.toLowerCase().includes(search.toLowerCase()) ||
        t.company.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div>
            <AdminPageHeader
                title="Testimonials"
                description="Video stories shown on the homepage"
                actions={
                    <button type="button" onClick={handleOpenCreate} className={btn.primary}>
                        <PlusIcon size={16} weight="bold" aria-hidden="true" />
                        Add story
                    </button>
                }
            />

            <div className="mb-4">
                <SearchInput value={search} onChange={setSearch} placeholder="Search name, role or company" className="w-full sm:max-w-sm" />
            </div>

            {loading ? (
                <div className="py-20 flex flex-col justify-center items-center space-y-3 bg-km-surface-card rounded-2xl border border-slate-200">
                    <CircleNotchIcon size={32} className="animate-spin text-km-link" />
                    <p className="text-xs text-slate-500 font-medium">Loading candidate stories...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-km-surface-card rounded-2xl border border-dashed border-slate-200 p-12 text-center space-y-3">
                    <VideoCameraIcon size={36} className="text-slate-400 mx-auto" />
                    <h3 className="text-base font-bold text-slate-800">No candidate stories found</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Add candidate video testimonials using the button above to feature them on the homepage.
                    </p>
                </div>
            ) : (
                <div className="bg-km-surface-card rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[780px]">
                            <thead>
                                <tr>
                                    <th className={`${table.th} w-32`}>Profile / Video</th>
                                    <th className={table.th}>Candidate</th>
                                    <th className={table.th}>Role</th>
                                    <th className={table.th}>Company</th>
                                    <th className={table.th}>Status</th>
                                    <th className={`${table.th} text-right`}>Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {filtered.map((item) => {
                                    const thumb = item.thumbnail_url || (item.youtube_video_id ? getYouTubeThumbnail(item.youtube_video_id) : "");
                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">
                                            {/* Profile Pic / Thumbnail at Left End */}
                                            <td className="py-3 px-4">
                                                <div
                                                    onClick={() => setPreviewVideoId(item.youtube_video_id)}
                                                    className="relative w-24 sm:w-28 aspect-video rounded-lg overflow-hidden bg-km-ink cursor-pointer group/thumb shrink-0 border border-slate-200"
                                                    title="Click to preview video"
                                                >
                                                    <img
                                                        src={thumb}
                                                        alt={item.name}
                                                        referrerPolicy="no-referrer"
                                                        className="w-full h-full object-cover transition-transform duration-200"
                                                        onError={(e) => {
                                                            if (item.youtube_video_id) {
                                                                (e.target as HTMLImageElement).src = getYouTubeThumbnail(item.youtube_video_id);
                                                            }
                                                        }}
                                                    />
                                                    <div className="absolute inset-0 bg-black/15 flex items-center justify-center group-hover/thumb:bg-black/25 transition-colors">
                                                        <div className="w-6 h-6 rounded-full bg-km-surface-card text-km-heading flex items-center justify-center shadow-xs transition-transform">
                                                            <PlayIcon weight="bold" size={10} className="fill-[#071A4D] ml-0.5" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Candidate Name & Rating & Review */}
                                            <td className="py-3 px-4">
                                                <div className="font-bold text-sm text-slate-900">
                                                    {item.name}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-amber-500 mt-1">
                                                    <div className="flex items-center gap-0.5">
                                                        {[1, 2, 3, 4, 5].map((s) => (
                                                            <StarIcon weight="fill"
                                                                key={s}
                                                                size={13}
                                                                className={s <= Math.round(item.rating || 5) ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"}
                                                            />
                                                        ))}
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-800">
                                                        {Number(item.rating || 5).toFixed(1)}
                                                    </span>
                                                </div>
                                                {item.review && (
                                                    <p className="text-xs text-slate-600 italic mt-1.5 max-w-sm break-words leading-relaxed font-normal">
                                                        &ldquo;{item.review}&rdquo;
                                                    </p>
                                                )}
                                            </td>

                                            {/* Role */}
                                            <td className="py-3 px-4">
                                                <div className="font-semibold text-xs text-slate-800">
                                                    {item.role}
                                                </div>
                                            </td>

                                            {/* Company (No Location) */}
                                            <td className="py-3 px-4">
                                                <div className="font-semibold text-xs text-slate-800">
                                                    {item.company}
                                                </div>
                                            </td>

                                            {/* Status */}
                                            <td className="py-3 px-4">
                                                {item.is_active ? (
                                                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-2 py-0.5 rounded-md">
                                                        <CheckCircleIcon weight="bold" size={11} /> Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold px-2 py-0.5 rounded-md">
                                                        <XCircleIcon weight="bold" size={11} /> Inactive
                                                    </span>
                                                )}
                                            </td>

                                            {/* Actions at Right End */}
                                            <td className="py-3 px-4 text-right pr-6">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => setPreviewVideoId(item.youtube_video_id)}
                                                        className="p-1.5 text-slate-400 hover:text-km-link hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                                        title="Preview video"
                                                    >
                                                        <EyeIcon weight="bold" size={14} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEdit(item)}
                                                        className="p-1.5 text-slate-400 hover:text-km-link hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                                        title="Edit story"
                                                    >
                                                        <PencilSimpleIcon weight="bold" size={14} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(item.id, item.name)}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                        title="Delete story"
                                                    >
                                                        <TrashIcon weight="bold" size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal: Create / Edit Testimonial */}
            <>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 font-sans">
                        <div
                            className="bg-km-surface-card rounded-2xl max-w-xl w-full p-6 sm:p-7 shadow-sm border border-slate-200 overflow-y-auto max-h-[90vh] space-y-5"
                        >
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                                    {editingItem ? "Edit Candidate Story" : "Add Candidate Verified Story"}
                                </h2>
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                                >
                                    <XIcon weight="bold" size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    {/* Candidate Name */}
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-slate-700">
                                            Candidate Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="e.g. Dharmender Kumar"
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:bg-km-surface-card focus:border-[#0B5ED7] transition-all font-medium"
                                        />
                                    </div>

                                    {/* Role */}
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-slate-700">
                                            Role / Designation <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={role}
                                            onChange={(e) => setRole(e.target.value)}
                                            placeholder="e.g. Warehouse Supervisor"
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:bg-km-surface-card focus:border-[#0B5ED7] transition-all font-medium"
                                        />
                                    </div>

                                    {/* Company */}
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-slate-700">
                                            Hiring Company <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={company}
                                            onChange={(e) => setCompany(e.target.value)}
                                            placeholder="e.g. Technova Logistics"
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:bg-km-surface-card focus:border-[#0B5ED7] transition-all font-medium"
                                        />
                                    </div>

                                    {/* Rating */}
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-slate-700">
                                            Star rating (1 to 5)
                                        </label>
                                        <select
                                            value={rating}
                                            onChange={(e) => setRating(Number(e.target.value))}
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:bg-km-surface-card focus:border-[#0B5ED7] transition-all font-medium cursor-pointer"
                                        >
                                            <option value={5}>5 stars</option>
                                            <option value={4}>4 stars</option>
                                            <option value={3}>3 stars</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Candidate Review (Max 100 characters) */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-slate-700">
                                            Candidate Review / Feedback <span className="text-red-500">*</span>
                                        </label>
                                        <span className={`text-xs font-semibold ${review.length > 100 ?"text-red-500 " : "text-slate-400"}`}>
                                            {review.length}/100
                                        </span>
                                    </div>
                                    <textarea
                                        required
                                        rows={2}
                                        maxLength={100}
                                        value={review}
                                        onChange={(e) => setReview(e.target.value)}
                                        placeholder="e.g. Joined warehouse team within 48 hrs with direct company HR call and zero brokerage."
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:bg-km-surface-card focus:border-[#0B5ED7] transition-all font-medium resize-none"
                                    />
                                    <p className="text-xs text-slate-500">
                                        Short review quote shown untrimmed on the homepage card (max 100 characters).
                                    </p>
                                </div>

                                {/* YouTube URL */}
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-700">
                                        YouTube Video URL / Embed Link <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="url"
                                        required
                                        value={youtubeUrl}
                                        onChange={(e) => setYoutubeUrl(e.target.value)}
                                        placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:bg-km-surface-card focus:border-[#0B5ED7] transition-all font-medium"
                                    />
                                    <p className="text-xs text-slate-500">
                                        Supports standard YouTube watch links, youtu.be, shorts, or embed URLs.
                                    </p>
                                </div>

                                {/* Live Video Preview Box */}
                                {extractedId && (
                                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
                                        <img
                                            src={getYouTubeThumbnail(extractedId)}
                                            alt="Preview"
                                            className="w-20 h-14 object-cover rounded-lg shrink-0 shadow-xs"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                                                <CheckCircleIcon weight="bold" size={13} />
                                                <span>Verified YouTube Video ID: {extractedId}</span>
                                            </div>
                                            <p className="text-xs text-emerald-700 mt-0.5">
                                                Thumbnail & streaming embed ready for web playback.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Custom Thumbnail URL */}
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-700">
                                        Custom thumbnail URL (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={thumbnailUrl}
                                        onChange={(e) => setThumbnailUrl(e.target.value)}
                                        placeholder="Leave blank to use default YouTube thumbnail"
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:bg-km-surface-card focus:border-[#0B5ED7] transition-all font-medium"
                                    />
                                </div>

                                {/* Active Checkbox */}
                                <div className="flex items-center gap-2 pt-2">
                                    <input
                                        type="checkbox"
                                        id="isActiveCheckbox"
                                        checked={isActive}
                                        onChange={(e) => setIsActive(e.target.checked)}
                                        className="w-4 h-4 rounded text-km-link cursor-pointer"
                                    />
                                    <label htmlFor="isActiveCheckbox" className="text-xs font-semibold text-slate-700 cursor-pointer">
                                        Feature on Homepage
                                    </label>
                                </div>

                                {/* Buttons */}
                                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="px-6 py-2.5 text-xs font-bold text-white bg-km-primary hover:bg-km-primary-dark rounded-xl shadow-xs transition-all disabled:opacity-60 cursor-pointer flex items-center gap-1.5"
                                    >
                                        {saving ? (
                                            <>
                                                <CircleNotchIcon weight="bold" size={14} className="animate-spin" />
                                                <span>Saving...</span>
                                            </>
                                        ) : (
                                            <span>{editingItem ? "Update Story" : "Save & Publish"}</span>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </>

            {/* In-App YouTube Video Player Modal (for Admin Preview) */}
            <>
                {previewVideoId && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 font-sans">
                        <div
                            className="relative w-full max-w-3xl bg-black rounded-2xl overflow-hidden shadow-sm border border-[#1E293B]"
                        >
                            <button
                                type="button"
                                onClick={() => setPreviewVideoId(null)}
                                className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center transition-colors cursor-pointer"
                                aria-label="Close"
                            >
                                <XIcon weight="bold" size={18} />
                            </button>
                            <div className="aspect-video w-full">
                                <iframe
                                    src={`https://www.youtube.com/embed/${previewVideoId}?autoplay=1&rel=0`}
                                    title="YouTube video"
                                    className="w-full h-full border-0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />
                            </div>
                        </div>
                    </div>
                )}
            </>
        </div>
    );
}
