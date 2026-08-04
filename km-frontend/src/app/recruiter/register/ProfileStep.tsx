// components/registration/ProfileStep.tsx
import { User } from "lucide-react";

interface Props {
    data: any;
    updateData: (data: any) => void;
    onNext: () => void;
    onBack: () => void;
}

export default function ProfileStep({ data, updateData, onNext, onBack }: Props) {
    return (
        <div className="space-y-6">
            <header>
                <p className="text-sm text-gray-500 mb-1">Your Job Details Are Saved</p>
                <h2 className="text-2xl font-bold text-gray-900">Now Create Your Basic Profile</h2>
            </header>

            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-2">Full Name *</label>
                    <div className="relative">
                        <input
                            type="text"
                            className="w-full px-4 py-3.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition text-slate-900 font-bold bg-white placeholder:text-slate-400 text-sm shadow-sm"
                            placeholder="Your First And Last Name"
                            value={data.fullName || ""}
                            onChange={(e) => updateData({ fullName: e.target.value })}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-3">Are You A Consultant? *</label>
                    <div className="flex gap-4">
                        {[true, false].map((val) => (
                            <button
                                key={String(val)}
                                type="button"
                                onClick={() => updateData({ isConsultant: val })}
                                className={`flex-1 py-3 rounded-xl border-2 transition-all font-bold text-sm ${data.isConsultant === val
                                    ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/20"
                                    : "bg-white border-slate-300 text-slate-800 hover:border-indigo-400 hover:bg-slate-50"
                                    }`}
                            >
                                {val ? "Yes" : "No"}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <button
                disabled={!data.fullName || data.isConsultant === null}
                onClick={onNext}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-full transition-all mt-4"
            >
                Next
            </button>
        </div>
    );
}