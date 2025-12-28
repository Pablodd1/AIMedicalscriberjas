import { v2 as cloudinary } from 'cloudinary';
import { log, logError } from './logger';

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
  upload_timeout: 1800000 // 30 minutes timeout for large video files (45+ min recordings can be 100-200+ MB)
});

export class CloudinaryStorage {
  /**
   * Upload a recording (video or audio) to Cloudinary
   * @param recordingId - The ID of the recording
   * @param fileBuffer - The file data as a Buffer
   * @param mediaType - Either 'audio' or 'video'
   * @param extension - File extension (e.g., 'webm', 'mp4')
   * @returns The secure URL of the uploaded file
   */
  static async uploadRecording(
    recordingId: number,
    fileBuffer: Buffer,
    mediaType: 'audio' | 'video',
    extension: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const resourceType = mediaType === 'video' ? 'video' : 'raw';
      const folder = 'telemedicine/recordings';
      const publicId = `${folder}/${recordingId}_${mediaType}`;
      
      // Upload to Cloudinary using upload_stream with extended timeout
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: resourceType,
          public_id: publicId,
          format: extension,
          overwrite: true,
          timeout: 1800000, // 30 minutes for large files (supports 45+ min recordings, 100-200+ MB)
          chunk_size: 6000000 // 6MB chunks for better reliability
        },
        (error, result) => {
          if (error) {
            logError('Cloudinary upload error:', error, {
              requestId: `cloudinary-upload-${recordingId}`,
              publicId,
              resourceType
            });
            reject(error);
          } else if (result) {
            log(`Uploaded to Cloudinary: ${result.secure_url}`, {
              requestId: `cloudinary-upload-${recordingId}`,
              publicId,
              resourceType,
              url: result.secure_url
            });
            resolve(result.secure_url);
          } else {
            reject(new Error('Upload failed: no result returned'));
          }
        }
      );
      
      // Write the buffer to the stream
      uploadStream.end(fileBuffer);
    });
  }

  /**
   * Delete a recording from Cloudinary
   * @param recordingId - The ID of the recording
   * @param mediaType - Either 'audio' or 'video'
   */
  static async deleteRecording(recordingId: number, mediaType: 'audio' | 'video'): Promise<void> {
    try {
      const resourceType = mediaType === 'video' ? 'video' : 'raw';
      const folder = 'telemedicine/recordings';
      const publicId = `${folder}/${recordingId}_${mediaType}`;
      
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
      log(`Deleted from Cloudinary: ${publicId}`, {
        requestId: `cloudinary-delete-${recordingId}`,
        publicId,
        resourceType
      });
    } catch (error) {
      logError('Error deleting from Cloudinary:', error, {
        requestId: `cloudinary-delete-${recordingId}`,
        publicId: `${'telemedicine/recordings'}/${recordingId}_${mediaType}`,
        resourceType: mediaType === 'video' ? 'video' : 'raw'
      });
      // Don't throw - deletion failures shouldn't break the app
    }
  }

  /**
   * Get the Cloudinary URL for a recording
   * Note: This is a helper method to construct URLs, but typically you'll store
   * the secure_url from the upload response in your database
   */
  static getRecordingUrl(recordingId: number, mediaType: 'audio' | 'video'): string {
    const resourceType = mediaType === 'video' ? 'video' : 'raw';
    const folder = 'telemedicine/recordings';
    const publicId = `${folder}/${recordingId}_${mediaType}`;
    
    return cloudinary.url(publicId, {
      resource_type: resourceType,
      secure: true
    });
  }
}
