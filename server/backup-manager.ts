import { promises as fs } from 'fs';
import path from 'path';
import { logger } from './logger';
import { dbStorage } from './storage';
import { voiceAnalytics } from './voice-analytics';

export interface BackupConfig {
  enabled: boolean;
  schedule: string; // Cron expression
  retentionDays: number;
  compression: boolean;
  encryption: boolean;
  destinations: string[]; // Local paths or cloud storage
  includeAudioFiles: boolean;
  includeTranscriptions: boolean;
  includeAnalytics: boolean;
  maxFileSize: number; // Maximum file size in bytes
  chunkSize: number; // Size of backup chunks
}

export interface BackupMetadata {
  id: string;
  timestamp: Date;
  type: 'full' | 'incremental';
  size: number;
  fileCount: number;
  checksum: string;
  compressionRatio: number;
  encryptionUsed: boolean;
  destinations: string[];
  components: {
    audioFiles: boolean;
    transcriptions: boolean;
    analytics: boolean;
    configurations: boolean;
  };
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
}

export interface RestoreOptions {
  backupId: string;
  components: {
    audioFiles?: boolean;
    transcriptions?: boolean;
    analytics?: boolean;
    configurations?: boolean;
  };
  targetPath?: string;
  verifyChecksum: boolean;
  overwriteExisting: boolean;
}

export interface DisasterRecoveryPlan {
  name: string;
  description: string;
  recoveryTimeObjective: number; // Recovery time in minutes
  recoveryPointObjective: number; // Maximum data loss in minutes
  backupStrategy: 'full' | 'incremental' | 'differential';
  backupFrequency: number; // Backup frequency in minutes
  offsiteStorage: boolean;
  replicationFactor: number;
  healthCheckInterval: number; // Health check interval in minutes
  autoFailover: boolean;
  notificationChannels: string[];
}

export class BackupManager {
  private config: BackupConfig;
  private activeBackups: Map<string, BackupMetadata> = new Map();
  private recoveryPlan: DisasterRecoveryPlan;

  constructor(config: Partial<BackupConfig> = {}) {
    this.config = {
      enabled: true,
      schedule: '0 2 * * *', // Daily at 2 AM
      retentionDays: 30,
      compression: true,
      encryption: true,
      destinations: ['/backups/voice-system'],
      includeAudioFiles: true,
      includeTranscriptions: true,
      includeAnalytics: true,
      maxFileSize: 1024 * 1024 * 1024, // 1GB
      chunkSize: 64 * 1024 * 1024, // 64MB
      ...config
    };

    this.recoveryPlan = {
      name: 'Voice System Disaster Recovery',
      description: 'Comprehensive disaster recovery plan for voice recording and transcription system',
      recoveryTimeObjective: 60, // 1 hour
      recoveryPointObjective: 15, // 15 minutes max data loss
      backupStrategy: 'incremental',
      backupFrequency: 60, // Every hour
      offsiteStorage: true,
      replicationFactor: 3,
      healthCheckInterval: 5,
      autoFailover: true,
      notificationChannels: ['email', 'slack', 'sms']
    };

    this.initializeBackupSystem();
  }

  /**
   * Initialize the backup system
   */
  private async initializeBackupSystem(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('Backup system is disabled');
      return;
    }

    try {
      // Create backup directories
      for (const destination of this.config.destinations) {
        await this.ensureDirectoryExists(destination);
      }

      // Schedule automatic backups
      this.scheduleAutomaticBackups();

      // Start health monitoring
      this.startHealthMonitoring();

      logger.info('Backup system initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize backup system', { error });
      throw error;
    }
  }

  /**
   * Create a full backup
   */
  async createFullBackup(): Promise<BackupMetadata> {
    return this.createBackup('full');
  }

  /**
   * Create an incremental backup
   */
  async createIncrementalBackup(lastBackup?: Date): Promise<BackupMetadata> {
    return this.createBackup('incremental', lastBackup);
  }

  /**
   * Create a backup
   */
  private async createBackup(type: 'full' | 'incremental', lastBackup?: Date): Promise<BackupMetadata> {
    const backupId = `backup_${Date.now()}_${type}`;
    const metadata: BackupMetadata = {
      id: backupId,
      timestamp: new Date(),
      type,
      size: 0,
      fileCount: 0,
      checksum: '',
      compressionRatio: 1,
      encryptionUsed: this.config.encryption,
      destinations: [],
      components: {
        audioFiles: this.config.includeAudioFiles,
        transcriptions: this.config.includeTranscriptions,
        analytics: this.config.includeAnalytics,
        configurations: true
      },
      status: 'running',
      startedAt: new Date()
    };

    this.activeBackups.set(backupId, metadata);

    try {
      logger.info(`Starting ${type} backup`, { backupId });

      // Create backup directory
      const backupDir = path.join(this.config.destinations[0], backupId);
      await this.ensureDirectoryExists(backupDir);

      // Backup audio files
      if (this.config.includeAudioFiles) {
        await this.backupAudioFiles(backupDir, type, lastBackup);
        metadata.components.audioFiles = true;
      }

      // Backup transcriptions
      if (this.config.includeTranscriptions) {
        await this.backupTranscriptions(backupDir, type, lastBackup);
        metadata.components.transcriptions = true;
      }

      // Backup analytics data
      if (this.config.includeAnalytics) {
        await this.backupAnalytics(backupDir);
        metadata.components.analytics = true;
      }

      // Backup configuration files
      await this.backupConfigurations(backupDir);
      metadata.components.configurations = true;

      // Calculate backup statistics
      const stats = await this.calculateBackupStats(backupDir);
      metadata.size = stats.size;
      metadata.fileCount = stats.fileCount;
      metadata.compressionRatio = stats.compressionRatio;

      // Generate checksum
      metadata.checksum = await this.generateChecksum(backupDir);

      // Compress if enabled
      if (this.config.compression) {
        await this.compressBackup(backupDir);
      }

      // Encrypt if enabled
      if (this.config.encryption) {
        await this.encryptBackup(backupDir);
      }

      // Copy to multiple destinations
      for (const destination of this.config.destinations) {
        if (destination !== this.config.destinations[0]) {
          await this.copyToDestination(backupDir, destination);
        }
        metadata.destinations.push(destination);
      }

      metadata.status = 'completed';
      metadata.completedAt = new Date();
      metadata.duration = metadata.completedAt.getTime() - metadata.startedAt!.getTime();

      logger.info(`Backup completed successfully`, { backupId, metadata });
      
      // Clean up old backups
      await this.cleanupOldBackups();

      return metadata;
    } catch (error) {
      metadata.status = 'failed';
      metadata.error = error instanceof Error ? error.message : String(error);
      metadata.completedAt = new Date();
      
      logger.error(`Backup failed`, { backupId, error });
      throw error;
    } finally {
      this.activeBackups.delete(backupId);
    }
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(options: RestoreOptions): Promise<void> {
    const { backupId, components, verifyChecksum, overwriteExisting } = options;
    
    try {
      logger.info(`Starting restore from backup`, { backupId, components });

      // Find backup metadata
      const backupMetadata = await this.findBackupMetadata(backupId);
      if (!backupMetadata) {
        throw new Error(`Backup ${backupId} not found`);
      }

      if (backupMetadata.status !== 'completed') {
        throw new Error(`Backup ${backupId} is not in completed status`);
      }

      const backupDir = path.join(backupMetadata.destinations[0], backupId);

      // Verify checksum if requested
      if (verifyChecksum) {
        const currentChecksum = await this.generateChecksum(backupDir);
        if (currentChecksum !== backupMetadata.checksum) {
          throw new Error('Backup checksum verification failed');
        }
      }

      // Decrypt if necessary
      if (backupMetadata.encryptionUsed) {
        await this.decryptBackup(backupDir);
      }

      // Decompress if necessary
      if (backupMetadata.compressionRatio !== 1) {
        await this.decompressBackup(backupDir);
      }

      // Restore components
      if (components.audioFiles && backupMetadata.components.audioFiles) {
        await this.restoreAudioFiles(backupDir, overwriteExisting);
      }

      if (components.transcriptions && backupMetadata.components.transcriptions) {
        await this.restoreTranscriptions(backupDir, overwriteExisting);
      }

      if (components.analytics && backupMetadata.components.analytics) {
        await this.restoreAnalytics(backupDir);
      }

      if (components.configurations && backupMetadata.components.configurations) {
        await this.restoreConfigurations(backupDir);
      }

      logger.info(`Restore completed successfully`, { backupId });
    } catch (error) {
      logger.error(`Restore failed`, { backupId, error });
      throw error;
    }
  }

  /**
   * Get backup status
   */
  async getBackupStatus(backupId: string): Promise<BackupMetadata | null> {
    const activeBackup = this.activeBackups.get(backupId);
    if (activeBackup) {
      return activeBackup;
    }

    return this.findBackupMetadata(backupId);
  }

  /**
   * List available backups
   */
  async listBackups(options: {
    limit?: number;
    type?: 'full' | 'incremental';
    status?: 'completed' | 'failed' | 'all';
  } = {}): Promise<BackupMetadata[]> {
    const { limit = 50, type, status = 'completed' } = options;
    const backups: BackupMetadata[] = [];

    try {
      for (const destination of this.config.destinations) {
        const backupDirs = await fs.readdir(destination);
        
        for (const dir of backupDirs) {
          if (dir.startsWith('backup_')) {
            const metadata = await this.findBackupMetadata(dir);
            if (metadata) {
              if ((!type || metadata.type === type) && 
                  (status === 'all' || metadata.status === status)) {
                backups.push(metadata);
              }
            }
          }
        }
      }

      // Sort by timestamp (newest first)
      backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return backups.slice(0, limit);
    } catch (error) {
      logger.error('Failed to list backups', { error });
      return [];
    }
  }

  /**
   * Get disaster recovery status
   */
  async getDisasterRecoveryStatus(): Promise<{
    status: 'ready' | 'warning' | 'critical';
    lastBackup?: Date;
    nextBackup?: Date;
    recoveryPointObjective: number;
    recoveryTimeObjective: number;
    recommendations: string[];
  }> {
    const now = new Date();
    const backups = await this.listBackups({ limit: 1 });
    const lastBackup = backups.length > 0 ? backups[0] : undefined;
    
    let status: 'ready' | 'warning' | 'critical' = 'ready';
    const recommendations: string[] = [];

    if (!lastBackup) {
      status = 'critical';
      recommendations.push('No backups found - create a backup immediately');
    } else {
      const hoursSinceLastBackup = (now.getTime() - lastBackup.timestamp.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastBackup > this.recoveryPlan.recoveryPointObjective * 2) {
        status = 'critical';
        recommendations.push(`Last backup is ${hoursSinceLastBackup.toFixed(1)} hours old - create a new backup`);
      } else if (hoursSinceLastBackup > this.recoveryPlan.recoveryPointObjective) {
        status = 'warning';
        recommendations.push(`Consider creating a new backup - last one is ${hoursSinceLastBackup.toFixed(1)} hours old`);
      }
    }

    return {
      status,
      lastBackup: lastBackup?.timestamp,
      nextBackup: this.calculateNextBackupTime(),
      recoveryPointObjective: this.recoveryPlan.recoveryPointObjective,
      recoveryTimeObjective: this.recoveryPlan.recoveryTimeObjective,
      recommendations
    };
  }

  /**
   * Test disaster recovery procedures
   */
  async testDisasterRecovery(): Promise<{
    success: boolean;
    backupAvailable: boolean;
    restoreTested: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    let backupAvailable = false;
    let restoreTested = false;

    try {
      // Check if backups are available
      const backups = await this.listBackups({ limit: 1 });
      backupAvailable = backups.length > 0;

      if (!backupAvailable) {
        issues.push('No backups available for disaster recovery');
        return { success: false, backupAvailable, restoreTested, issues };
      }

      // Test restore process (without actually restoring)
      const latestBackup = backups[0];
      const testRestoreOptions: RestoreOptions = {
        backupId: latestBackup.id,
        components: {
          configurations: true,
          analytics: false,
          audioFiles: false,
          transcriptions: false
        },
        verifyChecksum: true,
        overwriteExisting: false
      };

      try {
        // This would be a dry-run restore
        await this.simulateRestore(testRestoreOptions);
        restoreTested = true;
      } catch (error) {
        issues.push(`Restore test failed: ${error instanceof Error ? error.message : String(error)}`);
      }

      return {
        success: backupAvailable && restoreTested && issues.length === 0,
        backupAvailable,
        restoreTested,
        issues
      };
    } catch (error) {
      issues.push(`Disaster recovery test failed: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, backupAvailable, restoreTested, issues };
    }
  }

  // Private helper methods

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if ((error as any).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  private scheduleAutomaticBackups(): void {
    // This would typically use a cron job or scheduled task
    // For now, log that backups should be scheduled
    logger.info('Automatic backups should be scheduled using cron expression', {
      schedule: this.config.schedule
    });
  }

  private startHealthMonitoring(): void {
    // Start periodic health checks
    setInterval(async () => {
      await this.performHealthCheck();
    }, this.recoveryPlan.healthCheckInterval * 60 * 1000);
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const status = await this.getDisasterRecoveryStatus();
      
      if (status.status === 'critical') {
        logger.error('Critical disaster recovery status detected', { status });
        // Send alerts through notification channels
        await this.sendAlert('critical', 'Disaster recovery status is critical', status.recommendations);
      } else if (status.status === 'warning') {
        logger.warn('Warning disaster recovery status detected', { status });
        await this.sendAlert('warning', 'Disaster recovery status requires attention', status.recommendations);
      }
    } catch (error) {
      logger.error('Health check failed', { error });
    }
  }

  private async backupAudioFiles(backupDir: string, type: 'full' | 'incremental', lastBackup?: Date): Promise<void> {
    const audioDir = path.join(backupDir, 'audio_files');
    await this.ensureDirectoryExists(audioDir);

    // Get audio files from storage
    const audioFiles = await this.getAudioFiles(type, lastBackup);

    for (const file of audioFiles) {
      const destPath = path.join(audioDir, file.filename);
      await this.copyFile(file.path, destPath);
    }

    logger.info(`Backed up ${audioFiles.length} audio files`);
  }

  private async backupTranscriptions(backupDir: string, type: 'full' | 'incremental', lastBackup?: Date): Promise<void> {
    const transcriptionsDir = path.join(backupDir, 'transcriptions');
    await this.ensureDirectoryExists(transcriptionsDir);

    // Export transcriptions from database
    const transcriptions = await this.exportTranscriptions(type, lastBackup);
    const transcriptionsFile = path.join(transcriptionsDir, 'transcriptions.json');
    
    await fs.writeFile(transcriptionsFile, JSON.stringify(transcriptions, null, 2));

    logger.info(`Backed up ${transcriptions.length} transcriptions`);
  }

  private async backupAnalytics(backupDir: string): Promise<void> {
    const analyticsDir = path.join(backupDir, 'analytics');
    await this.ensureDirectoryExists(analyticsDir);

    // Export analytics data
    const analyticsData = await voiceAnalytics.exportMetrics('json');
    const analyticsFile = path.join(analyticsDir, 'analytics.json');
    
    await fs.writeFile(analyticsFile, JSON.stringify(analyticsData, null, 2));

    logger.info(`Backed up analytics data`);
  }

  private async backupConfigurations(backupDir: string): Promise<void> {
    const configDir = path.join(backupDir, 'configurations');
    await this.ensureDirectoryExists(configDir);

    // Backup configuration files
    const configFiles = [
      'server/config/voice-config.json',
      'server/config/transcription-config.json',
      'client/config/voice-settings.json'
    ];

    for (const configFile of configFiles) {
      try {
        const srcPath = path.join(process.cwd(), configFile);
        const destPath = path.join(configDir, path.basename(configFile));
        await this.copyFile(srcPath, destPath);
      } catch (error) {
        logger.warn(`Failed to backup configuration file: ${configFile}`, { error });
      }
    }

    logger.info(`Backed up configuration files`);
  }

  private async cleanupOldBackups(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    const oldBackups = await this.listBackups({ status: 'all' });
    
    for (const backup of oldBackups) {
      if (backup.timestamp < cutoffDate) {
        try {
          await this.deleteBackup(backup.id);
          logger.info(`Deleted old backup`, { backupId: backup.id });
        } catch (error) {
          logger.error(`Failed to delete old backup`, { backupId: backup.id, error });
        }
      }
    }
  }

  private async deleteBackup(backupId: string): Promise<void> {
    for (const destination of this.config.destinations) {
      const backupDir = path.join(destination, backupId);
      try {
        await fs.rm(backupDir, { recursive: true, force: true });
      } catch (error) {
        logger.warn(`Failed to delete backup directory`, { backupDir, error });
      }
    }
  }

  private calculateNextBackupTime(): Date {
    // This would parse the cron expression and calculate next execution time
    // For now, return current time + 24 hours
    const next = new Date();
    next.setHours(next.getHours() + 24);
    return next;
  }

  private async sendAlert(severity: 'warning' | 'critical', message: string, recommendations: string[]): Promise<void> {
    // Implement alert sending logic
    logger.warn(`Backup alert: ${message}`, { severity, recommendations });
  }

  // Placeholder methods for storage operations
  private async getAudioFiles(type: 'full' | 'incremental', lastBackup?: Date): Promise<any[]> {
    // Implement logic to get audio files from storage
    return [];
  }

  private async exportTranscriptions(type: 'full' | 'incremental', lastBackup?: Date): Promise<any[]> {
    // Implement logic to export transcriptions from database
    return [];
  }

  private async findBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    // Implement logic to find backup metadata
    return null;
  }

  private async copyFile(src: string, dest: string): Promise<void> {
    await fs.copyFile(src, dest);
  }

  private async copyFile(src: string, dest: string): Promise<void> {
    await fs.copyFile(src, dest);
  }

  private async calculateBackupStats(backupDir: string): Promise<{ size: number; fileCount: number; compressionRatio: number }> {
    // Implement logic to calculate backup statistics
    return { size: 0, fileCount: 0, compressionRatio: 1 };
  }

  private async generateChecksum(backupDir: string): Promise<string> {
    // Implement logic to generate checksum for backup
    return 'checksum_placeholder';
  }

  private async compressBackup(backupDir: string): Promise<void> {
    // Implement logic to compress backup
  }

  private async decompressBackup(backupDir: string): Promise<void> {
    // Implement logic to decompress backup
  }

  private async encryptBackup(backupDir: string): Promise<void> {
    // Implement logic to encrypt backup
  }

  private async decryptBackup(backupDir: string): Promise<void> {
    // Implement logic to decrypt backup
  }

  private async copyToDestination(backupDir: string, destination: string): Promise<void> {
    // Implement logic to copy backup to destination
  }

  private async restoreAudioFiles(backupDir: string, overwrite: boolean): Promise<void> {
    // Implement logic to restore audio files
  }

  private async restoreTranscriptions(backupDir: string, overwrite: boolean): Promise<void> {
    // Implement logic to restore transcriptions
  }

  private async restoreAnalytics(backupDir: string): Promise<void> {
    // Implement logic to restore analytics
  }

  private async restoreConfigurations(backupDir: string): Promise<void> {
    // Implement logic to restore configurations
  }

  private async simulateRestore(options: RestoreOptions): Promise<void> {
    // Implement logic to simulate restore (dry-run)
  }
}

// Export singleton instance
export const backupManager = new BackupManager({
  enabled: process.env.ENABLE_BACKUPS === 'true',
  schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *',
  retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
  compression: process.env.BACKUP_COMPRESSION !== 'false',
  encryption: process.env.BACKUP_ENCRYPTION !== 'false',
  destinations: process.env.BACKUP_DESTINATIONS?.split(',') || ['/backups/voice-system'],
  includeAudioFiles: process.env.BACKUP_INCLUDE_AUDIO !== 'false',
  includeTranscriptions: process.env.BACKUP_INCLUDE_TRANSCRIPTIONS !== 'false',
  includeAnalytics: process.env.BACKUP_INCLUDE_ANALYTICS !== 'false',
  maxFileSize: parseInt(process.env.BACKUP_MAX_FILE_SIZE || '1073741824'), // 1GB
  chunkSize: parseInt(process.env.BACKUP_CHUNK_SIZE || '67108864') // 64MB
});