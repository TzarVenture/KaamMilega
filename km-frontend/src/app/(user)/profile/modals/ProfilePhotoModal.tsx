import React, { useState, useRef } from 'react';
import ModalWrapper from '@/components/ui/ModalWrapper';
import { CameraIcon, TrashIcon } from '@phosphor-icons/react';
import api from '@/lib/axios';
import CustomImage from '@/components/ui/CustomImage';
import ImageCropper from '@/components/ui/ImageCropper';
import { notify } from "@/lib/notify";
import { uploadFile, UPLOAD_LIMITS } from '@/lib/upload';

interface ProfilePhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string;
  onSuccess: (updatedUser: any) => void;
}

/** Larger files are refused before cropping, since the browser has to decode them */
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

const ProfilePhotoModal = ({ isOpen, onClose, imageUrl, onSuccess }: ProfilePhotoModalProps) => {
  const [loading, setLoading] = useState(false);
  // The photo being cropped, before it is uploaded
  const [picked, setPicked] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const close = () => {
    if (loading) return;
    setPicked(null);
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      notify.error("Please choose a JPG, PNG or WebP photo.");
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      notify.error("This photo is over 15 MB. Please choose a smaller one.");
      return;
    }
    setPicked(file);
  };

  const saveCropped = async (cropped: File) => {
    if (cropped.size > UPLOAD_LIMITS.avatar) {
      notify.error("This photo is still too large. Please choose a smaller one.");
      return;
    }
    setLoading(true);
    try {
      const { url: newImageUrl } = await uploadFile(cropped, 'avatar');
      const userResponse = await api.patch('/user/profile', { profile_image: newImageUrl });
      onSuccess(userResponse);
      setPicked(null);
      onClose();
      notify.success("Profile photo updated");
    } catch (error) {
      notify.error(error, "Could not update your profile photo. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Remove your profile photo?")) return;
    setLoading(true);
    try {
      const response = await api.patch('/user/profile', { profile_image: "" });
      onSuccess(response);
      onClose();
      notify.success("Profile photo removed");
    } catch (error) {
      notify.error(error, "Could not remove your profile photo. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={close} title={picked ? "Crop your photo" : "Profile photo"}>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
      />

      {picked ? (
        <div className="py-2">
          <p className="mb-4 text-sm text-km-text-secondary text-center">Drag to move the photo and use the slider to zoom.</p>
          <ImageCropper file={picked} busy={loading} onCancel={() => setPicked(null)} onCrop={saveCropped} />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-4 relative">
          {loading && (
            <div className="absolute inset-0 bg-km-surface-card/50 z-10 flex items-center justify-center rounded-full">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-km-primary"></div>
            </div>
          )}

          <div className="relative w-72 h-72 md:w-80 md:h-80 rounded-full overflow-hidden bg-[#071A4D] flex items-center justify-center shadow-inner">
            {imageUrl ? (
              <CustomImage src={imageUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <CameraIcon size={64} className="text-white/60" aria-hidden="true" />
            )}
          </div>

          <div className="w-full mt-10 flex items-center justify-between gap-3 px-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary h-10 px-4 text-sm"
            >
              <CameraIcon size={18} aria-hidden="true" />
              {imageUrl ? "Change photo" : "Add photo"}
            </button>

            {imageUrl && (
              <button
                type="button"
                onClick={handleDelete}
                aria-label="Remove photo"
                className="p-3 bg-km-surface text-km-text-secondary rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors dark:hover:bg-red-950/40 dark:hover:text-red-400"
              >
                <TrashIcon size={20} />
              </button>
            )}
          </div>
        </div>
      )}
    </ModalWrapper>
  );
};

export default ProfilePhotoModal;
