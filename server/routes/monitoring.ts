import { Router } from 'express';
import { AppError } from '../error-handler';
import { voiceAnalytics } from '../voice-analytics';
import { backupManager } from '../backup-manager';
import { requireAuth } from '../middleware/auth';
import { logger } from '../logger';

const router = Router();

/**
 * Get voice analytics statistics
 */
router.post('/voice-analytics/stats', requireAuth, async (req, res, next) => {
  try {
    const { start, end } = req.body;
    
    if (!start || !end) {
      return next(new AppError('Start and end dates are required', 'MISSING_PARAMETERS'));
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return next(new AppError('Invalid date format', 'INVALID_PARAMETERS'));
    }

    const stats = await voiceAnalytics.getVoiceStats({ start: startDate, end: endDate });
    
    logger.info('Voice analytics stats retrieved', {
      userId: req.user?.id,
      startDate,
      endDate,
      stats
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get voice analytics stats', { error, userId: req.user?.id });
    next(error);
  }
});

/**
 * Get system health status
 */
router.get('/voice-analytics/system-health', requireAuth, async (req, res, next) => {
  try {
    const systemHealth = await voiceAnalytics.getSystemHealth();
    
    logger.info('System health retrieved', {
      userId: req.user?.id,
      status: systemHealth.status
    });

    res.json({
      success: true,
      data: systemHealth
    });
  } catch (error) {
    logger.error('Failed to get system health', { error, userId: req.user?.id });
    next(error);
  }
});

/**
 * Get recent voice sessions
 */
router.post('/voice-analytics/sessions', requireAuth, async (req, res, next) => {
  try {
    const { start, end, limit = 50, userId } = req.body;
    
    if (!start || !end) {
      return next(new AppError('Start and end dates are required', 'MISSING_PARAMETERS'));
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return next(new AppError('Invalid date format', 'INVALID_PARAMETERS'));
    }

    // Get sessions from analytics (this would be implemented in the actual voiceAnalytics)
    const sessions = []; // This would come from the actual implementation
    
    logger.info('Voice analytics sessions retrieved', {
      userId: req.user?.id,
      startDate,
      endDate,
      limit,
      sessionCount: sessions.length
    });

    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    logger.error('Failed to get voice analytics sessions', { error, userId: req.user?.id });
    next(error);
  }
});

/**
 * Get user-specific analytics
 */
router.get('/voice-analytics/user/:userId', requireAuth, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { start, end } = req.query;
    
    if (!start || !end) {
      return next(new AppError('Start and end dates are required', 'MISSING_PARAMETERS'));
    }

    const startDate = new Date(start as string);
    const endDate = new Date(end as string);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return next(new AppError('Invalid date format', 'INVALID_PARAMETERS'));
    }

    const userAnalytics = await voiceAnalytics.getUserAnalytics(userId, { start: startDate, end: endDate });
    
    logger.info('User analytics retrieved', {
      requestUserId: req.user?.id,
      targetUserId: userId,
      startDate,
      endDate
    });

    res.json({
      success: true,
      data: userAnalytics
    });
  } catch (error) {
    logger.error('Failed to get user analytics', { error, userId: req.user?.id, targetUserId: req.params.userId });
    next(error);
  }
});

/**
 * Export voice analytics metrics
 */
router.post('/voice-analytics/export', requireAuth, async (req, res, next) => {
  try {
    const { format = 'json', start, end } = req.body;
    
    if (!['json', 'csv'].includes(format)) {
      return next(new AppError('Invalid format. Must be json or csv', 'INVALID_PARAMETERS'));
    }

    const timeRange = start && end ? { start: new Date(start), end: new Date(end) } : undefined;
    
    const exportData = await voiceAnalytics.exportMetrics(format, timeRange);
    
    logger.info('Voice analytics exported', {
      userId: req.user?.id,
      format,
      timeRange,
      recordCount: exportData.metrics?.length || 0
    });

    // Set appropriate headers for file download
    const filename = `voice-analytics-${new Date().toISOString().slice(0, 10)}.${format}`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
    
    res.send(format === 'json' ? JSON.stringify(exportData, null, 2) : exportData);
  } catch (error) {
    logger.error('Failed to export voice analytics', { error, userId: req.user?.id });
    next(error);
  }
});

/**
 * Clean up old voice analytics data
 */
router.delete('/voice-analytics/cleanup', requireAuth, async (req, res, next) => {
  try {
    const { retentionDays = 30 } = req.body;
    
    if (retentionDays < 1) {
      return next(new AppError('Retention days must be at least 1', 'INVALID_PARAMETERS'));
    }

    await voiceAnalytics.cleanup(retentionDays);
    
    logger.info('Voice analytics cleanup completed', {
      userId: req.user?.id,
      retentionDays
    });

    res.json({
      success: true,
      message: `Voice analytics data older than ${retentionDays} days has been cleaned up`
    });
  } catch (error) {
    logger.error('Failed to cleanup voice analytics', { error, userId: req.user?.id });
    next(error);
  }
});

/**
 * Create a backup
 */
router.post('/backups/create', requireAuth, async (req, res, next) => {
  try {
    const { type = 'full' } = req.body;
    
    if (!['full', 'incremental'].includes(type)) {
      return next(new AppError('Invalid backup type. Must be full or incremental', 'INVALID_PARAMETERS'));
    }

    let backup;
    if (type === 'full') {
      backup = await backupManager.createFullBackup();
    } else {
      backup = await backupManager.createIncrementalBackup();
    }
    
    logger.info('Backup created', {
      userId: req.user?.id,
      backupId: backup.id,
      type: backup.type,
      size: backup.size
    });

    res.json({
      success: true,
      data: backup
    });
  } catch (error) {
    logger.error('Failed to create backup', { error, userId: req.user?.id });
    next(error);
  }
});

/**
 * List available backups
 */
router.get('/backups', requireAuth, async (req, res, next) => {
  try {
    const { limit = 50, type, status = 'completed' } = req.query;
    
    const backups = await backupManager.listBackups({
      limit: parseInt(limit as string),
      type: type as 'full' | 'incremental' | undefined,
      status: status as 'completed' | 'failed' | 'all'
    });
    
    logger.info('Backups listed', {
      userId: req.user?.id,
      limit,
      type,
      status,
      backupCount: backups.length
    });

    res.json({
      success: true,
      data: backups
    });
  } catch (error) {
    logger.error('Failed to list backups', { error, userId: req.user?.id });
    next(error);
  }
});

/**
 * Get backup status
 */
router.get('/backups/:backupId/status', requireAuth, async (req, res, next) => {
  try {
    const { backupId } = req.params;
    
    const backup = await backupManager.getBackupStatus(backupId);
    
    if (!backup) {
      return next(new AppError('Backup not found', 'NOT_FOUND'));
    }
    
    logger.info('Backup status retrieved', {
      userId: req.user?.id,
      backupId,
      status: backup.status
    });

    res.json({
      success: true,
      data: backup
    });
  } catch (error) {
    logger.error('Failed to get backup status', { error, userId: req.user?.id, backupId: req.params.backupId });
    next(error);
  }
});

/**
 * Restore from backup
 */
router.post('/backups/:backupId/restore', requireAuth, async (req, res, next) => {
  try {
    const { backupId } = req.params;
    const { 
      components = {
        audioFiles: true,
        transcriptions: true,
        analytics: true,
        configurations: true
      },
      verifyChecksum = true,
      overwriteExisting = false
    } = req.body;
    
    await backupManager.restoreFromBackup({
      backupId,
      components,
      verifyChecksum,
      overwriteExisting
    });
    
    logger.info('Backup restored', {
      userId: req.user?.id,
      backupId,
      components,
      overwriteExisting
    });

    res.json({
      success: true,
      message: `Backup ${backupId} has been restored successfully`
    });
  } catch (error) {
    logger.error('Failed to restore backup', { error, userId: req.user?.id, backupId: req.params.backupId });
    next(error);
  }
});

/**
 * Get disaster recovery status
 */
router.get('/disaster-recovery/status', requireAuth, async (req, res, next) => {
  try {
    const status = await backupManager.getDisasterRecoveryStatus();
    
    logger.info('Disaster recovery status retrieved', {
      userId: req.user?.id,
      status: status.status
    });

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Failed to get disaster recovery status', { error, userId: req.user?.id });
    next(error);
  }
});

/**
 * Test disaster recovery procedures
 */
router.post('/disaster-recovery/test', requireAuth, async (req, res, next) => {
  try {
    const result = await backupManager.testDisasterRecovery();
    
    logger.info('Disaster recovery test completed', {
      userId: req.user?.id,
      success: result.success,
      issues: result.issues
    });

    res.json({
      success: result.success,
      data: result
    });
  } catch (error) {
    logger.error('Failed to test disaster recovery', { error, userId: req.user?.id });
    next(error);
  }
});

/**
 * Get real-time voice metrics
 */
router.get('/voice-metrics/realtime', requireAuth, async (req, res, next) => {
  try {
    // Set up Server-Sent Events for real-time updates
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendMetrics = (metrics: any) => {
      res.write(`data: ${JSON.stringify(metrics)}\n\n`);
    };

    // Listen for real-time metrics
    voiceAnalytics.on('metrics_recorded', sendMetrics);
    voiceAnalytics.on('error_recorded', (error) => {
      res.write(`data: ${JSON.stringify({ type: 'error', data: error })}\n\n`);
    });

    // Send initial connection message
    res.write('data: {"type":"connected","timestamp":"' + new Date().toISOString() + '"}\n\n');

    // Handle client disconnect
    req.on('close', () => {
      voiceAnalytics.off('metrics_recorded', sendMetrics);
    });
  } catch (error) {
    logger.error('Failed to setup real-time metrics', { error, userId: req.user?.id });
    next(error);
  }
});

export const monitoringRouter = router;