// components/Pagination.tsx
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    current: number;
    total: number;
    onPageChange: (page: number) => void;
}

const Pagination = ({ current, total, onPageChange }: PaginationProps) => {
    return (
        <div className="flex items-center gap-2">
            <button
                disabled={current === 1}
                className="p-2 text-slate-400 hover:text-km-primary disabled:opacity-30 transition-colors"
                onClick={() => onPageChange(current - 1)}
            >
                <ChevronLeft size={20} />
            </button>

            {[1, 2, 3, '...', total].map((item, index) => (
                <button
                    key={index}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                        item === current
                            ? 'bg-km-primary text-white shadow-md shadow-blue-900/10'
                            : 'text-slate-500 border border-slate-200 hover:border-km-primary hover:text-km-primary bg-white'
                    } ${typeof item !== 'number' ? 'cursor-default pointer-events-none border-0 bg-transparent' : ''}`}
                    onClick={() => typeof item === 'number' && onPageChange(item)}
                >
                    {item}
                </button>
            ))}

            <button
                disabled={current === total}
                className="p-2 text-slate-400 hover:text-km-primary disabled:opacity-30 transition-colors"
                onClick={() => onPageChange(current + 1)}
            >
                <ChevronRight size={20} />
            </button>
        </div>
    );
};

export default Pagination;