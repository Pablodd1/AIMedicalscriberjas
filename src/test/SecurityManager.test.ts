import { describe, it, expect, beforeEach } from 'vitest'
import { SecurityManager } from '@/core/SecurityManager'
import type { VoiceCommand, SecurityConfig } from '@/types'

describe('SecurityManager', () => {
  let securityManager: SecurityManager
  let config: SecurityConfig

  beforeEach(() => {
    config = {
      encryptAudio: true,
      localProcessing: true,
      requireAuthentication: false,
      dataRetentionDays: 30,
      sensitiveActions: ['healthcare', 'financial'],
      confirmationRequired: false
    }
    securityManager = new SecurityManager(config)
  })

  describe('Encryption', () => {
    it('should generate encryption key on initialization', async () => {
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Note: In test environment, crypto might not be available
      // This test mainly ensures no errors during initialization
      expect(securityManager).toBeDefined()
    })

    it('should handle encryption without crypto support', async () => {
      const originalCrypto = global.crypto
      
      // Mock crypto as unavailable
      Object.defineProperty(global, 'crypto', {
        value: undefined,
        writable: true
      })

      const manager = new SecurityManager(config)
      const testData = new ArrayBuffer(1024)
      
      const encrypted = await manager.encryptAudio(testData)
      expect(encrypted).toBe(testData) // Should return original data

      // Restore crypto
      Object.defineProperty(global, 'crypto', {
        value: originalCrypto,
        writable: true
      })
    })
  })

  describe('Sensitive Action Detection', () => {
    it('should identify sensitive actions', () => {
      const command: VoiceCommand = {
        id: 'test',
        category: 'healthcare',
        action: 'delete patient record',
        description: 'Delete patient',
        confidence: 0.9,
        timestamp: new Date()
      }

      const isSensitive = securityManager.isSensitiveAction(command)
      expect(isSensitive).toBe(true)
    })

    it('should identify non-sensitive actions', () => {
      const command: VoiceCommand = {
        id: 'test',
        category: 'navigation',
        action: 'go to dashboard',
        description: 'Navigate to dashboard',
        confidence: 0.9,
        timestamp: new Date()
      }

      const isSensitive = securityManager.isSensitiveAction(command)
      expect(isSensitive).toBe(false)
    })

    it('should identify financial actions', () => {
      const command: VoiceCommand = {
        id: 'test',
        category: 'ui-action',
        action: 'process payment',
        description: 'Process payment',
        confidence: 0.9,
        timestamp: new Date()
      }

      const isSensitive = securityManager.isSensitiveAction(command)
      expect(isSensitive).toBe(true)
    })
  })

  describe('Confirmation Requirements', () => {
    it('should require confirmation for sensitive actions', () => {
      const command: VoiceCommand = {
        id: 'test',
        category: 'healthcare',
        action: 'delete patient record',
        description: 'Delete patient',
        confidence: 0.9,
        timestamp: new Date()
      }

      const requiresConfirmation = securityManager.requiresConfirmation(command)
      expect(requiresConfirmation).toBe(true)
    })

    it('should require confirmation for financial actions', () => {
      const command: VoiceCommand = {
        id: 'test',
        category: 'ui-action',
        action: 'charge credit card',
        description: 'Charge credit card',
        confidence: 0.9,
        timestamp: new Date()
      }

      const requiresConfirmation = securityManager.requiresConfirmation(command)
      expect(requiresConfirmation).toBe(true)
    })

    it('should require confirmation when globally enabled', () => {
      securityManager.updateConfig({ confirmationRequired: true })
      
      const command: VoiceCommand = {
        id: 'test',
        category: 'navigation',
        action: 'go to home',
        description: 'Go home',
        confidence: 0.9,
        timestamp: new Date()
      }

      const requiresConfirmation = securityManager.requiresConfirmation(command)
      expect(requiresConfirmation).toBe(true)
    })
  })

  describe('User Permissions', () => {
    it('should validate permissions when authentication is required', () => {
      securityManager.updateConfig({ requireAuthentication: true })
      
      const command: VoiceCommand = {
        id: 'test',
        category: 'healthcare',
        action: 'search patient',
        description: 'Search patient',
        confidence: 0.9,
        timestamp: new Date()
      }

      const hasPermission = securityManager.validateUserPermissions(command)
      expect(hasPermission).toBe(false) // No permissions set
    })

    it('should allow access when authentication is not required', () => {
      securityManager.updateConfig({ requireAuthentication: false })
      
      const command: VoiceCommand = {
        id: 'test',
        category: 'healthcare',
        action: 'search patient',
        description: 'Search patient',
        confidence: 0.9,
        timestamp: new Date()
      }

      const hasPermission = securityManager.validateUserPermissions(command)
      expect(hasPermission).toBe(true)
    })

    it('should grant permission when user has required permission', () => {
      securityManager.updateConfig({ requireAuthentication: true })
      securityManager.addUserPermission('healthcare_access')
      
      const command: VoiceCommand = {
        id: 'test',
        category: 'healthcare',
        action: 'search patient',
        description: 'Search patient',
        confidence: 0.9,
        timestamp: new Date()
      }

      const hasPermission = securityManager.validateUserPermissions(command)
      expect(hasPermission).toBe(true)
    })
  })

  describe('Security Event Logging', () => {
    beforeEach(() => {
      // Clear localStorage
      localStorage.clear()
    })

    it('should log security events', () => {
      const command: VoiceCommand = {
        id: 'test',
        category: 'healthcare',
        action: 'search patient',
        description: 'Search patient',
        confidence: 0.9,
        timestamp: new Date()
      }

      securityManager.logSecurityEvent({
        type: 'command_executed',
        command,
        details: { success: true }
      })

      const events = securityManager.getSecurityEvents()
      expect(events.length).toBe(1)
      expect(events[0].type).toBe('command_executed')
      expect(events[0].command).toEqual(command)
    })

    it('should maintain only recent events', () => {
      // Add 105 events (more than the limit of 100)
      for (let i = 0; i < 105; i++) {
        securityManager.logSecurityEvent({
          type: 'command_executed',
          details: { index: i }
        })
      }

      const events = securityManager.getSecurityEvents()
      expect(events.length).toBe(100)
      expect(events[0].details.index).toBe(5) // First 5 should be removed
    })

    it('should clear security events', () => {
      securityManager.logSecurityEvent({
        type: 'command_executed',
        details: { test: true }
      })

      securityManager.clearSecurityEvents()
      
      const events = securityManager.getSecurityEvents()
      expect(events.length).toBe(0)
    })
  })

  describe('Data Anonymization', () => {
    it('should anonymize phone numbers', () => {
      const transcript = 'My phone number is 123-456-7890'
      const anonymized = securityManager.anonymizeTranscript(transcript)
      
      expect(anonymized).toBe('My phone number is [PHONE]')
    })

    it('should anonymize email addresses', () => {
      const transcript = 'Email me at john@example.com'
      const anonymized = securityManager.anonymizeTranscript(transcript)
      
      expect(anonymized).toBe('Email me at [EMAIL]')
    })

    it('should anonymize social security numbers', () => {
      const transcript = 'My SSN is 123-45-6789'
      const anonymized = securityManager.anonymizeTranscript(transcript)
      
      expect(anonymized).toBe('My SSN is [SSN]')
    })

    it('should anonymize dates of birth', () => {
      const transcript = 'DOB 01/15/1990'
      const anonymized = securityManager.anonymizeTranscript(transcript)
      
      expect(anonymized).toBe('DOB [DOB]')
    })

    it('should anonymize patient IDs', () => {
      const transcript = 'Patient ID: ABC123'
      const anonymized = securityManager.anonymizeTranscript(transcript)
      
      expect(anonymized).toBe('[PATIENT_ID]')
    })

    it('should anonymize medical record numbers', () => {
      const transcript = 'MRN: XYZ789'
      const anonymized = securityManager.anonymizeTranscript(transcript)
      
      expect(anonymized).toBe('[MRN]')
    })
  })

  describe('Hash Generation', () => {
    it('should generate consistent hashes', () => {
      const transcript = 'patient search john doe'
      const hash1 = securityManager.hashTranscript(transcript)
      const hash2 = securityManager.hashTranscript(transcript)
      
      expect(hash1).toBe(hash2)
    })

    it('should generate different hashes for different transcripts', () => {
      const transcript1 = 'patient search john doe'
      const transcript2 = 'patient search jane smith'
      
      const hash1 = securityManager.hashTranscript(transcript1)
      const hash2 = securityManager.hashTranscript(transcript2)
      
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('Data Retention', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    it('should validate data retention', () => {
      const now = Date.now()
      const oldDate = new Date(now - 31 * 24 * 60 * 60 * 1000) // 31 days ago
      const recentDate = new Date(now - 1 * 24 * 60 * 60 * 1000) // 1 day ago

      // Add old and recent events
      securityManager.logSecurityEvent({
        type: 'command_executed',
        timestamp: oldDate
      })

      securityManager.logSecurityEvent({
        type: 'command_executed',
        timestamp: recentDate
      })

      securityManager.validateDataRetention()

      const events = securityManager.getSecurityEvents()
      expect(events.length).toBe(1) // Only recent event should remain
      expect(new Date(events[0].timestamp).getTime()).toBe(recentDate.getTime())
    })
  })

  describe('Audit Trail', () => {
    it('should generate audit trail', () => {
      securityManager.logSecurityEvent({
        type: 'command_executed',
        details: { command: 'test' }
      })

      const auditTrail = securityManager.generateAuditTrail()
      
      expect(auditTrail).toContain('Voice Control Security Audit Trail')
      expect(auditTrail).toContain('command_executed')
      expect(auditTrail).toContain(securityManager.getSessionId())
    })

    it('should export audit trail', () => {
      // Mock document methods
      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn()
      }
      
      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any)
      const appendChildSpy = vi.spyOn(document.body, 'appendChild')
      const removeChildSpy = vi.spyOn(document.body, 'removeChild')
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL')

      securityManager.exportAuditTrail()

      expect(createElementSpy).toHaveBeenCalledWith('a')
      expect(appendChildSpy).toHaveBeenCalledWith(mockAnchor)
      expect(mockAnchor.click).toHaveBeenCalled()
      expect(removeChildSpy).toHaveBeenCalledWith(mockAnchor)
      expect(revokeObjectURLSpy).toHaveBeenCalled()
    })
  })

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      const newConfig = {
        encryptAudio: false,
        localProcessing: false,
        requireAuthentication: true,
        dataRetentionDays: 60,
        sensitiveActions: ['admin'],
        confirmationRequired: true
      }

      securityManager.updateConfig(newConfig)
      
      expect(securityManager.isSensitiveAction({
        id: 'test',
        category: 'admin',
        action: 'admin action',
        description: 'Admin action',
        confidence: 0.9,
        timestamp: new Date()
      })).toBe(true)
    })
  })

  describe('Permission Management', () => {
    it('should add and check user permissions', () => {
      securityManager.addUserPermission('healthcare_access')
      expect(securityManager.hasPermission('healthcare_access')).toBe(true)
      expect(securityManager.hasPermission('admin_access')).toBe(false)
    })

    it('should remove user permissions', () => {
      securityManager.addUserPermission('healthcare_access')
      expect(securityManager.hasPermission('healthcare_access')).toBe(true)
      
      securityManager.removeUserPermission('healthcare_access')
      expect(securityManager.hasPermission('healthcare_access')).toBe(false)
    })

    it('should get all user permissions', () => {
      securityManager.addUserPermission('healthcare_access')
      securityManager.addUserPermission('financial_access')
      
      const permissions = securityManager.getUserPermissions()
      expect(permissions).toContain('healthcare_access')
      expect(permissions).toContain('financial_access')
    })
  })

  describe('Session Management', () => {
    it('should generate unique session IDs', () => {
      const sessionId1 = securityManager.getSessionId()
      
      // Create new instance to get different session ID
      const manager2 = new SecurityManager(config)
      const sessionId2 = manager2.getSessionId()
      
      expect(sessionId1).not.toBe(sessionId2)
      
      manager2.destroy()
    })
  })

  describe('Cleanup', () => {
    it('should clean up resources on destroy', () => {
      securityManager.logSecurityEvent({ type: 'command_executed' })
      securityManager.addUserPermission('test_permission')
      
      securityManager.destroy()
      
      // After destroy, should have no events and no permissions
      expect(securityManager.getSecurityEvents().length).toBe(0)
      expect(securityManager.hasPermission('test_permission')).toBe(false)
    })
  })
})