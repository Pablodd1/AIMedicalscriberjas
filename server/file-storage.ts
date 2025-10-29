import fs from 'fs/promises';
import path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'server', 'uploads', 'recordings');

export class FileStorage {
  static async ensureUploadsDir(): Promise<void> {
    try {
      await fs.access(UPLOADS_DIR);
    } catch {
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
    }
  }

  static async saveRecording(
    recordingId: number,
    fileBuffer: Buffer,
    mediaType: 'audio' | 'video',
    extension: string
  ): Promise<string> {
    await this.ensureUploadsDir();
    
    const filename = `${recordingId}_${mediaType}.${extension}`;
    const filepath = path.join(UPLOADS_DIR, filename);
    
    await fs.writeFile(filepath, fileBuffer);
    
    return filepath;
  }

  static async getRecording(recordingId: number, mediaType: 'audio' | 'video'): Promise<Buffer | null> {
    await this.ensureUploadsDir();
    
    try {
      const files = await fs.readdir(UPLOADS_DIR);
      const filename = files.find(f => f.startsWith(`${recordingId}_${mediaType}`));
      
      if (!filename) {
        return null;
      }
      
      const filepath = path.join(UPLOADS_DIR, filename);
      const buffer = await fs.readFile(filepath);
      return buffer;
    } catch {
      return null;
    }
  }

  static async deleteRecording(recordingId: number, mediaType?: 'audio' | 'video'): Promise<void> {
    await this.ensureUploadsDir();
    
    try {
      const files = await fs.readdir(UPLOADS_DIR);
      
      const filesToDelete = mediaType 
        ? files.filter(f => f.startsWith(`${recordingId}_${mediaType}`))
        : files.filter(f => f.startsWith(`${recordingId}_`));
      
      await Promise.all(
        filesToDelete.map(filename => 
          fs.unlink(path.join(UPLOADS_DIR, filename)).catch(() => {})
        )
      );
    } catch {
      // Directory doesn't exist or other error - nothing to delete
    }
  }

  static async getFilePath(recordingId: number, mediaType: 'audio' | 'video'): Promise<string | null> {
    await this.ensureUploadsDir();
    
    try {
      const files = await fs.readdir(UPLOADS_DIR);
      const filename = files.find(f => f.startsWith(`${recordingId}_${mediaType}`));
      
      if (!filename) {
        return null;
      }
      
      return path.join(UPLOADS_DIR, filename);
    } catch {
      return null;
    }
  }

  static async getContentType(filepath: string): Promise<string> {
    const ext = path.extname(filepath).toLowerCase();
    
    const contentTypes: Record<string, string> = {
      '.webm': 'video/webm',
      '.mp4': 'video/mp4',
      '.ogg': 'audio/ogg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
    };
    
    return contentTypes[ext] || 'application/octet-stream';
  }
}
