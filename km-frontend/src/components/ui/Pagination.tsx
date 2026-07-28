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
                className="p-2 text-gray-400 hover:text-purple-600 disabled:opacity-30"
                onClick={() => onPageChange(current - 1)}
            >
                <ChevronLeft size={20} />
            </button>

            {[1, 2, 3, '...', total].map((item, index) => (
                <button
                    key={index}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all
            ${item === current
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'text-gray-500 hover:bg-purple-50 hover:text-purple-600'
                        }
            ${typeof item !== 'number' ? 'cursor-default pointer-events-none' : ''}
          `}
                    onClick={() => typeof item === 'number' && onPageChange(item)}
                >
                    {item}
                </button>
            ))}

            <button
                disabled={current === total}
                className="p-2 text-gray-400 hover:text-purple-600 disabled:opacity-30"
                onClick={() => onPageChange(current + 1)}
            >
                <ChevronRight size={20} />
            </button>
        </div>
    );
};

export default Pagination;