import React, { useState, useRef } from 'react';
import { Button } from '../ui';
import { Camera, Trash2, Upload, Loader2 } from 'lucide-react';
import apiService from '../../services/api';

interface PhotoUploadProps {
  profilePhoto?: string;
  photos?: string[];
  onPhotoChange?: (photoUrl: string) => void;
  onPhotosChange?: (photos: string[]) => void;
  isEditing: boolean;
}

const PhotoUpload: React.FC<PhotoUploadProps> = ({
  profilePhoto,
  photos,
  onPhotoChange,
  onPhotosChange,
  isEditing
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    uploadPhoto(file);
  };

  const uploadPhoto = async (file: File) => {
    try {
      setUploading(true);
      setError(null);
      setImageError(false);

      console.log('📸 Uploading photo:', file.name, file.size, 'bytes', file.type);

      const response = await apiService.uploadProfilePhoto(file);

      if (response.photoUrl) {
        // Validate URL format before setting
        if (response.photoUrl.startsWith('http') || response.photoUrl.startsWith('data:')) {
          if (onPhotoChange) {
            onPhotoChange(response.photoUrl);
          }
          if (onPhotosChange && photos) {
            onPhotosChange([response.photoUrl, ...photos.slice(1)]);
          }
          setPreview(null);
          setImageError(false);
        } else {
          throw new Error('Invalid photo URL format returned from server');
        }
      } else {
        throw new Error('No photo URL returned from server');
      }
    } catch (error: any) {
      console.error('Photo upload error:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Error message:', error.message);
      
      let errorMessage = 'Failed to upload photo. Please try again.';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.status === 413) {
        errorMessage = 'File too large. Please select a smaller image (max 5MB).';
      } else if (error.response?.status === 415) {
        errorMessage = 'Invalid file type. Please select a valid image file.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Please log in to upload photos.';
      } else if (error.response?.status >= 500) {
        errorMessage = 'Server error. Please try again later.';
      }
      
      setError(errorMessage);
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = () => {
    if (onPhotoChange) {
      onPhotoChange('');
    }
    if (onPhotosChange && photos) {
      onPhotosChange(photos.slice(1));
    }
    setPreview(null);
    setError(null);
    setImageError(false);
  };

  const handleImageError = () => {
    console.error('Failed to load image:', displayPhoto);
    setImageError(true);
    setError('Failed to load image. Please try uploading again.');
  };

  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  const displayPhoto = preview || profilePhoto || (photos && photos.length > 0 ? photos[0] : null);

  return (
    <div className="text-center">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <div
        className={`w-30 h-30 mx-auto mb-4 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden ${
          isEditing ? 'cursor-pointer hover:opacity-80 hover:scale-105 transition-all duration-200' : ''
        }`}
        onClick={isEditing ? handleCameraClick : undefined}
      >
        {displayPhoto && !imageError ? (
          <img
            src={displayPhoto}
            alt="Profile"
            className="w-full h-full object-cover"
            onError={handleImageError}
          />
        ) : (
          <Camera className="w-12 h-12 text-gray-400" />
        )}
      </div>

      {isEditing && (
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            onClick={handleCameraClick}
            disabled={uploading}
            size="sm"
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Change Photo
              </>
            )}
          </Button>
          
          {displayPhoto && (
            <Button
              variant="outline"
              onClick={handleRemovePhoto}
              disabled={uploading}
              size="sm"
              className="w-full text-red-600 border-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Remove Photo
            </Button>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded relative" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {uploading && (
        <div className="flex items-center justify-center mt-4">
          <Loader2 className="w-5 h-5 animate-spin text-custom-primary mr-2" />
          <p className="text-sm text-custom-text-secondary">
            Uploading photo...
          </p>
        </div>
      )}
    </div>
  );
};

export default PhotoUpload;
