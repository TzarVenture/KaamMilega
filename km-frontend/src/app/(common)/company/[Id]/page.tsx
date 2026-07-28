'use client';
import { useCompany } from "./CompanyContext";

export default function CompanyDetailPage() {
    const { company } = useCompany();

    if (!company) return null;

    return (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Overview</h2>
            <hr className="mb-6 border-gray-100" />

            <p className="text-gray-500 text-sm leading-relaxed mb-8">
                {company.description || "No description provided."}
            </p>

            <div className="space-y-6">
                <div>
                    <h4 className="text-sm font-bold text-gray-900">Website</h4>
                    <a
                        href={company.website ? (company.website.startsWith('http') ? company.website : `https://${company.website}`) : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 text-sm hover:underline"
                    >
                        {company.website || "N/A"}
                    </a>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <h4 className="text-sm font-bold text-gray-900">Industry</h4>
                        <p className="text-gray-500 text-sm">{company.industry || "N/A"}</p>
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-gray-900">Company Size</h4>
                        <p className="text-gray-500 text-sm">{company.size || "N/A"}</p>
                    </div>
                </div>

                <div>
                    <h4 className="text-sm font-bold text-gray-900">Specialties</h4>
                    <p className="text-gray-500 text-sm">{company.specialties || "N/A"}</p>
                </div>
            </div>
        </section>
    );
}