"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "@/lib/axios";
import { Check, X } from "lucide-react";

export default function ExpertRequestsPage() {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const res = await api.get("/admin/expert-requests");
            setRequests((res as any) || []);
        } catch (error: any) {
            toast.error(error.message || "Failed to fetch expert requests");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleAction = async (id: string, status: string) => {
        try {
            await api.put(`/admin/experts/${id}/approve`, { status });
            toast.success(`Request ${status} successfully`);
            fetchRequests();
        } catch (error: any) {
            toast.error(error.message || `Failed to ${status} request`);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading requests...</div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Expert Requests</h1>
            {requests.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-500">
                    No pending expert requests.
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pricing</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Documents</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {requests.map((req) => (
                                <tr key={req.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-gray-900">{req.name || req.mobile}</span>
                                            <span className="text-xs text-gray-500">{req.email}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {req.expert_category}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        ₹{req.expert_pricing}/hr
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        <div className="flex flex-col gap-1">
                                            {req.expert_documents?.map((doc: any, i: number) => (
                                                <a key={i} href={doc.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                                                    {doc.name}
                                                </a>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => handleAction(req.id, "approved")}
                                            className="text-green-600 hover:text-green-900 mr-4 focus:outline-none"
                                            title="Approve"
                                        >
                                            <Check className="w-5 h-5 inline-block" />
                                        </button>
                                        <button
                                            onClick={() => handleAction(req.id, "rejected")}
                                            className="text-red-600 hover:text-red-900 focus:outline-none"
                                            title="Reject"
                                        >
                                            <X className="w-5 h-5 inline-block" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
