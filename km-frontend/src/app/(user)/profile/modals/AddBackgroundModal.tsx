import React, { useState, useRef } from 'react';
import ModalWrapper from '@/components/ui/ModalWrapper';
import { Image as ImageIcon } from 'lucide-react';
import api from '@/lib/axios';

interface AddBackgroundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedUser: any) => void;
}

const AddBackgroundModal = ({ isOpen, onClose, onSuccess }: AddBackgroundModalProps) => {
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const uploadResponse: any = await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const newImageUrl = uploadResponse.url;

      const userResponse = await api.patch('/user/profile', { cover_image: newImageUrl });
      onSuccess(userResponse);
      onClose();
    } catch (error) {
      console.error("Failed to upload/update cover photo:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Add Background Photo">
      <div className="flex flex-col items-center justify-center py-8 text-center relative">
        {loading && (
          <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-km-primary"></div>
          </div>
        )}

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleFileChange}
        />

        {/* Illustration Container */}
        <div className="relative w-64 h-48 mb-8" onClick={() => fileInputRef.current?.click()}>
          <div className="absolute inset-0 bg-blue-50 rounded-3xl rotate-6 transform translate-x-4 scale-95 opacity-50" />
          <div className="absolute inset-0 bg-blue-100 rounded-3xl -rotate-3 transform -translate-x-2" />

          <div className="absolute inset-0 flex items-center justify-center bg-white border border-blue-100 rounded-3xl shadow-sm overflow-hidden cursor-pointer hover:border-km-primary transition-all">
            <div className="bg-km-primary p-4 rounded-xl rotate-12 transform scale-125">
              <ImageIcon size={48} className="text-white" />
            </div>
          </div>
        </div>

        {/* Text Content */}
        <div className="max-w-md space-y-4">
          <h3 className="text-2xl font-bold text-gray-900 leading-tight">
            Showcase Your Personality, Interests, Team Moments Or Notable Milestones
          </h3>
          <p className="text-sm text-gray-500">
            A Good Background Photo Will Help You Stand Out.{' '}
            <span className="text-km-primary font-medium cursor-pointer hover:underline">
              Learn More
            </span>
          </p>
        </div>

        {/* Footer Button */}
        <div className="mt-10 w-full flex justify-end pt-6 border-t border-gray-100">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="bg-km-primary hover:bg-km-primary-dark text-white font-semibold py-2.5 px-8 rounded-xl transition-all duration-200 shadow-sm disabled:opacity-50"
          >
            {loading ? 'Uploading...' : 'Edit Profile Background'}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};

export default AddBackgroundModal;