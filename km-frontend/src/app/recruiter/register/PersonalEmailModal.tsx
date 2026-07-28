// components/registration/PersonalEmailModal.tsx
import { X } from "lucide-react";

interface Props {
  isOpen: boolean;
  email: string;
  onClose: () => void;
  onContinue: () => void;
}

export default function PersonalEmailModal({ isOpen, email, onClose, onContinue }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm">
      {/* Side Panel Modal */}
      <div className="h-full w-full max-w-lg bg-white shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col p-8 relative">

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full transition"
        >
          <X className="w-6 h-6 text-gray-500" />
        </button>

        <div className="my-auto text-center space-y-6">
          <header className="space-y-2">
            <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">
              This Looks Like A <br />
              <span className="text-indigo-400">Personal Email ID!</span>
            </h2>
            <p className="text-lg font-bold text-gray-800">
              It Might Delay Your Job Activation
            </p>
          </header>

          <p className="text-gray-400 font-medium">{email}</p>

          <div className="flex items-center justify-center gap-4 pt-4">
            <button
              onClick={onClose}
              className="px-8 py-2 border-2 border-indigo-500 text-indigo-500 font-bold rounded-full hover:bg-indigo-50 transition"
            >
              Edit
            </button>
            <button
              onClick={onContinue}
              className="px-8 py-2 bg-indigo-400 text-white font-bold rounded-full hover:bg-indigo-500 shadow-lg shadow-indigo-200 transition"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}