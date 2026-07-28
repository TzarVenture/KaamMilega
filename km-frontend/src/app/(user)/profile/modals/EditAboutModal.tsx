import React, { useState, useEffect } from 'react';
import ModalWrapper from '@/components/ui/ModalWrapper';
import api from '@/lib/axios';

interface EditAboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onSuccess: (updatedUser: any) => void;
}

const EditAboutModal = ({ isOpen, onClose, user, onSuccess }: EditAboutModalProps) => {
  const [aboutText, setAboutText] = useState("");
  const [loading, setLoading] = useState(false);
  const CHARACTER_LIMIT = 2600;

  useEffect(() => {
    if (user && isOpen) {
      setAboutText(user.about || "");
    }
  }, [user, isOpen]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await api.patch('/user/profile', { about: aboutText });
      onSuccess(response);
      onClose();
    } catch (error) {
      console.error("Failed to update about section:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Edit About">
      <div className="space-y-6">
        {/* Description Section */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-gray-800 leading-snug">
            You Can Write About Your Years Of Experience, Industry, Or Skills. People Also Talk About Their Achievements Or Previous Job Experiences.
          </p>

          <div className="relative">
            <textarea
              className="w-full min-h-[180px] p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none text-gray-600 text-sm"
              placeholder="Write your about section here..."
              value={aboutText}
              onChange={(e) => setAboutText(e.target.value)}
              maxLength={CHARACTER_LIMIT}
            />
            <div className="text-right text-xs text-gray-500 mt-1">
              {aboutText.length}/{CHARACTER_LIMIT}
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-6 border-t border-gray-100">
          <button
            onClick={handleSave}
            disabled={loading}
            className="bg-[#A67DB0] hover:bg-[#9669A0] text-white font-semibold py-2 px-8 rounded-full transition-all shadow-sm disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};

export default EditAboutModal;