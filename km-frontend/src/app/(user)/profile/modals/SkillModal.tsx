'use client';
import { CheckCircleIcon, MagnifyingGlassIcon } from '@phosphor-icons/react';
import { useState, useEffect, useId } from 'react';
import api from '@/lib/axios';
import ModalWrapper from '@/components/ui/ModalWrapper';
import { notify } from "@/lib/notify";

interface SkillModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (updatedUser: unknown) => void;
}

const SkillModal = ({ isOpen, onClose, onSuccess }: SkillModalProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    // Highlighted result for arrow-key picking (-1: none)
    const [active, setActive] = useState(-1);
    const listId = useId();

    useEffect(() => {
        const fetchSkills = async () => {
            if (searchQuery.length < 2) {
                setResults([]);
                setActive(-1);
                return;
            }
            setLoading(true);
            try {
                const response = (await api.get(`/skills?q=${encodeURIComponent(searchQuery.trim())}`)) as unknown as { id: string; name: string }[] | null;
                setResults(response || []);
                setActive(-1);
            } catch (error) {
                console.error("Failed to fetch skills:", error);
                notify.error(error, "Skills couldn’t be searched. Please try again.");
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
            notify.success("Skill added");
        } catch (error) {
            console.error("Failed to add skill:", error);
            notify.error(error, "Could not add this skill. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalWrapper isOpen={isOpen} onClose={onClose} title="Add Skill">
            <div className="space-y-4 relative">
                {saving && (
                    <div className="absolute inset-0 bg-km-surface-card/50 z-20 flex items-center justify-center rounded-xl">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-km-primary"></div>
                    </div>
                )}

                <p className="text-sm text-km-text-secondary">Search for a skill to add to your profile. (Pre-defined skills only)</p>
                <div className="relative">
                    <MagnifyingGlassIcon weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 text-km-text-muted" size={18} />
                    <input
                        type="text"
                        role="combobox"
                        aria-expanded={results.length > 0}
                        aria-controls={listId}
                        aria-autocomplete="list"
                        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
                        aria-label="Search skills"
                        onKeyDown={(e) => {
                            if (!results.length) return;
                            if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setActive((i) => (i + 1) % results.length);
                            } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
                            } else if (e.key === 'Enter' && active >= 0 && !saving) {
                                e.preventDefault();
                                handleSelectSkill(results[active].name);
                            }
                        }}
                        autoFocus
                        placeholder="Ex: React, Go, Project Management..."
                        className="w-full px-10 py-3 border border-km-border rounded-xl focus:ring-2 focus:ring-km-primary/20 focus:border-km-primary outline-none"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div id={listId} role="listbox" aria-label="Skills" className="min-h-50 max-h-75 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {loading && (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-km-primary"></div>
                        </div>
                    )}

                    {!loading && searchQuery.length >= 2 && results.length === 0 && (
                        <div className="text-center py-8 text-km-text-muted text-sm">
                            No skills found matching &ldquo;{searchQuery}&rdquo;
                        </div>
                    )}

                    {!loading && results.map((skill, i) => (
                        <button
                            key={skill.id}
                            id={`${listId}-${i}`}
                            type="button"
                            role="option"
                            aria-selected={i === active}
                            tabIndex={-1}
                            onClick={() => handleSelectSkill(skill.name)}
                            onMouseEnter={() => setActive(i)}
                            disabled={saving}
                            className={`w-full text-left p-3 min-h-11 rounded-xl flex items-center justify-between group transition-colors ${i === active ? 'bg-km-surface' : 'hover:bg-km-surface'}`}
                        >
                            <span className="font-medium text-km-text-primary">{skill.name}</span>
                            <CheckCircleIcon weight="bold" size={16} className={`text-km-heading transition-opacity ${i === active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                        </button>
                    ))}

                    {searchQuery.length < 2 && !loading && (
                        <div className="text-center py-8 text-km-text-muted text-sm">
                            Type at least 2 characters to search
                        </div>
                    )}
                </div>

                <div className="pt-6 border-t border-km-border-subtle flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2 border border-km-border text-km-text-primary rounded-xl font-medium hover:bg-km-surface transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </ModalWrapper>
    );
};

export default SkillModal;
