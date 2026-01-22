import { describe, it, expect, beforeEach } from 'vitest'
import { NaturalLanguageProcessor } from '@/core/NaturalLanguageProcessor'
import type { VoiceCommand, CommandCategory } from '@/types'

describe('NaturalLanguageProcessor', () => {
  let processor: NaturalLanguageProcessor

  beforeEach(() => {
    processor = new NaturalLanguageProcessor()
  })

  describe('Command Parsing', () => {
    it('should parse navigation commands', () => {
      const transcript = 'go to patient search'
      const command = processor.parseCommand(transcript, 0.85)
      
      expect(command).not.toBeNull()
      expect(command!.category).toBe('navigation')
      expect(command!.action).toBe('patient search')
      expect(command!.confidence).toBe(0.85)
    })

    it('should parse healthcare commands', () => {
      const transcript = 'search patient john doe'
      const command = processor.parseCommand(transcript, 0.9)
      
      expect(command).not.toBeNull()
      expect(command!.category).toBe('healthcare')
      expect(command!.action).toBe('patient john doe')
    })

    it('should parse UI action commands', () => {
      const transcript = 'click submit button'
      const command = processor.parseCommand(transcript, 0.8)
      
      expect(command).not.toBeNull()
      expect(command!.category).toBe('ui-action')
      expect(command!.action).toBe('submit button')
    })

    it('should return null for unrecognized commands', () => {
      const transcript = 'random gibberish text'
      const command = processor.parseCommand(transcript, 0.7)
      
      expect(command).toBeNull()
    })

    it('should extract entities from commands', () => {
      const transcript = 'search patient john smith born on 1990-01-01'
      const command = processor.parseCommand(transcript, 0.9)
      
      expect(command).not.toBeNull()
      expect(command!.entities).toBeDefined()
      expect(command!.entities!.dates).toContain('1990-01-01')
    })
  })

  describe('Element Detection', () => {
    it('should generate element descriptors for navigation', () => {
      const descriptors = processor.findElementDescriptors('patient search')
      
      expect(descriptors.length).toBeGreaterThan(0)
      expect(descriptors[0].tagName).toBe('button')
      expect(descriptors[0].textContent).toBe('patient search')
    })

    it('should generate healthcare-specific descriptors', () => {
      const descriptors = processor.findElementDescriptors('signature')
      
      expect(descriptors.some(d => d.dataCommand === 'signature-pad')).toBe(true)
    })

    it('should generate check-in descriptors', () => {
      const descriptors = processor.findElementDescriptors('check in')
      
      expect(descriptors.some(d => d.dataCommand === 'patient-checkin')).toBe(true)
    })
  })

  describe('Synonym Expansion', () => {
    it('should expand synonyms correctly', () => {
      const text = 'press the button'
      const expanded = processor.expandSynonyms(text)
      
      expect(expanded).toBe('click the button')
    })

    it('should handle multiple synonyms', () => {
      const text = 'tap the client search'
      const expanded = processor.expandSynonyms(text)
      
      expect(expanded).toBe('click the patient search')
    })
  })

  describe('Fuzzy Matching', () => {
    it('should match exact text', () => {
      const result = processor.fuzzyMatch('patient search', 'patient search')
      expect(result).toBe(true)
    })

    it('should match contained text', () => {
      const result = processor.fuzzyMatch('patient search button', 'patient search')
      expect(result).toBe(true)
    })

    it('should match with fuzzy distance', () => {
      const result = processor.fuzzyMatch('patent search', 'patient search', 0.7)
      expect(result).toBe(true)
    })

    it('should not match very different text', () => {
      const result = processor.fuzzyMatch('completely different', 'patient search', 0.7)
      expect(result).toBe(false)
    })
  })

  describe('Patient Info Parsing', () => {
    it('should extract patient name', () => {
      const transcript = 'patient john smith'
      const info = processor.parsePatientInfo(transcript)
      
      expect(info.firstName).toBe('john')
      expect(info.lastName).toBe('smith')
    })

    it('should extract date of birth', () => {
      const transcript = 'date of birth 1990-01-01'
      const info = processor.parsePatientInfo(transcript)
      
      expect(info.dateOfBirth).toBe('1990-01-01')
    })

    it('should extract phone number', () => {
      const transcript = 'phone number 123-456-7890'
      const info = processor.parsePatientInfo(transcript)
      
      expect(info.phoneNumber).toBe('123-456-7890')
    })
  })

  describe('Healthcare Workflow Generation', () => {
    it('should generate patient search workflow', () => {
      const command: VoiceCommand = {
        id: 'test',
        category: 'healthcare',
        action: 'patient search john doe',
        description: 'Patient search',
        confidence: 0.9,
        timestamp: new Date()
      }
      
      const workflow = processor.generateHealthcareWorkflow(command)
      
      expect(workflow).not.toBeNull()
      expect(workflow!.id).toBe('patient-search')
      expect(workflow!.steps.length).toBeGreaterThan(0)
    })

    it('should generate check-in workflow', () => {
      const command: VoiceCommand = {
        id: 'test',
        category: 'healthcare',
        action: 'patient check in',
        description: 'Patient check-in',
        confidence: 0.9,
        timestamp: new Date()
      }
      
      const workflow = processor.generateHealthcareWorkflow(command)
      
      expect(workflow).not.toBeNull()
      expect(workflow!.id).toBe('patient-checkin')
    })

    it('should generate signature workflow', () => {
      const command: VoiceCommand = {
        id: 'test',
        category: 'healthcare',
        action: 'collect signature',
        description: 'Collect signature',
        confidence: 0.9,
        timestamp: new Date()
      }
      
      const workflow = processor.generateHealthcareWorkflow(command)
      
      expect(workflow).not.toBeNull()
      expect(workflow!.id).toBe('collect-signature')
    })
  })

  describe('Command Categories', () => {
    it('should categorize navigation commands', () => {
      const commands = [
        'go to patient search',
        'open dashboard',
        'navigate to settings',
        'back',
        'home'
      ]

      commands.forEach(cmd => {
        const result = processor.parseCommand(cmd, 0.8)
        expect(result).not.toBeNull()
        expect(result!.category).toBe('navigation')
      })
    })

    it('should categorize accessibility commands', () => {
      const commands = [
        'read this page',
        'describe current screen',
        'what can I do here',
        'list commands',
        'help'
      ]

      commands.forEach(cmd => {
        const result = processor.parseCommand(cmd, 0.8)
        expect(result).not.toBeNull()
        expect(result!.category).toBe('accessibility')
      })
    })

    it('should categorize system commands', () => {
      const commands = [
        'sleep',
        'stop listening',
        'mute',
        'unmute',
        'repeat last action'
      ]

      commands.forEach(cmd => {
        const result = processor.parseCommand(cmd, 0.8)
        expect(result).not.toBeNull()
        expect(result!.category).toBe('system')
      })
    })
  })
})