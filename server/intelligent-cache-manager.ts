import { Redis } from 'ioredis';
import NodeCache from 'node-cache';
import { log, logError } from '../logger';

// Cache configuration
interface CacheConfig {
  // Redis configuration
  redis: {
    enabled: boolean;
    host: string;
    port: number;
    password?: string;
    db: number;
    keyPrefix: string;
    ttl: number; // seconds
  };
  
  // Local cache configuration
  local: {
    enabled: boolean;
    ttl: number; // seconds
    checkperiod: number; // seconds
    maxKeys: number;
  };
  
  // Cache strategies
  strategies: {
    transcription: {
      enabled: boolean;
      ttl: number;
      maxSize: number; // MB
    };
    medicalData: {
      enabled: boolean;
      ttl: number;
      encryption: boolean;
    };
    patientData: {
      enabled: boolean;
      ttl: number;
      anonymization: boolean;
    };
    voiceCommands: {
      enabled: boolean;
      ttl: number;
      personalization: boolean;
    };
    clinicalSummaries: {
      enabled: boolean;
      ttl: number;
      compression: boolean;
    };
  };
}

// Default cache configuration
const DEFAULT_CACHE_CONFIG: CacheConfig = {
  redis: {
    enabled: false, // Will be enabled if Redis is available
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: 'medical_ai:',
    ttl: 3600 // 1 hour
  },
  local: {
    enabled: true,
    ttl: 1800, // 30 minutes
    checkperiod: 600, // 10 minutes
    maxKeys: 10000
  },
  strategies: {
    transcription: {
      enabled: true,
      ttl: 3600, // 1 hour
      maxSize: 100 // 100MB
    },
    medicalData: {
      enabled: true,
      ttl: 1800, // 30 minutes
      encryption: true
    },
    patientData: {
      enabled: true,
      ttl: 900, // 15 minutes
      anonymization: true
    },
    voiceCommands: {
      enabled: true,
      ttl: 7200, // 2 hours
      personalization: true
    },
    clinicalSummaries: {
      enabled: true,
      ttl: 86400, // 24 hours
      compression: true
    }
  }
};

export class IntelligentCacheManager {
  private config: CacheConfig;
  private redisClient: Redis | null = null;
  private localCache: NodeCache;
  private metrics: CacheMetrics;
  private enabledStrategies: Set<string>;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.enabledStrategies = new Set();
    this.metrics = this.initializeMetrics();
    this.localCache = new NodeCache({
      stdTTL: this.config.local.ttl,
      checkperiod: this.config.local.checkperiod,
      maxKeys: this.config.local.maxKeys,
      useClones: false
    });
    
    this.initializeRedis();
    this.setupCacheStrategies();
  }

  private initializeMetrics(): CacheMetrics {
    return {
      hits: 0,
      misses: 0,
      redisHits: 0,
      redisMisses: 0,
      localHits: 0,
      localMisses: 0,
      evictions: 0,
      errors: 0,
      avgResponseTime: 0,
      memoryUsage: 0,
      startTime: Date.now()
    };
  }

  private async initializeRedis(): Promise<void> {
    if (!this.config.redis.enabled) {
      log('Redis caching disabled');
      return;
    }

    try {
      this.redisClient = new Redis({
        host: this.config.redis.host,
        port: this.config.redis.port,
        password: this.config.redis.password,
        db: this.config.redis.db,
        keyPrefix: this.config.redis.keyPrefix,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true
      });

      await this.redisClient.connect();
      log('Redis client connected successfully');
    } catch (error) {
      logError('Failed to connect to Redis:', error);
      this.config.redis.enabled = false;
      log('Falling back to local caching only');
    }
  }

  private setupCacheStrategies(): void {
    const strategies = this.config.strategies;
    
    Object.keys(strategies).forEach(strategy => {
      const config = strategies[strategy as keyof typeof strategies];
      if (config.enabled) {
        this.enabledStrategies.add(strategy);
        log(`Enabled cache strategy: ${strategy}`);
      }
    });
  }

  /**
   * Get value from cache with intelligent fallback
   */
  async get<T>(key: string, strategy: CacheStrategy = 'default'): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      // Check if strategy is enabled
      if (!this.isStrategyEnabled(strategy)) {
        return null;
      }

      // Generate strategy-specific key
      const cacheKey = this.generateKey(key, strategy);

      // Try Redis first if available
      if (this.redisClient && this.config.redis.enabled) {
        const redisValue = await this.getFromRedis<T>(cacheKey, strategy);
        if (redisValue !== null) {
          this.metrics.redisHits++;
          this.metrics.hits++;
          this.updateResponseTime(Date.now() - startTime);
          return redisValue;
        }
        this.metrics.redisMisses++;
      }

      // Try local cache
      if (this.config.local.enabled) {
        const localValue = this.getFromLocal<T>(cacheKey, strategy);
        if (localValue !== null) {
          this.metrics.localHits++;
          this.metrics.hits++;
          this.updateResponseTime(Date.now() - startTime);
          return localValue;
        }
        this.metrics.localMisses++;
      }

      this.metrics.misses++;
      this.updateResponseTime(Date.now() - startTime);
      return null;

    } catch (error) {
      this.metrics.errors++;
      logError(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache with intelligent storage
   */
  async set<T>(key: string, value: T, strategy: CacheStrategy = 'default', ttl?: number): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      // Check if strategy is enabled
      if (!this.isStrategyEnabled(strategy)) {
        return false;
      }

      // Generate strategy-specific key
      const cacheKey = this.generateKey(key, strategy);
      
      // Determine TTL
      const finalTTL = ttl || this.getStrategyTTL(strategy);

      // Store in Redis if available
      if (this.redisClient && this.config.redis.enabled) {
        const redisSuccess = await this.setInRedis(cacheKey, value, strategy, finalTTL);
        if (redisSuccess) {
          this.updateResponseTime(Date.now() - startTime);
          return true;
        }
      }

      // Store in local cache as fallback
      if (this.config.local.enabled) {
        const localSuccess = this.setInLocal(cacheKey, value, strategy, finalTTL);
        this.updateResponseTime(Date.now() - startTime);
        return localSuccess;
      }

      return false;

    } catch (error) {
      this.metrics.errors++;
      logError(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string, strategy: CacheStrategy = 'default'): Promise<boolean> {
    try {
      const cacheKey = this.generateKey(key, strategy);
      
      // Delete from Redis
      if (this.redisClient) {
        await this.redisClient.del(cacheKey);
      }

      // Delete from local cache
      if (this.config.local.enabled) {
        this.localCache.del(cacheKey);
      }

      return true;

    } catch (error) {
      this.metrics.errors++;
      logError(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Clear cache for specific strategy
   */
  async clear(strategy: CacheStrategy = 'default'): Promise<boolean> {
    try {
      const keyPattern = this.generateKey('*', strategy);
      
      // Clear from Redis
      if (this.redisClient) {
        const keys = await this.redisClient.keys(keyPattern);
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
        }
      }

      // Clear from local cache
      if (this.config.local.enabled) {
        const keys = this.localCache.keys();
        const strategyKeys = keys.filter(key => key.startsWith(keyPattern.split('*')[0]));
        strategyKeys.forEach(key => this.localCache.del(key));
      }

      return true;

    } catch (error) {
      this.metrics.errors++;
      logError(`Cache clear error for strategy ${strategy}:`, error);
      return false;
    }
  }

  /**
   * Cache medical transcription result
   */
  async cacheTranscription(
    audioHash: string,
    transcription: any,
    options: { ttl?: number; compress?: boolean } = {}
  ): Promise<boolean> {
    if (!this.isStrategyEnabled('transcription')) {
      return false;
    }

    const key = `transcription:${audioHash}`;
    const ttl = options.ttl || this.config.strategies.transcription.ttl;
    
    // Compress if requested and enabled
    let value = transcription;
    if (options.compress && this.config.strategies.transcription.compression) {
      value = await this.compressData(transcription);
    }

    return await this.set(key, value, 'transcription', ttl);
  }

  /**
   * Get cached transcription result
   */
  async getTranscription(audioHash: string): Promise<any | null> {
    if (!this.isStrategyEnabled('transcription')) {
      return null;
    }

    const key = `transcription:${audioHash}`;
    const cached = await this.get(key, 'transcription');
    
    if (cached && this.config.strategies.transcription.compression) {
      return await this.decompressData(cached);
    }

    return cached;
  }

  /**
   * Cache medical data with encryption
   */
  async cacheMedicalData(
    key: string,
    data: any,
    options: { ttl?: number; encrypt?: boolean } = {}
  ): Promise<boolean> {
    if (!this.isStrategyEnabled('medicalData')) {
      return false;
    }

    const ttl = options.ttl || this.config.strategies.medicalData.ttl;
    let value = data;

    // Encrypt if requested and enabled
    if (options.encrypt && this.config.strategies.medicalData.encryption) {
      value = await this.encryptData(data);
    }

    return await this.set(`medical:${key}`, value, 'medicalData', ttl);
  }

  /**
   * Get cached medical data with decryption
   */
  async getMedicalData(key: string): Promise<any | null> {
    if (!this.isStrategyEnabled('medicalData')) {
      return null;
    }

    const cached = await this.get(`medical:${key}`, 'medicalData');
    
    if (cached && this.config.strategies.medicalData.encryption) {
      return await this.decryptData(cached);
    }

    return cached;
  }

  /**
   * Cache patient data with anonymization
   */
  async cachePatientData(
    patientId: string,
    data: any,
    options: { ttl?: number; anonymize?: boolean } = {}
  ): Promise<boolean> {
    if (!this.isStrategyEnabled('patientData')) {
      return false;
    }

    const ttl = options.ttl || this.config.strategies.patientData.ttl;
    let value = data;

    // Anonymize if requested and enabled
    if (options.anonymize && this.config.strategies.patientData.anonymization) {
      value = await this.anonymizePatientData(data);
    }

    return await this.set(`patient:${patientId}`, value, 'patientData', ttl);
  }

  /**
   * Get cached patient data
   */
  async getPatientData(patientId: string): Promise<any | null> {
    if (!this.isStrategyEnabled('patientData')) {
      return null;
    }

    return await this.get(`patient:${patientId}`, 'patientData');
  }

  /**
   * Cache voice command patterns with personalization
   */
  async cacheVoiceCommands(
    userId: string,
    commands: any[],
    options: { ttl?: number; personalize?: boolean } = {}
  ): Promise<boolean> {
    if (!this.isStrategyEnabled('voiceCommands')) {
      return false;
    }

    const ttl = options.ttl || this.config.strategies.voiceCommands.ttl;
    let value = commands;

    // Personalize if requested and enabled
    if (options.personalize && this.config.strategies.voiceCommands.personalization) {
      value = await this.personalizeVoiceCommands(commands, userId);
    }

    return await this.set(`voice:${userId}`, value, 'voiceCommands', ttl);
  }

  /**
   * Get cached voice command patterns
   */
  async getVoiceCommands(userId: string): Promise<any[] | null> {
    if (!this.isStrategyEnabled('voiceCommands')) {
      return null;
    }

    return await this.get(`voice:${userId}`, 'voiceCommands');
  }

  /**
   * Cache clinical summaries with compression
   */
  async cacheClinicalSummary(
    summaryId: string,
    summary: any,
    options: { ttl?: number; compress?: boolean } = {}
  ): Promise<boolean> {
    if (!this.isStrategyEnabled('clinicalSummaries')) {
      return false;
    }

    const ttl = options.ttl || this.config.strategies.clinicalSummaries.ttl;
    let value = summary;

    // Compress if requested and enabled
    if (options.compress && this.config.strategies.clinicalSummaries.compression) {
      value = await this.compressData(summary);
    }

    return await this.set(`summary:${summaryId}`, value, 'clinicalSummaries', ttl);
  }

  /**
   * Get cached clinical summary
   */
  async getClinicalSummary(summaryId: string): Promise<any | null> {
    if (!this.isStrategyEnabled('clinicalSummaries')) {
      return null;
    }

    const cached = await this.get(`summary:${summaryId}`, 'clinicalSummaries');
    
    if (cached && this.config.strategies.clinicalSummaries.compression) {
      return await this.decompressData(cached);
    }

    return cached;
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    return {
      ...this.metrics,
      hitRate: this.metrics.hits / Math.max(1, this.metrics.hits + this.metrics.misses),
      memoryUsage: this.getMemoryUsage(),
      uptime: Date.now() - this.metrics.startTime
    };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const metrics = this.getMetrics();
    
    return {
      totalRequests: metrics.hits + metrics.misses,
      hitRate: metrics.hitRate,
      avgResponseTime: metrics.avgResponseTime,
      memoryUsage: metrics.memoryUsage,
      enabledStrategies: Array.from(this.enabledStrategies),
      redisConnected: !!this.redisClient,
      localCacheKeys: this.config.local.enabled ? this.localCache.keys().length : 0,
      errors: metrics.errors,
      uptime: metrics.uptime
    };
  }

  /**
   * Optimize cache performance
   */
  async optimize(): Promise<OptimizationResult> {
    const startTime = Date.now();
    const beforeStats = this.getStats();
    
    try {
      // Clean up expired keys
      await this.cleanupExpiredKeys();
      
      // Optimize memory usage
      await this.optimizeMemoryUsage();
      
      // Update cache configurations based on usage patterns
      await this.updateCacheConfigurations();
      
      const endTime = Date.now();
      const afterStats = this.getStats();
      
      return {
        success: true,
        duration: endTime - startTime,
        beforeStats,
        afterStats,
        improvements: this.calculateImprovements(beforeStats, afterStats)
      };

    } catch (error) {
      logError('Cache optimization error:', error);
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Optimization failed'
      };
    }
  }

  // Helper methods
  private generateKey(key: string, strategy: CacheStrategy): string {
    const strategyPrefix = strategy === 'default' ? '' : `${strategy}:`;
    return `${this.config.redis.keyPrefix}${strategyPrefix}${key}`;
  }

  private isStrategyEnabled(strategy: CacheStrategy): boolean {
    return this.enabledStrategies.has(strategy);
  }

  private getStrategyTTL(strategy: CacheStrategy): number {
    const strategyConfig = this.config.strategies[strategy as keyof typeof this.config.strategies];
    return strategyConfig?.ttl || this.config.redis.ttl;
  }

  private async getFromRedis<T>(key: string, strategy: CacheStrategy): Promise<T | null> {
    if (!this.redisClient) return null;

    try {
      const value = await this.redisClient.get(key);
      if (value) {
        return JSON.parse(value) as T;
      }
      return null;
    } catch (error) {
      logError(`Redis get error for key ${key}:`, error);
      return null;
    }
  }

  private async setInRedis<T>(key: string, value: T, strategy: CacheStrategy, ttl: number): Promise<boolean> {
    if (!this.redisClient) return false;

    try {
      const serializedValue = JSON.stringify(value);
      await this.redisClient.setex(key, ttl, serializedValue);
      return true;
    } catch (error) {
      logError(`Redis set error for key ${key}:`, error);
      return false;
    }
  }

  private getFromLocal<T>(key: string, strategy: CacheStrategy): T | null {
    if (!this.config.local.enabled) return null;
    return this.localCache.get<T>(key);
  }

  private setInLocal<T>(key: string, value: T, strategy: CacheStrategy, ttl: number): boolean {
    if (!this.config.local.enabled) return false;
    return this.localCache.set(key, value, ttl);
  }

  private updateResponseTime(responseTime: number): void {
    this.metrics.avgResponseTime = (this.metrics.avgResponseTime * (this.metrics.hits + this.metrics.misses - 1) + responseTime) / (this.metrics.hits + this.metrics.misses);
  }

  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }

  private async compressData(data: any): Promise<any> {
    // Simple compression - in real implementation, use proper compression library
    return JSON.stringify(data);
  }

  private async decompressData(data: any): Promise<any> {
    // Simple decompression - in real implementation, use proper decompression library
    return JSON.parse(data);
  }

  private async encryptData(data: any): Promise<any> {
    // Mock encryption - in real implementation, use proper encryption
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  private async decryptData(data: any): Promise<any> {
    // Mock decryption - in real implementation, use proper decryption
    return JSON.parse(Buffer.from(data, 'base64').toString());
  }

  private async anonymizePatientData(data: any): Promise<any> {
    // Simple anonymization - in real implementation, use proper anonymization
    const anonymized = { ...data };
    if (anonymized.email) anonymized.email = '***@***.***';
    if (anonymized.phone) anonymized.phone = '***-***-****';
    if (anonymized.address) anonymized.address = '*** *** ***';
    return anonymized;
  }

  private async personalizeVoiceCommands(commands: any[], userId: string): Promise<any[]> {
    // Simple personalization - in real implementation, use ML-based personalization
    return commands.map(cmd => ({
      ...cmd,
      personalized: true,
      userId
    }));
  }

  private async cleanupExpiredKeys(): Promise<void> {
    if (this.config.local.enabled) {
      this.localCache.flushAll();
    }
  }

  private async optimizeMemoryUsage(): Promise<void> {
    // Memory optimization logic
    if (this.config.local.enabled) {
      const keys = this.localCache.keys();
      if (keys.length > this.config.local.maxKeys * 0.9) {
        // Remove oldest entries
        const keysToRemove = keys.slice(0, Math.floor(keys.length * 0.1));
        keysToRemove.forEach(key => this.localCache.del(key));
      }
    }
  }

  private async updateCacheConfigurations(): Promise<void> {
    // Update cache configurations based on usage patterns
    const stats = this.getStats();
    
    if (stats.hitRate < 0.7) {
      // Increase TTL for frequently accessed items
      // This is a placeholder for actual adaptive logic
    }
  }

  private calculateImprovements(before: CacheStats, after: CacheStats): Record<string, number> {
    return {
      hitRate: after.hitRate - before.hitRate,
      memoryUsage: after.memoryUsage - before.memoryUsage,
      avgResponseTime: after.avgResponseTime - before.avgResponseTime
    };
  }
}

// Export singleton instance
export const cacheManager = new IntelligentCacheManager();

// Types
export type CacheStrategy = 
  | 'default'
  | 'transcription'
  | 'medicalData'
  | 'patientData'
  | 'voiceCommands'
  | 'clinicalSummaries';

export interface CacheMetrics {
  hits: number;
  misses: number;
  redisHits: number;
  redisMisses: number;
  localHits: number;
  localMisses: number;
  evictions: number;
  errors: number;
  avgResponseTime: number;
  memoryUsage: number;
  startTime: number;
  hitRate?: number;
  uptime?: number;
}

export interface CacheStats extends CacheMetrics {
  totalRequests: number;
  enabledStrategies: string[];
  redisConnected: boolean;
  localCacheKeys: number;
}

export interface OptimizationResult {
  success: boolean;
  duration: number;
  beforeStats: CacheStats;
  afterStats: CacheStats;
  improvements: Record<string, number>;
  error?: string;
}

// Helper functions for specific caching scenarios
export class MedicalCacheHelpers {
  static async cacheTranscriptionResult(
    audioHash: string,
    transcription: any,
    compress = true
  ): Promise<boolean> {
    return await cacheManager.cacheTranscription(audioHash, transcription, {
      compress,
      ttl: 3600 // 1 hour
    });
  }

  static async getCachedTranscription(audioHash: string): Promise<any | null> {
    return await cacheManager.getTranscription(audioHash);
  }

  static async cacheMedicalCodes(
    transcriptHash: string,
    codes: any[]
  ): Promise<boolean> {
    return await cacheManager.cacheMedicalData(`codes:${transcriptHash}`, codes, {
      ttl: 7200, // 2 hours
      encrypt: true
    });
  }

  static async getCachedMedicalCodes(transcriptHash: string): Promise<any[] | null> {
    return await cacheManager.getMedicalData(`codes:${transcriptHash}`);
  }

  static async cacheClinicalSummary(
    summaryId: string,
    summary: any
  ): Promise<boolean> {
    return await cacheManager.cacheClinicalSummary(summaryId, summary, {
      ttl: 86400, // 24 hours
      compress: true
    });
  }

  static async getCachedClinicalSummary(summaryId: string): Promise<any | null> {
    return await cacheManager.getClinicalSummary(summaryId);
  }

  static async cacheVoiceCommands(
    userId: string,
    commands: any[]
  ): Promise<boolean> {
    return await cacheManager.cacheVoiceCommands(userId, commands, {
      ttl: 7200, // 2 hours
      personalize: true
    });
  }

  static async getCachedVoiceCommands(userId: string): Promise<any[] | null> {
    return await cacheManager.getVoiceCommands(userId);
  }

  static async cachePatientIntakeData(
    patientId: string,
    intakeData: any
  ): Promise<boolean> {
    return await cacheManager.cachePatientData(patientId, intakeData, {
      ttl: 1800, // 30 minutes
      anonymize: true
    });
  }

  static async getCachedPatientIntakeData(patientId: string): Promise<any | null> {
    return await cacheManager.getPatientData(patientId);
  }
}