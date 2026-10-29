"use client";

import { useRef, useState } from "react";
import { ImageIcon, TrashIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { notify } from "@/lib/notify";
import api from "@/lib/axios";
import { uploadFile, UPLOAD_LIMITS } from "@/lib/upload";

export default function CreateEventPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [imageUploading, setImageUploading] = useState(false);
    const imageInputRef = useRef<HTMLInputElement>(null);
    
    // We let users type in their details
    const [formData, setFormData] = useState({
        title: "",
        organizer: "",
        description: "",
        date: "",
        time: "",
        location: "",
        image_url: "",
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        if (file.size > UPLOAD_LIMITS.event_image) {
            notify.error("This image is over 5 MB. Please choose a smaller one.");
            return;
        }
        setImageUploading(true);
        try {
            const { url } = await uploadFile(file, "event_image");
            setFormData((prev) => ({ ...prev, image_url: url }));
        } catch (error) {
            notify.error(error, "Could not upload the image. Please try again.");
        } finally {
            setImageUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await api.post("/events", formData);
            notify.success("Event created successfully!");
            router.push("/events");
        } catch (error: any) {
            notify.error(error.message || "Failed to create event");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col pt-12 pb-24 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center">
                <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                    Create New Event
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                    Host a networking session, webinar, or community meetup.
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl">
                <div className="bg-km-surface-card py-8 px-4 shadow sm:rounded-2xl sm:px-10 border border-gray-100">
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Event Title</label>
                            <input
                                name="title"
                                type="text"
                                required
                                value={formData.title}
                                onChange={handleChange}
                                placeholder="e.g. Next.js Masterclass"
                                className="appearance-none block w-full px-4 py-2.5 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Organizer Name</label>
                            <input
                                name="organizer"
                                type="text"
                                required
                                value={formData.organizer}
                                onChange={handleChange}
                                placeholder="e.g. John Doe / Tech Corp"
                                className="appearance-none block w-full px-4 py-2.5 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                            <textarea
                                name="description"
                                required
                                rows={4}
                                value={formData.description}
                                onChange={handleChange}
                                placeholder="What is this event about?"
                                className="appearance-none block w-full px-4 py-2.5 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Date</label>
                                <input
                                    name="date"
                                    type="date"
                                    required
                                    value={formData.date}
                                    onChange={handleChange}
                                    className="appearance-none block w-full px-4 py-2.5 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm text-gray-700"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Time</label>
                                <input
                                    name="time"
                                    type="time"
                                    required
                                    value={formData.time}
                                    onChange={handleChange}
                                    className="appearance-none block w-full px-4 py-2.5 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm text-gray-700"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Location</label>
                            <input
                                name="location"
                                type="text"
                                required
                                value={formData.location}
                                onChange={handleChange}
                                placeholder="e.g. Online (Zoom/Meet), or specific office address"
                                className="appearance-none block w-full px-4 py-2.5 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                            />
                        </div>

                        <div>
                            <span className="block text-sm font-semibold text-gray-700 mb-1">Banner Image (Optional)</span>
                            <input
                                ref={imageInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={handleImageChange}
                                className="hidden"
                            />
                            {formData.image_url ? (
                                <div className="relative overflow-hidden rounded-xl border border-gray-200">
                                    <img src={formData.image_url} alt="Event banner" className="w-full aspect-[16/7] object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => setFormData((prev) => ({ ...prev, image_url: "" }))}
                                        className="absolute top-2 right-2 inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
                                    >
                                        <TrashIcon size={14} weight="bold" aria-hidden="true" />
                                        Remove
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => imageInputRef.current?.click()}
                                    disabled={imageUploading}
                                    className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-300 px-4 py-6 text-center hover:border-purple-400 disabled:opacity-60 transition-colors"
                                >
                                    <ImageIcon size={28} className="text-purple-500" aria-hidden="true" />
                                    <span className="text-sm font-semibold text-gray-700">
                                        {imageUploading ? "Uploading…" : "Upload a banner image"}
                                    </span>
                                    <span className="text-xs text-gray-500">JPG, PNG or WebP, up to 5 MB. Wide images look best.</span>
                                </button>
                            )}
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={loading || imageUploading}
                                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 transition-colors"
                            >
                                {loading ? "Creating Event..." : "Create Event"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
