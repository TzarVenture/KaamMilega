'use client'
import React, { ReactNode } from 'react';
import { XIcon } from '@phosphor-icons/react';

interface ModalWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'md' | 'lg' | 'xl' | 'full';
}

const ModalWrapper = ({ isOpen, onClose, title, children, size = 'md' }: ModalWrapperProps) => {
  if (!isOpen) return null;

  const sizeClasses = {
    md: 'max-w-[560px]',
    lg: 'max-w-2xl',
    xl: 'max-w-5xl',
    full: 'max-w-[95vw]'
  };

  return (

    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2.5 sm:p-4">
      <div className={`w-full ${sizeClasses[size]} bg-km-surface-card rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-slate-800">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate pr-2">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer shrink-0"
          >
            <XIcon size={20} className="text-gray-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="max-h-[85vh] overflow-y-auto p-4 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default ModalWrapper;