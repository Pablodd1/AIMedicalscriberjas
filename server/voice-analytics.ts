import { EventEmitter } from 'events';
import { logger } from './logger';
import { dbStorage } from './storage';

export interface VoiceMetrics {
  sessionId: string;
  userId: string;
  patientId?: string;
  doctorId?: string;
  timestamp: Date;
  duration: number;
  wordCount: number;
  confidence: number;
  transcriptionProvider: string;
  recordingQuality: number;
  backgroundNoise: number;
  processingTime: number;
  errorCount: number;
  retryCount: number;
  cacheHit: boolean;
  language: string;
  medicalContext: boolean;
  featuresUsed: string[];
}

export interface VoiceUsageStats {
  totalRecordings: number;
  totalTranscriptions: number;
  averageDuration: number;
  averageConfidence: number;
  totalWords: number;
  uniqueUsers: number;
  errorRate: number;
  mostUsedProvider: string;
  peakUsageHour: number;
  cacheHitRate: number;
  medicalTermAccuracy: number;
}

export interface VoiceErrorMetrics {
  sessionId: string;
  errorType: string;
  errorMessage: string;
  timestamp: Date;
  userId: string;
  context: string;
  recoveryTime?: number;
  retryAttempts: number;
}

export class VoiceAnalytics extends EventEmitter {
  private metrics: VoiceMetrics[] = [];
  private errorMetrics: VoiceErrorMetrics[] = [];
  private readonly maxMetrics = 10000;
  private readonly batchSize = 100;
  private flushInterval: NodeJS.Timeout;

  constructor() {
    super();
    this.startPeriodicFlush();
  }

  /**
   * Record voice recording metrics
   */
  async recordVoiceMetrics(metrics: VoiceMetrics): Promise<void> {
    try {
      // Add to in-memory storage
      this.metrics.push(metrics);
      
      // Trim old metrics if necessary
      if (this.metrics.length > this.maxMetrics) {
        this.metrics = this.metrics.slice(-this.maxMetrics);
      }

      // Emit real-time events
      this.emit('metrics_recorded', metrics);

      // Log significant events
      if (metrics.confidence < 0.7) {
        logger.warn('Low confidence transcription', {
          sessionId: metrics.sessionId,
          confidence: metrics.confidence,
          userId: metrics.userId
        });
      }

      if (metrics.errorCount > 0) {
        logger.warn('Voice session with errors', {
          sessionId: metrics.sessionId,
          errorCount: metrics.errorCount,
          userId: metrics.userId
        });
      }

      // Auto-flush if batch size reached
      if (this.metrics.length >= this.batchSize) {
        await this.flushMetrics();
      }
    } catch (error) {
      logger.error('Failed to record voice metrics', { error, metrics });
    }
  }

  /**
   * Record voice error metrics
   */
  async recordVoiceError(errorMetric: VoiceErrorMetrics): Promise<void> {
    try {
      this.errorMetrics.push(errorMetric);
      
      // Log error for immediate attention
      logger.error('Voice error recorded', {
        sessionId: errorMetric.sessionId,
        errorType: errorMetric.errorType,
        userId: errorMetric.userId,
        context: errorMetric.context
      });

      this.emit('error_recorded', errorMetric);
    } catch (error) {
      logger.error('Failed to record voice error metric', { error, errorMetric });
    }
  }

  /**
   * Get voice usage statistics
   */
  async getVoiceStats(timeRange: { start: Date; end: Date }): Promise<VoiceUsageStats> {
    try {
      const relevantMetrics = this.metrics.filter(
        m => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
      );

      if (relevantMetrics.length === 0) {
        return {
          totalRecordings: 0,
          totalTranscriptions: 0,
          averageDuration: 0,
          averageConfidence: 0,
          totalWords: 0,
          uniqueUsers: 0,
          errorRate: 0,
          mostUsedProvider: '',
          peakUsageHour: 0,
          cacheHitRate: 0,
          medicalTermAccuracy: 0
        };
      }

      const totalRecordings = relevantMetrics.length;
      const totalTranscriptions = relevantMetrics.filter(m => m.wordCount > 0).length;
      const totalWords = relevantMetrics.reduce((sum, m) => sum + m.wordCount, 0);
      const totalDuration = relevantMetrics.reduce((sum, m) => sum + m.duration, 0);
      const totalConfidence = relevantMetrics.reduce((sum, m) => sum + m.confidence, 0);
      const uniqueUsers = new Set(relevantMetrics.map(m => m.userId)).size;
      const totalErrors = relevantMetrics.reduce((sum, m) => sum + m.errorCount, 0);

      // Provider usage
      const providerCounts = relevantMetrics.reduce((acc, m) => {
        acc[m.transcriptionProvider] = (acc[m.transcriptionProvider] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const mostUsedProvider = Object.entries(providerCounts)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || '';

      // Peak usage hour
      const hourCounts = relevantMetrics.reduce((acc, m) => {
        const hour = m.timestamp.getHours();
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);
      const peakUsageHour = Object.entries(hourCounts)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || 0;

      // Cache hit rate
      const cacheHits = relevantMetrics.filter(m => m.cacheHit).length;
      const cacheHitRate = totalRecordings > 0 ? cacheHits / totalRecordings : 0;

      return {
        totalRecordings,
        totalTranscriptions,
        averageDuration: totalDuration / totalRecordings,
        averageConfidence: totalConfidence / totalRecordings,
        totalWords,
        uniqueUsers,
        errorRate: totalErrors / totalRecordings,
        mostUsedProvider,
        peakUsageHour,
        cacheHitRate,
        medicalTermAccuracy: this.calculateMedicalTermAccuracy(relevantMetrics)
      };
    } catch (error) {
      logger.error('Failed to get voice stats', { error, timeRange });
      throw error;
    }
  }

  /**
   * Get detailed analytics for a specific user
   */
  async getUserAnalytics(userId: string, timeRange: { start: Date; end: Date }) {
    try {
      const userMetrics = this.metrics.filter(
        m => m.userId === userId && 
        m.timestamp >= timeRange.start && 
        m.timestamp <= timeRange.end
      );

      if (userMetrics.length === 0) {
        return { sessions: [], summary: null };
      }

      return {
        sessions: userMetrics,
        summary: {
          totalSessions: userMetrics.length,
          averageDuration: userMetrics.reduce((sum, m) => sum + m.duration, 0) / userMetrics.length,
          averageConfidence: userMetrics.reduce((sum, m) => sum + m.confidence, 0) / userMetrics.length,
          totalWords: userMetrics.reduce((sum, m) => sum + m.wordCount, 0),
          errorRate: userMetrics.reduce((sum, m) => sum + m.errorCount, 0) / userMetrics.length,
          preferredLanguage: this.getMostFrequentValue(userMetrics, 'language'),
          preferredProvider: this.getMostFrequentValue(userMetrics, 'transcriptionProvider')
        }
      };
    } catch (error) {
      logger.error('Failed to get user analytics', { error, userId, timeRange });
      throw error;
    }
  }

  /**
   * Get system health metrics
   */
  async getSystemHealth() {
    try {
      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

      const recentMetrics = this.metrics.filter(m => m.timestamp >= last24Hours);
      const lastHourMetrics = this.metrics.filter(m => m.timestamp >= lastHour);

      return {
        status: this.getSystemStatus(recentMetrics),
        metrics: {
          totalActiveSessions: recentMetrics.length,
          sessionsLastHour: lastHourMetrics.length,
          averageResponseTime: recentMetrics.reduce((sum, m) => sum + m.processingTime, 0) / recentMetrics.length,
          errorRate24h: recentMetrics.reduce((sum, m) => sum + m.errorCount, 0) / recentMetrics.length,
          cacheHitRate24h: recentMetrics.filter(m => m.cacheHit).length / recentMetrics.length,
          systemLoad: this.calculateSystemLoad(recentMetrics)
        },
        recommendations: this.generateRecommendations(recentMetrics)
      };
    } catch (error) {
      logger.error('Failed to get system health', { error });
      throw error;
    }
  }

  /**
   * Export metrics for external analysis
   */
  async exportMetrics(format: 'json' | 'csv' = 'json', timeRange?: { start: Date; end: Date }) {
    try {
      let metricsToExport = this.metrics;
      
      if (timeRange) {
        metricsToExport = this.metrics.filter(
          m => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
        );
      }

      if (format === 'csv') {
        return this.convertToCSV(metricsToExport);
      }

      return {
        exportDate: new Date(),
        recordCount: metricsToExport.length,
        timeRange: timeRange || { start: new Date(0), end: new Date() },
        metrics: metricsToExport,
        summary: await this.getVoiceStats(timeRange || { start: new Date(0), end: new Date() })
      };
    } catch (error) {
      logger.error('Failed to export metrics', { error, format, timeRange });
      throw error;
    }
  }

  /**
   * Clean up old metrics
   */
  async cleanup(retentionDays: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const oldMetrics = this.metrics.filter(m => m.timestamp < cutoffDate);
      this.metrics = this.metrics.filter(m => m.timestamp >= cutoffDate);
      this.errorMetrics = this.errorMetrics.filter(m => m.timestamp >= cutoffDate);

      logger.info('Cleaned up old metrics', {
        retentionDays,
        removedCount: oldMetrics.length,
        remainingCount: this.metrics.length
      });
    } catch (error) {
      logger.error('Failed to cleanup metrics', { error, retentionDays });
      throw error;
    }
  }

  // Private helper methods

  private startPeriodicFlush(): void {
    this.flushInterval = setInterval(async () => {
      if (this.metrics.length > 0) {
        await this.flushMetrics();
      }
    }, 5 * 60 * 1000); // Flush every 5 minutes
  }

  private async flushMetrics(): Promise<void> {
    try {
      if (this.metrics.length === 0) return;

      const metricsToFlush = [...this.metrics];
      this.metrics = [];

      // Save to database
      await dbStorage.saveVoiceMetricsBatch(metricsToFlush);
      
      logger.info('Flushed voice metrics to database', {
        count: metricsToFlush.length
      });
    } catch (error) {
      logger.error('Failed to flush metrics', { error });
      // Restore metrics to prevent data loss
      this.metrics.unshift(...this.metrics.splice(0, this.batchSize));
    }
  }

  private calculateMedicalTermAccuracy(metrics: VoiceMetrics[]): number {
    const medicalSessions = metrics.filter(m => m.medicalContext);
    if (medicalSessions.length === 0) return 0;

    const totalConfidence = medicalSessions.reduce((sum, m) => sum + m.confidence, 0);
    return totalConfidence / medicalSessions.length;
  }

  private getMostFrequentValue<T extends keyof VoiceMetrics>(
    metrics: VoiceMetrics[], 
    key: T
  ): string {
    const valueCounts = metrics.reduce((acc, m) => {
      const value = String(m[key]);
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(valueCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || '';
  }

  private getSystemStatus(metrics: VoiceMetrics[]): 'healthy' | 'degraded' | 'unhealthy' {
    if (metrics.length === 0) return 'healthy';

    const errorRate = metrics.reduce((sum, m) => sum + m.errorCount, 0) / metrics.length;
    const avgConfidence = metrics.reduce((sum, m) => sum + m.confidence, 0) / metrics.length;
    const avgProcessingTime = metrics.reduce((sum, m) => sum + m.processingTime, 0) / metrics.length;

    if (errorRate > 0.1 || avgConfidence < 0.7 || avgProcessingTime > 10000) {
      return 'unhealthy';
    }

    if (errorRate > 0.05 || avgConfidence < 0.8 || avgProcessingTime > 5000) {
      return 'degraded';
    }

    return 'healthy';
  }

  private calculateSystemLoad(metrics: VoiceMetrics[]): number {
    if (metrics.length === 0) return 0;

    const recentMetrics = metrics.slice(-10); // Last 10 sessions
    const avgProcessingTime = recentMetrics.reduce((sum, m) => sum + m.processingTime, 0) / recentMetrics.length;
    
    // Normalize processing time to 0-1 scale (assuming 5000ms is maximum load)
    return Math.min(avgProcessingTime / 5000, 1);
  }

  private generateRecommendations(metrics: VoiceMetrics[]): string[] {
    const recommendations: string[] = [];

    if (metrics.length === 0) return recommendations;

    const avgConfidence = metrics.reduce((sum, m) => sum + m.confidence, 0) / metrics.length;
    const errorRate = metrics.reduce((sum, m) => sum + m.errorCount, 0) / metrics.length;
    const cacheHitRate = metrics.filter(m => m.cacheHit).length / metrics.length;

    if (avgConfidence < 0.8) {
      recommendations.push('Consider improving audio quality or using alternative transcription providers');
    }

    if (errorRate > 0.05) {
      recommendations.push('High error rate detected - investigate error patterns and implement better error handling');
    }

    if (cacheHitRate < 0.3) {
      recommendations.push('Low cache hit rate - consider optimizing cache strategies or increasing cache TTL');
    }

    return recommendations;
  }

  private convertToCSV(metrics: VoiceMetrics[]): string {
    if (metrics.length === 0) return '';

    const headers = Object.keys(metrics[0]).join(',');
    const rows = metrics.map(m => 
      Object.values(m).map(v => 
        typeof v === 'string' && v.includes(',') ? `"${v}"` : String(v)
      ).join(',')
    ).join('\n');

    return `${headers}\n${rows}`;
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    
    // Flush remaining metrics
    if (this.metrics.length > 0) {
      this.flushMetrics().catch(error => {
        logger.error('Failed to flush metrics on destroy', { error });
      });
    }
  }
}

// Export singleton instance
export const voiceAnalytics = new VoiceAnalytics();

// Graceful shutdown handling
process.on('SIGTERM', () => {
  voiceAnalytics.destroy();
});

process.on('SIGINT', () => {
  voiceAnalytics.destroy();
});