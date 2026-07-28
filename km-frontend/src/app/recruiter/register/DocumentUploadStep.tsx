// components/registration/DocumentUploadStep.tsx
"use client";

import { ChevronRight, PlusCircle, ShieldCheck, FileText } from "lucide-react";

interface DocumentOption {
    id: string;
    name: string;
    icon: string; // In a real app, use specific image paths or SVG components
}

const DOCUMENT_OPTIONS: DocumentOption[] = [
    { id: "gst", name: "Company GST Certificate", icon: "📄" },
    { id: "pan", name: "Company PAN Card", icon: "💳" },
    { id: "fssai", name: "FSSAI License", icon: "🍴" },
    { id: "incorporation", name: "Company Incorporation Certificate", icon: "📜" },
    { id: "shop", name: "Shop & Establishment Certificate", icon: "🏪" },
    { id: "msme", name: "MSME Registration Certificate", icon: "🏢" },
];

export default function DocumentUploadStep({ onSelect, onVerifyLater }: any) {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header with Verify Later link */}
            <div className="flex justify-end mb-4">
                <button
                    onClick={onVerifyLater}
                    className="text-indigo-500 text-xs font-semibold hover:underline"
                >
                    Verify Later
                </button>
            </div>

            {/* Hero Section */}
            <div className="text-center bg-indigo-50/50 rounded-2xl p-6 mb-8">
                <h2 className="text-xl font-bold text-gray-900 leading-tight">
                    <span className="text-indigo-600">Upload Any 1 Company Document</span> To Verify <br />
                    And Earn A Badge On Your Job
                </h2>

                <div className="relative inline-block mt-6">
                    <div className="bg-indigo-900 w-32 h-20 rounded-xl flex flex-col justify-center px-3 space-y-2 shadow-2xl">
                        <div className="h-1.5 w-full bg-indigo-800 rounded" />
                        <div className="h-1.5 w-2/3 bg-indigo-800 rounded" />
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-0.5">
                        <ShieldCheck className="w-8 h-8 text-blue-500 fill-blue-500 text-white" />
                    </div>
                </div>

                <p className="mt-4 text-[10px] text-gray-500 font-medium">
                    Verified Badge Gets 80% More Candidates!
                </p>
            </div>

            {/* Warning Note */}
            <p className="text-[10px] text-gray-400 mb-4 italic">
                (Note: DO NOT upload your personal documents)
            </p>

            {/* Document List */}
            <div className="border rounded-xl overflow-hidden divide-y divide-gray-100">
                {DOCUMENT_OPTIONS.map((doc) => (
                    <button
                        key={doc.id}
                        onClick={() => onSelect(doc)}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
                    >
                        <div className="flex items-center gap-4">
                            <span className="text-xl">{doc.icon}</span>
                            <span className="text-sm font-semibold text-gray-700 group-hover:text-indigo-600">
                                {doc.name}
                            </span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-transform group-hover:translate-x-1" />
                    </button>
                ))}
            </div>

            {/* View More Button */}
            <button className="w-full flex items-center justify-center gap-2 mt-6 py-2 text-indigo-500 hover:text-indigo-700 transition">
                <PlusCircle className="w-5 h-5" />
                <span className="text-sm font-bold">View More Document Options</span>
            </button>
        </div>
    );
}