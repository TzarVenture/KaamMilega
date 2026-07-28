import React, { useState, useRef } from 'react';
import ModalWrapper from '@/components/ui/ModalWrapper';
import { Pencil, Camera, Trash2 } from 'lucide-react';
import api from '@/lib/axios';
import CustomImage from '@/components/ui/CustomImage';

interface ProfilePhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string;
  onSuccess: (updatedUser: any) => void;
}

const ProfilePhotoModal = ({ isOpen, onClose, imageUrl, onSuccess }: ProfilePhotoModalProps) => {
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      // 1. Upload the file
      const uploadResponse: any = await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const newImageUrl = uploadResponse.url;

      // 2. Update user profile
      const userResponse = await api.patch('/user/profile', { profile_image: newImageUrl });
      onSuccess(userResponse);
      onClose();
    } catch (error) {
      console.error("Failed to upload/update profile photo:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete your profile photo?")) return;
    setLoading(true);
    try {
      const response = await api.patch('/user/profile', { profile_image: "" });
      onSuccess(response);
      onClose();
    } catch (error) {
      console.error("Failed to delete profile photo:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Profile Photo">
      <div className="flex flex-col items-center justify-center py-4 relative">
        {loading && (
          <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center rounded-full">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
          </div>
        )}

        {/* Profile Image Container */}
        <div className="relative w-80 h-80 md:w-96 md:h-96 rounded-full overflow-hidden bg-[#1D0A1C] flex items-center justify-center shadow-inner">
          {imageUrl ? (
            <CustomImage
              src={imageUrl}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            /* Placeholder Logo from your image */
            <div className="relative flex items-center justify-center">
              <div className="w-32 h-32 bg-gradient-to-br from-purple-400 to-purple-700 clip-path-triangle transform rotate-12 absolute -translate-x-4" />
              <div className="w-24 h-24 bg-gradient-to-br from-purple-300 to-purple-500 clip-path-triangle translate-x-6 translate-y-4" />
            </div>
          )}
        </div>

        {/* Action Toolbar */}
        <div className="w-full mt-12 flex items-center justify-between px-2">
          <div className="flex gap-4">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />
            {/* Edit Button - Trigger same file pick for now */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-3 border border-purple-300 rounded-full text-purple-700 hover:bg-purple-50 transition-colors group"
            >
              <Pencil size={20} className="group-hover:scale-110 transition-transform" />
            </button>

            {/* Camera Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-3 border border-purple-300 rounded-full text-purple-700 hover:bg-purple-50 transition-colors group"
            >
              <Camera size={20} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>

          {/* Delete Button */}
          <button
            onClick={handleDelete}
            className="p-3 bg-purple-200 text-purple-800 rounded-lg hover:bg-red-100 hover:text-red-600 transition-all group"
          >
            <Trash2 size={20} className="group-hover:shake" />
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};

export default ProfilePhotoModal;