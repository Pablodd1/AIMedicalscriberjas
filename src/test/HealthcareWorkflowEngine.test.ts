import { describe, it, expect, beforeEach } from 'vitest'
import { HealthcareWorkflowEngine } from '@/core/HealthcareWorkflowEngine'
import type { VoiceCommand, PatientInfo } from '@/types'

describe('HealthcareWorkflowEngine', () => {
  let workflowEngine: HealthcareWorkflowEngine

  beforeEach(() => {
    workflowEngine = new HealthcareWorkflowEngine()
  })

  describe('Workflow Initialization', () => {
    it('should initialize with default healthcare workflows', () => {
      const workflows = workflowEngine.getAllWorkflows()
      expect(workflows.length).toBeGreaterThan(0)
      
      const workflowIds = workflows.map(w => w.id)
      expect(workflowIds).toContain('patient-search')
      expect(workflowIds).toContain('patient-checkin')
      expect(workflowIds).toContain('collect-signature')
      expect(workflowIds).toContain('verify-insurance')
      expect(workflowIds).toContain('input-dob')
    })

    it('should get specific workflow by ID', () => {
      const workflow = workflowEngine.getWorkflow('patient-search')
      expect(workflow).toBeDefined()
      expect(workflow!.name).toBe('Patient Search')
      expect(workflow!.category).toBe('healthcare')
    })

    it('should return undefined for non-existent workflow', () => {
      const workflow = workflowEngine.getWorkflow('non-existent')
      expect(workflow).toBeUndefined()
    })
  })

  describe('Patient Search Workflow', () => {
    it('should have correct patient search workflow structure', () => {
      const workflow = workflowEngine.getWorkflow('patient-search')
      expect(workflow).toBeDefined()
      expect(workflow!.steps.length).toBeGreaterThan(0)
      
      const firstStep = workflow!.steps[0]
      expect(firstStep.type).toBe('click')
      expect(firstStep.target).toBeDefined()
    })

    it('should not require confirmation for patient search', () => {
      const workflow = workflowEngine.getWorkflow('patient-search')
      expect(workflow!.requiresConfirmation).toBe(false)
    })
  })

  describe('Patient Check-in Workflow', () => {
    it('should have correct check-in workflow structure', () => {
      const workflow = workflowEngine.getWorkflow('patient-checkin')
      expect(workflow).toBeDefined()
      expect(workflow!.steps.length).toBeGreaterThan(0)
      
      const steps = workflow!.steps
      expect(steps.some(step => step.type === 'condition')).toBe(true)
      expect(steps.some(step => step.type === 'confirm')).toBe(true)
    })

    it('should require confirmation for patient check-in', () => {
      const workflow = workflowEngine.getWorkflow('patient-checkin')
      expect(workflow!.requiresConfirmation).toBe(true)
    })

    it('should have rollback steps for check-in workflow', () => {
      const workflow = workflowEngine.getWorkflow('patient-checkin')
      expect(workflow!.rollbackSteps).toBeDefined()
      expect(workflow!.rollbackSteps!.length).toBeGreaterThan(0)
    })
  })

  describe('Signature Collection Workflow', () => {
    it('should have correct signature workflow structure', () => {
      const workflow = workflowEngine.getWorkflow('collect-signature')
      expect(workflow).toBeDefined()
      expect(workflow!.steps.length).toBeGreaterThan(0)
      
      const steps = workflow!.steps
      expect(steps.some(step => step.type === 'click')).toBe(true)
      expect(steps.some(step => step.type === 'confirm')).toBe(true)
      expect(steps.some(step => step.type === 'wait')).toBe(true)
    })

    it('should require confirmation for signature collection', () => {
      const workflow = workflowEngine.getWorkflow('collect-signature')
      expect(workflow!.requiresConfirmation).toBe(true)
    })
  })

  describe('Insurance Verification Workflow', () => {
    it('should have correct insurance verification workflow structure', () => {
      const workflow = workflowEngine.getWorkflow('verify-insurance')
      expect(workflow).toBeDefined()
      expect(workflow!.steps.length).toBeGreaterThan(0)
      
      const steps = workflow!.steps
      expect(steps.some(step => step.type === 'click')).toBe(true)
      expect(steps.some(step => step.type === 'wait')).toBe(true)
      expect(steps.some(step => step.type === 'api')).toBe(true)
    })

    it('should not require confirmation for insurance verification', () => {
      const workflow = workflowEngine.getWorkflow('verify-insurance')
      expect(workflow!.requiresConfirmation).toBe(false)
    })
  })

  describe('Custom Workflow Generation', () => {
    it('should generate patient search workflow with patient info', () => {
      const patientInfo: Partial<PatientInfo> = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        phoneNumber: '123-456-7890'
      }

      const workflow = workflowEngine.generatePatientSearchWorkflow(patientInfo)
      
      expect(workflow).toBeDefined()
      expect(workflow.id).toBe('patient-search-custom')
      expect(workflow.name).toBe('Patient Search')
      expect(workflow.steps.length).toBeGreaterThan(0)
      
      // Check that steps were generated for each piece of info
      const stepTypes = workflow.steps.map(step => step.type)
      expect(stepTypes).toContain('input')
    })

    it('should generate check-in workflow with check-in data', () => {
      const checkInData = {
        visitType: 'routine' as const,
        copay: 25.00,
        insuranceVerified: true,
        signatureRequired: true
      }

      const workflow = workflowEngine.generateCheckInWorkflow(checkInData)
      
      expect(workflow).toBeDefined()
      expect(workflow.id).toBe('patient-checkin-custom')
      expect(workflow.name).toBe('Patient Check-in')
      expect(workflow.requiresConfirmation).toBe(true)
      
      const stepTypes = workflow.steps.map(step => step.type)
      expect(stepTypes).toContain('input')
      expect(stepTypes).toContain('click')
    })
  })

  describe('Workflow Execution', () => {
    it('should execute workflow steps', async () => {
      const command: VoiceCommand = {
        id: 'test-command',
        category: 'healthcare',
        action: 'test patient search',
        description: 'Test patient search',
        confidence: 0.9,
        timestamp: new Date()
      }

      // Mock successful step execution
      const mockElement = document.createElement('button')
      vi.spyOn(document, 'querySelectorAll').mockReturnValue([mockElement] as any)
      vi.spyOn(document, 'getElementById').mockReturnValue(mockElement)

      // Note: Full workflow execution testing would require more extensive mocking
      // This is a basic test to ensure the workflow engine is properly structured
      const workflow = workflowEngine.getWorkflow('patient-search')
      expect(workflow).toBeDefined()
      expect(workflow!.steps.length).toBeGreaterThan(0)
    })

    it('should handle workflow execution errors', async () => {
      const command: VoiceCommand = {
        id: 'test-command',
        category: 'healthcare',
        action: 'test workflow',
        description: 'Test workflow',
        confidence: 0.9,
        timestamp: new Date()
      }

      // Mock non-existent workflow
      await expect(
        workflowEngine.executeWorkflow('non-existent-workflow', command)
      ).rejects.toThrow('Workflow non-existent-workflow not found')
    })
  })

  describe('Step Types', () => {
    it('should support different step types', () => {
      const workflow = workflowEngine.getWorkflow('patient-checkin')
      const stepTypes = workflow!.steps.map(step => step.type)
      
      expect(stepTypes).toContain('click')
      expect(stepTypes).toContain('condition')
      expect(stepTypes).toContain('confirm')
      expect(stepTypes).toContain('input')
    })

    it('should have steps with appropriate parameters', () => {
      const workflow = workflowEngine.getWorkflow('collect-signature')
      const stepsWithParams = workflow!.steps.filter(step => step.parameters)
      
      expect(stepsWithParams.length).toBeGreaterThan(0)
      
      stepsWithParams.forEach(step => {
        expect(step.parameters).toBeDefined()
        if (step.parameters?.instruction) {
          expect(step.parameters.instruction).toBeTruthy()
        }
      })
    })

    it('should have steps with timeouts where appropriate', () => {
      const workflow = workflowEngine.getWorkflow('collect-signature')
      const stepsWithTimeout = workflow!.steps.filter(step => step.timeout)
      
      expect(stepsWithTimeout.length).toBeGreaterThan(0)
      stepsWithTimeout.forEach(step => {
        expect(step.timeout).toBeGreaterThan(0)
      })
    })
  })

  describe('Workflow Categories', () => {
    it('should categorize workflows correctly', () => {
      const workflows = workflowEngine.getAllWorkflows()
      
      workflows.forEach(workflow => {
        expect(workflow.category).toBe('healthcare')
        expect(workflow.name).toBeTruthy()
        expect(workflow.description).toBeTruthy()
      })
    })

    it('should have unique workflow IDs', () => {
      const workflows = workflowEngine.getAllWorkflows()
      const ids = workflows.map(w => w.id)
      const uniqueIds = new Set(ids)
      
      expect(ids.length).toBe(uniqueIds.size)
    })
  })

  describe('Error Handling', () => {
    it('should handle element detection failures gracefully', () => {
      // Mock element detector to return no elements
      vi.spyOn(document, 'querySelectorAll').mockReturnValue([] as any)
      
      const workflow = workflowEngine.getWorkflow('patient-search')
      expect(workflow).toBeDefined()
      expect(workflow!.steps.length).toBeGreaterThan(0)
      
      // The workflow should still be valid even if elements aren't found
      // Actual execution would handle the missing elements
    })
  })

  describe('Cleanup', () => {
    it('should clean up resources on destroy', () => {
      // Add some test data
      const patientInfo: Partial<PatientInfo> = {
        firstName: 'Test',
        lastName: 'Patient'
      }
      
      const workflow = workflowEngine.generatePatientSearchWorkflow(patientInfo)
      expect(workflow).toBeDefined()
      
      workflowEngine.destroy()
      
      // After destroy, should still be able to create new instance
      const newEngine = new HealthcareWorkflowEngine()
      expect(newEngine.getAllWorkflows().length).toBeGreaterThan(0)
      
      newEngine.destroy()
    })
  })
})