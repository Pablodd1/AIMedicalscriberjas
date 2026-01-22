import { SecurityConfig, VoiceCommand } from '@/types'

export class SecurityManager {
  private config: SecurityConfig
  private encryptionKey: CryptoKey | null = null
  private audioBuffer: ArrayBuffer[] = []
  private maxBufferSize = 100
  private sessionId: string
  private userPermissions: Set<string>

  constructor(config: SecurityConfig) {
    this.config = config
    this.sessionId = this.generateSessionId()
    this.userPermissions = new Set()
    this.initializeEncryption()
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private async initializeEncryption(): Promise<void> {
    if (this.config.encryptAudio && window.crypto && window.crypto.subtle) {
      try {
        this.encryptionKey = await window.crypto.subtle.generateKey(
          {
            name: 'AES-GCM',
            length: 256
          },
          true,
          ['encrypt', 'decrypt']
        )
      } catch (error) {
        console.warn('Failed to initialize encryption:', error)
      }
    }
  }

  public async encryptAudio(audioData: ArrayBuffer): Promise<ArrayBuffer> {
    if (!this.config.encryptAudio || !this.encryptionKey) {
      return audioData
    }

    try {
      const iv = window.crypto.getRandomValues(new Uint8Array(12))
      const encrypted = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        this.encryptionKey,
        audioData
      )

      // Combine IV and encrypted data
      const result = new Uint8Array(iv.length + encrypted.byteLength)
      result.set(iv, 0)
      result.set(new Uint8Array(encrypted), iv.length)

      return result.buffer
    } catch (error) {
      console.warn('Encryption failed, returning original data:', error)
      return audioData
    }
  }

  public async decryptAudio(encryptedData: ArrayBuffer): Promise<ArrayBuffer> {
    if (!this.config.encryptAudio || !this.encryptionKey) {
      return encryptedData
    }

    try {
      const data = new Uint8Array(encryptedData)
      const iv = data.slice(0, 12)
      const encrypted = data.slice(12)

      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        this.encryptionKey,
        encrypted
      )

      return decrypted
    } catch (error) {
      console.warn('Decryption failed:', error)
      return encryptedData
    }
  }

  public isSensitiveAction(command: VoiceCommand): boolean {
    const sensitivePatterns = [
      /delete/i,
      /remove/i,
      /cancel.*appointment/i,
      /update.*insurance/i,
      /change.*personal/i,
      /export.*data/i,
      /download.*record/i,
      /share.*information/i,
      /access.*medical/i
    ]

    const action = command.action.toLowerCase()
    
    return sensitivePatterns.some(pattern => pattern.test(action)) ||
           this.config.sensitiveActions.includes(command.category) ||
           this.config.sensitiveActions.includes(command.action)
  }

  public requiresConfirmation(command: VoiceCommand): boolean {
    if (this.config.confirmationRequired) return true
    
    // Always require confirmation for sensitive actions
    if (this.isSensitiveAction(command)) return true
    
    // Check for financial commands
    const financialPatterns = [
      /payment/i,
      /charge/i,
      /bill/i,
      /copay/i,
      /insurance.*verify/i
    ]
    
    const action = command.action.toLowerCase()
    return financialPatterns.some(pattern => pattern.test(action))
  }

  public validateUserPermissions(command: VoiceCommand): boolean {
    if (!this.config.requireAuthentication) return true
    
    const requiredPermission = this.getRequiredPermission(command)
    return this.userPermissions.has(requiredPermission)
  }

  private getRequiredPermission(command: VoiceCommand): string {
    const permissionMap: Record<string, string> = {
      'healthcare': 'healthcare_access',
      'patient-management': 'patient_management',
      'financial': 'financial_access',
      'admin': 'admin_access',
      'export': 'data_export',
      'delete': 'data_deletion'
    }
    
    return permissionMap[command.category] || 'basic_access'
  }

  public logSecurityEvent(event: {
    type: 'command_executed' | 'permission_denied' | 'encryption_failed' | 'sensitive_action'
    command?: VoiceCommand
    details?: Record<string, any>
    timestamp?: Date
  }): void {
    const securityEvent = {
      ...event,
      sessionId: this.sessionId,
      timestamp: event.timestamp || new Date()
    }

    // Store in local storage for audit trail
    const events = this.getSecurityEvents()
    events.push(securityEvent)
    
    // Keep only recent events (last 100)
    const recentEvents = events.slice(-100)
    localStorage.setItem('voice_control_security_events', JSON.stringify(recentEvents))

    // Log to console for debugging
    console.log('Security Event:', securityEvent)
  }

  public getSecurityEvents(): any[] {
    try {
      const stored = localStorage.getItem('voice_control_security_events')
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.warn('Failed to retrieve security events:', error)
      return []
    }
  }

  public clearSecurityEvents(): void {
    localStorage.removeItem('voice_control_security_events')
  }

  public addUserPermission(permission: string): void {
    this.userPermissions.add(permission)
  }

  public removeUserPermission(permission: string): void {
    this.userPermissions.delete(permission)
  }

  public hasPermission(permission: string): boolean {
    return this.userPermissions.has(permission)
  }

  public getUserPermissions(): string[] {
    return Array.from(this.userPermissions)
  }

  public anonymizeTranscript(transcript: string): string {
    // Remove PII (Personally Identifiable Information)
    const anonymized = transcript
      // Remove phone numbers
      .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]')
      // Remove email addresses
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
      // Remove social security numbers
      .replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, '[SSN]')
      // Remove dates of birth
      .replace(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g, '[DOB]')
      // Remove patient IDs
      .replace(/\bpatient\s+id\s*[:#]?\s*[A-Z0-9]+\b/gi, '[PATIENT_ID]')
      // Remove medical record numbers
      .replace(/\bMRN\s*[:#]?\s*[A-Z0-9]+\b/gi, '[MRN]')
    
    return anonymized
  }

  public hashTranscript(transcript: string): string {
    // Simple hash function for transcript comparison
    let hash = 0
    for (let i = 0; i < transcript.length; i++) {
      const char = transcript.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }

  public validateDataRetention(): void {
    if (this.config.dataRetentionDays <= 0) return
    
    const retentionTime = this.config.dataRetentionDays * 24 * 60 * 60 * 1000 // Convert to milliseconds
    const now = Date.now()
    
    const events = this.getSecurityEvents()
    const validEvents = events.filter(event => {
      const eventTime = new Date(event.timestamp).getTime()
      return (now - eventTime) <= retentionTime
    })
    
    if (validEvents.length < events.length) {
      localStorage.setItem('voice_control_security_events', JSON.stringify(validEvents))
      console.log(`Cleaned up ${events.length - validEvents.length} old security events`)
    }
  }

  public generateAuditTrail(): string {
    const events = this.getSecurityEvents()
    const auditLines = [
      'Voice Control Security Audit Trail',
      `Generated: ${new Date().toISOString()}`,
      `Session ID: ${this.sessionId}`,
      `User Permissions: ${Array.from(this.userPermissions).join(', ')}`,
      '',
      'Events:'
    ]

    events.forEach((event, index) => {
      auditLines.push(`\n${index + 1}. ${event.type}`)
      auditLines.push(`   Timestamp: ${event.timestamp}`)
      auditLines.push(`   Session ID: ${event.sessionId}`)
      
      if (event.command) {
        auditLines.push(`   Command: ${event.command.action}`)
        auditLines.push(`   Category: ${event.command.category}`)
        auditLines.push(`   Confidence: ${event.command.confidence}`)
      }
      
      if (event.details) {
        auditLines.push(`   Details: ${JSON.stringify(event.details, null, 2)}`)
      }
    })

    return auditLines.join('\n')
  }

  public exportAuditTrail(): void {
    const auditTrail = this.generateAuditTrail()
    const blob = new Blob([auditTrail], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `voice-control-audit-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  public getSessionId(): string {
    return this.sessionId
  }

  public updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    // Reinitialize encryption if needed
    if (newConfig.encryptAudio !== undefined) {
      this.initializeEncryption()
    }
    
    // Validate data retention if changed
    if (newConfig.dataRetentionDays !== undefined) {
      this.validateDataRetention()
    }
  }

  public destroy(): void {
    this.clearSecurityEvents()
    this.userPermissions.clear()
    this.audioBuffer = []
  }
}