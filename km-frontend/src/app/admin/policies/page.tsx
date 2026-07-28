'use client';

import React, { useState } from 'react';
import { Search, Plus, Edit } from 'lucide-react';
import { motion } from 'framer-motion';
import PolicyModal from '@/components/modals/admin/PolicyModal';

const initialPolicies = [
    {
        id: '1',
        title: 'Lorem Ipsum Dolor Sit Amet Consectetur.',
        content: 'Lorem ipsum dolor sit amet consectetur. Dui ac erat sed consectetur. Elit elit sed convallis diam arcu massa facilisis arcu felis rhoncus. Gravida sed loren in risus. Dui egestas morbi lectus ipsum interdum id. Varius dignissim consequat eros felis facilisis feugiat blandit convallis diam arcu massa facilisis arcu felis rhoncus. Hendrerit varius libero hendrerit nisi id. Lorem ipsum dolor sit amet consectetur. Elit elit sed convallis diam arcu massa facilisis arcu felis rhoncus. Hendrerit varius libero hendrerit nisi id.'
    },
    {
        id: '2',
        title: 'Lorem Ipsum Dolor Sit Amet Consectetur.',
        content: 'Lorem ipsum dolor sit amet consectetur. Dui ac erat sed consectetur. Elit elit sed convallis diam arcu massa facilisis arcu felis rhoncus. Gravida sed loren in risus. Dui egestas morbi lectus ipsum interdum id. Varius dignissim consequat eros felis facilisis feugiat blandit convallis diam arcu massa facilisis arcu felis rhoncus.'
    },
    {
        id: '3',
        title: 'Lorem Ipsum Dolor Sit Amet Consectetur.',
        content: 'Lorem ipsum dolor sit amet consectetur. Dui ac erat sed consectetur. Elit elit sed convallis diam arcu massa facilisis arcu felis rhoncus. Gravida sed loren in risus. Dui egestas morbi lectus ipsum interdum id. Varius dignissim.'
    }
];

export default function PoliciesPage() {
    const [policies, setPolicies] = useState(initialPolicies);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    const [selectedPolicy, setSelectedPolicy] = useState<any>(null);

    const handleAddPolicy = () => {
        setModalMode('add');
        setSelectedPolicy(null);
        setIsModalOpen(true);
    };

    const handleEditPolicy = (policy?: any) => {
        setModalMode('edit');
        setSelectedPolicy(policy || policies[0]); // Default to first for global edit button
        setIsModalOpen(true);
    };

    const handleSavePolicy = (data: any) => {
        if (modalMode === 'add') {
            const newPolicy = {
                id: (policies.length + 1).toString(),
                ...data
            };
            setPolicies([...policies, newPolicy]);
        } else {
            setPolicies(policies.map(p => p.id === selectedPolicy.id ? { ...p, ...data } : p));
        }
        setIsModalOpen(false);
    };

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <PolicyModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                mode={modalMode}
                policyData={selectedPolicy}
                onSave={handleSavePolicy}
            />

            {/* Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-purple-100 pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Policies</h1>
                    <p className="text-slate-500 mt-1 font-medium">Manage platform terms, conditions and privacy rules</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-600 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Find Policy..."
                            className="w-full sm:w-64 pl-11 pr-4 py-2.5 bg-white border border-purple-100 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-purple-500/5 focus:border-purple-300 transition-all shadow-sm"
                        />
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleAddPolicy}
                        className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-2xl text-sm font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-200"
                    >
                        <Plus size={18} />
                        <span>Add Policies</span>
                    </motion.button>
                </div>
            </div>

            {/* Policies Content */}
            <div className="bg-white rounded-3xl p-8 border border-purple-50 shadow-sm relative">
                <div className="space-y-10">
                    {policies.map((policy, index) => (
                        <div key={policy.id} className="relative group">
                            <div className="flex items-start gap-4">
                                <span className="text-xl font-bold text-gray-800 shrink-0">{index + 1}.</span>
                                <div className="space-y-3">
                                    <h3 className="text-xl font-bold text-gray-800 leading-snug">
                                        {policy.title}
                                    </h3>
                                    <p className="text-gray-600 leading-relaxed text-base">
                                        {policy.content}
                                    </p>
                                </div>
                            </div>

                            {/* Individual edit button appears on hover */}
                            <button
                                onClick={() => handleEditPolicy(policy)}
                                className="absolute -right-2 -top-2 p-2 bg-white border border-purple-100 rounded-xl text-purple-600 opacity-0 group-hover:opacity-100 transition-all shadow-sm hover:bg-purple-50 scale-90"
                            >
                                <Edit size={16} />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Footer Edit Button as per mockup */}
                <div className="mt-12">
                    <button
                        onClick={() => handleEditPolicy()}
                        className="px-6 py-2 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition-all shadow-md active:scale-95"
                    >
                        Edit Policies
                    </button>
                </div>
            </div>
        </div>
    );
}
