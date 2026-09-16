'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/axios';
import ModalWrapper from '@/components/ui/ModalWrapper';

interface ProjectModalProps {
    isOpen: boolean;
    projectToEdit?: any | null;
    onClose: () => void;
    onSuccess: (updatedUser: any) => void;
}

const MONTHS = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 45 }, (_, i) => String(currentYear - i));

// Helper to parse date strings into month and year components
function parseDate(dateStr: string) {
    if (!dateStr || dateStr.toLowerCase() === 'present') {
        return { month: '', year: '' };
    }
    // Format: YYYY-MM
    if (/^\d{4}-\d{2}/.test(dateStr)) {
        const [y, m] = dateStr.split('-');
        return { month: m, year: y };
    }
    // Format: "Sep 2026" or "September 2026"
    const parts = dateStr.trim().split(/\s+/);
    if (parts.length === 2) {
        const mStr = parts[0].toLowerCase();
        const yStr = parts[1];
        const monthMatch = MONTHS.find(
            (m) => m.label.toLowerCase().startsWith(mStr) || m.value === mStr
        );
        return { month: monthMatch ? monthMatch.value : '', year: yStr };
    }
    return { month: '', year: '' };
}

function formatDate(month: string, year: string): string {
    if (!month && !year) return '';
    if (!month) return year;
    const m = MONTHS.find((item) => item.value === month);
    return m ? `${m.label.slice(0, 3)} ${year}` : `${year}`;
}

const ProjectModal = ({ isOpen, projectToEdit, onClose, onSuccess }: ProjectModalProps) => {
    const isEditMode = Boolean(projectToEdit);

    const [title, setTitle] = useState('');
    const [associatedWith, setAssociatedWith] = useState('');
    const [startMonth, setStartMonth] = useState('');
    const [startYear, setStartYear] = useState('');
    const [endMonth, setEndMonth] = useState('');
    const [endYear, setEndYear] = useState('');
    const [isCurrent, setIsCurrent] = useState(false);
    const [projectUrl, setProjectUrl] = useState('');
    const [description, setDescription] = useState('');
    const [skills, setSkills] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initialize or reset form when modal opens or projectToEdit changes
    useEffect(() => {
        if (!isOpen) return;

        if (projectToEdit) {
            setTitle(projectToEdit.title || '');
            setAssociatedWith(projectToEdit.associated_with || '');
            const start = parseDate(projectToEdit.start_date || '');
            setStartMonth(start.month);
            setStartYear(start.year);

            const isOngoing = Boolean(
                projectToEdit.is_current ||
                (projectToEdit.end_date && projectToEdit.end_date.toLowerCase() === 'present')
            );
            setIsCurrent(isOngoing);

            if (isOngoing) {
                setEndMonth('');
                setEndYear('');
            } else {
                const end = parseDate(projectToEdit.end_date || '');
                setEndMonth(end.month);
                setEndYear(end.year);
            }

            setProjectUrl(projectToEdit.project_url || '');
            setDescription(projectToEdit.description || '');
            setSkills(
                Array.isArray(projectToEdit.skills)
                    ? projectToEdit.skills.join(', ')
                    : projectToEdit.skills || ''
            );
        } else {
            // Reset for new project
            setTitle('');
            setAssociatedWith('');
            setStartMonth('');
            setStartYear('');
            setEndMonth('');
            setEndYear('');
            setIsCurrent(false);
            setProjectUrl('');
            setDescription('');
            setSkills('');
        }
        setError(null);
    }, [isOpen, projectToEdit]);

    const handleToggleCurrent = (checked: boolean) => {
        setIsCurrent(checked);
        if (checked) {
            // Clear end month/year when ongoing
            setEndMonth('');
            setEndYear('');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!title.trim()) {
            setError('Please enter a project title');
            return;
        }

        setLoading(true);

        const startDateFormatted = formatDate(startMonth, startYear);
        const endDateFormatted = isCurrent ? 'Present' : formatDate(endMonth, endYear);

        const payload = {
            title: title.trim(),
            associated_with: associatedWith.trim(),
            start_date: startDateFormatted,
            end_date: isCurrent ? '' : endDateFormatted,
            is_current: isCurrent,
            project_url: projectUrl.trim(),
            description: description.trim(),
            skills: skills
                ? skills
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                : []
        };

        try {
            let response;
            if (isEditMode && projectToEdit?.id) {
                response = await api.put(`/user/project/${projectToEdit.id}`, payload);
            } else {
                response = await api.post('/user/project', payload);
            }

            onSuccess(response);
            onClose();
        } catch (err: any) {
            console.error('Failed to save project:', err);
            setError(
                err.response?.data?.error ||
                err.message ||
                'Failed to save project. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModalWrapper
            isOpen={isOpen}
            onClose={onClose}
            title={isEditMode ? 'Edit Project' : 'Add Project'}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-semibold">
                        {error}
                    </div>
                )}

                {/* Project Title */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Project / Work Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        required
                        placeholder="Ex: KaamMilega Mobile App, Modular Kitchen Woodwork, Brand Campaign"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm text-gray-800"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                </div>

                {/* Associated With */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Associated With (Optional)
                    </label>
                    <input
                        type="text"
                        placeholder="Ex: Freelance, TCS, Self-employed, or Client Name"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm text-gray-800"
                        value={associatedWith}
                        onChange={(e) => setAssociatedWith(e.target.value)}
                    />
                </div>

                {/* Standard Date Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Start Date */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                            Start Date
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <select
                                value={startMonth}
                                onChange={(e) => setStartMonth(e.target.value)}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-xs sm:text-sm text-gray-800 bg-white"
                            >
                                <option value="">Month</option>
                                {MONTHS.map((m) => (
                                    <option key={m.value} value={m.value}>
                                        {m.label}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={startYear}
                                onChange={(e) => setStartYear(e.target.value)}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-xs sm:text-sm text-gray-800 bg-white"
                            >
                                <option value="">Year</option>
                                {YEARS.map((y) => (
                                    <option key={y} value={y}>
                                        {y}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* End Date */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                            End Date
                        </label>
                        {isCurrent ? (
                            <div className="w-full px-3.5 py-2.5 bg-purple-50 border border-purple-200 rounded-xl text-purple-700 font-bold text-xs sm:text-sm flex items-center justify-between">
                                <span>Present</span>
                                <span className="text-[10px] bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full font-semibold">
                                    Ongoing
                                </span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                <select
                                    value={endMonth}
                                    onChange={(e) => setEndMonth(e.target.value)}
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-xs sm:text-sm text-gray-800 bg-white"
                                >
                                    <option value="">Month</option>
                                    {MONTHS.map((m) => (
                                        <option key={m.value} value={m.value}>
                                            {m.label}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={endYear}
                                    onChange={(e) => setEndYear(e.target.value)}
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-xs sm:text-sm text-gray-800 bg-white"
                                >
                                    <option value="">Year</option>
                                    {YEARS.map((y) => (
                                        <option key={y} value={y}>
                                            {y}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* Currently Working Toggle */}
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-gray-700 pt-0.5">
                    <input
                        type="checkbox"
                        checked={isCurrent}
                        onChange={(e) => handleToggleCurrent(e.target.checked)}
                        className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-gray-300 cursor-pointer"
                    />
                    <span>I am currently working on this project</span>
                </label>

                {/* Project URL */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Project URL (Optional)
                    </label>
                    <input
                        type="url"
                        placeholder="https://example.com, GitHub, Google Drive, or Demo link"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm text-gray-800"
                        value={projectUrl}
                        onChange={(e) => setProjectUrl(e.target.value)}
                    />
                </div>

                {/* Description */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Description
                    </label>
                    <textarea
                        rows={3}
                        placeholder="Describe your role, responsibilities, tools used, or client results..."
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm text-gray-800"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                </div>

                {/* Skills Tags */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Skills Used (Comma separated, optional)
                    </label>
                    <input
                        type="text"
                        placeholder="Ex: React, Go, MongoDB, Carpentry, Customer Handling"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm text-gray-800"
                        value={skills}
                        onChange={(e) => setSkills(e.target.value)}
                    />
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 border border-gray-300 text-gray-700 rounded-full text-sm font-semibold hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading || !title.trim()}
                        className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white rounded-full text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer"
                    >
                        {loading
                            ? 'Saving...'
                            : isEditMode
                            ? 'Update Project'
                            : 'Save Project'}
                    </button>
                </div>
            </form>
        </ModalWrapper>
    );
};

export default ProjectModal;
