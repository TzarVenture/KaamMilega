"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import api from "@/lib/axios";

export default function ApplyExpertPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        expert_category: "",
        expert_bio: "",
        expert_pricing: 0,
        expert_documents: [{ name: "Resume", url: "" }, { name: "Identity Proof", url: "" }],
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleDocumentChange = (index: number, url: string) => {
        const docs = [...formData.expert_documents];
        docs[index].url = url;
        setFormData({ ...formData, expert_documents: docs });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post("/user/apply-expert", {
                ...formData,
                expert_pricing: Number(formData.expert_pricing),
            });
            toast.success("Application submitted successfully. Waiting for admin approval.");
            router.push("/profile");
        } catch (error: any) {
            toast.error(error.message || "Failed to submit application");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                    Apply to be an Expert
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Share your knowledge, mentor others, and sell courses.
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Category</label>
                            <div className="mt-1">
                                <select
                                    name="expert_category"
                                    required
                                    value={formData.expert_category}
                                    onChange={handleChange}
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                >
                                    <option value="">Select a category</option>
                                    <option value="software_engineering">Software Engineering</option>
                                    <option value="design">Design</option>
                                    <option value="marketing">Marketing</option>
                                    <option value="business">Business</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Bio</label>
                            <div className="mt-1">
                                <textarea
                                    name="expert_bio"
                                    required
                                    rows={4}
                                    value={formData.expert_bio}
                                    onChange={handleChange}
                                    placeholder="Tell us about your expertise..."
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Hourly Mentorship Rate (₹)</label>
                            <div className="mt-1">
                                <input
                                    name="expert_pricing"
                                    type="number"
                                    required
                                    min="0"
                                    value={formData.expert_pricing}
                                    onChange={handleChange}
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-gray-700">Documents (Provide URLs for now)</label>
                            {formData.expert_documents.map((doc, index) => (
                                <div key={index} className="flex flex-col">
                                    <span className="text-xs text-gray-500 mb-1">{doc.name}</span>
                                    <input
                                        type="url"
                                        required
                                        placeholder={`Link to your ${doc.name}`}
                                        value={doc.url}
                                        onChange={(e) => handleDocumentChange(index, e.target.value)}
                                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    />
                                </div>
                            ))}
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                            >
                                {loading ? "Submitting..." : "Apply"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
