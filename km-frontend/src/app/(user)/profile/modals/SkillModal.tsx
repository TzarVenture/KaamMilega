'use client';
import { Search, CheckCircle2, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '@/lib/axios';
import ModalWrapper from '@/components/ui/ModalWrapper';

interface SkillModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (updatedUser: any) => void;
}

const SkillModal = ({ isOpen, onClose, onSuccess }: SkillModalProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchSkills = async () => {
            if (searchQuery.length < 2) {
                setResults([]);
                return;
            }
            setLoading(true);
            try {
                const response: any = await api.get(`/skills?q=${searchQuery}`);
                setResults(response || []);
            } catch (error) {
                console.error("Failed to fetch skills:", error);
            } finally {
                setLoading(false);
            }
        };

        const timer = setTimeout(fetchSkills, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleSelectSkill = async (skillName: string) => {
        setSaving(true);
        try {
            const response = await api.post('/user/skill', { skill_name: skillName });
            onSuccess(response);
            onClose();
        } catch (error) {
            console.error("Failed to add skill:", error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalWrapper isOpen={isOpen} onClose={onClose} title="Add Skill">
            <div className="space-y-4 relative">
                {saving && (
                    <div className="absolute inset-0 bg-white/50 z-20 flex items-center justify-center rounded-xl">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
                    </div>
                )}

                <p className="text-sm text-gray-500">Search for a skill to add to your profile. (Pre-defined skills only)</p>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        autoFocus
                        placeholder="Ex: React, Go, Project Management..."
                        className="w-full px-10 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="min-h-[200px] max-h-[300px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {loading && (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-600"></div>
                        </div>
                    )}

                    {!loading && searchQuery.length >= 2 && results.length === 0 && (
                        <div className="text-center py-8 text-gray-400 text-sm">
                            No skills found matching "{searchQuery}"
                        </div>
                    )}

                    {!loading && results.map((skill) => (
                        <button
                            key={skill.id}
                            onClick={() => handleSelectSkill(skill.name)}
                            disabled={saving}
                            className="w-full text-left p-3 hover:bg-purple-50 rounded-lg flex items-center justify-between group transition-colors"
                        >
                            <span className="font-medium text-gray-700">{skill.name}</span>
                            <CheckCircle2 size={16} className="text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                    ))}

                    {searchQuery.length < 2 && !loading && (
                        <div className="text-center py-8 text-gray-400 text-sm">
                            Type at least 2 characters to search
                        </div>
                    )}
                </div>

                <div className="pt-6 border-t border-gray-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 border border-gray-300 text-gray-700 rounded-full font-medium hover:bg-gray-50 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </ModalWrapper>
    );
};

export default SkillModal;
