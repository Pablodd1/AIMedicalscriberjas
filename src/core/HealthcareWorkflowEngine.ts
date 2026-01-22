import { Workflow, WorkflowStep, PatientInfo, CheckInWorkflow, VoiceCommand } from '@/types'
import { ElementDetector } from '@/core/ElementDetector'

export class HealthcareWorkflowEngine {
  private elementDetector: ElementDetector
  private workflows: Map<string, Workflow>

  constructor() {
    this.elementDetector = new ElementDetector()
    this.workflows = new Map()
    this.initializeHealthcareWorkflows()
  }

  private initializeHealthcareWorkflows(): void {
    // Patient Search Workflow
    this.workflows.set('patient-search', {
      id: 'patient-search',
      name: 'Patient Search',
      description: 'Search for patient by name, DOB, or ID',
      category: 'healthcare',
      steps: [
        {
          id: 'focus-search-input',
          type: 'click',
          target: { tagName: 'input', type: 'search', ariaLabel: 'patient search' }
        },
        {
          id: 'enter-search-query',
          type: 'input',
          parameters: { 
            instruction: 'Please say the patient name, date of birth, or ID number',
            requireInput: true 
          }
        },
        {
          id: 'submit-search',
          type: 'click',
          target: { tagName: 'button', textContent: 'search' }
        },
        {
          id: 'wait-results',
          type: 'wait',
          timeout: 3000,
          parameters: { 
            instruction: 'Waiting for search results',
            successMessage: 'Patient found. Say "select" to choose the patient.'
          }
        }
      ],
      requiresConfirmation: false
    })

    // Patient Check-in Workflow
    this.workflows.set('patient-checkin', {
      id: 'patient-checkin',
      name: 'Patient Check-in',
      description: 'Complete patient check-in process',
      category: 'healthcare',
      steps: [
        {
          id: 'select-patient',
          type: 'click',
          target: { tagName: 'button', dataCommand: 'select-patient' },
          parameters: { 
            instruction: 'Please select the patient from the list',
            requireInput: true 
          }
        },
        {
          id: 'verify-appointment',
          type: 'condition',
          condition: {
            type: 'element_exists',
            expected: { tagName: 'div', textContent: 'appointment' }
          },
          nextStep: 'confirm-checkin'
        },
        {
          id: 'confirm-checkin',
          type: 'confirm',
          parameters: { 
            message: 'Please confirm patient check-in',
            requireInput: true 
          }
        },
        {
          id: 'check-insurance',
          type: 'condition',
          condition: {
            type: 'element_exists',
            expected: { tagName: 'button', textContent: 'verify insurance' }
          },
          nextStep: 'verify-insurance'
        },
        {
          id: 'verify-insurance',
          type: 'click',
          target: { tagName: 'button', textContent: 'verify insurance' },
          parameters: { 
            instruction: 'Verifying insurance. Please wait.',
            timeout: 5000
          }
        },
        {
          id: 'collect-copay',
          type: 'condition',
          condition: {
            type: 'element_exists',
            expected: { tagName: 'input', dataCommand: 'copay-amount' }
          },
          nextStep: 'process-copay'
        },
        {
          id: 'process-copay',
          type: 'input',
          target: { tagName: 'input', dataCommand: 'copay-amount' },
          parameters: { 
            instruction: 'Please say the copay amount',
            requireInput: true 
          }
        },
        {
          id: 'complete-checkin',
          type: 'click',
          target: { tagName: 'button', textContent: 'complete check-in' },
          parameters: { 
            successMessage: 'Patient check-in completed successfully',
            instruction: 'Check-in complete. Patient is now in the waiting room.'
          }
        }
      ],
      requiresConfirmation: true,
      rollbackSteps: [
        {
          id: 'undo-checkin',
          type: 'api',
          parameters: { endpoint: '/api/patient/undo-checkin', method: 'POST' }
        }
      ]
    })

    // Signature Collection Workflow
    this.workflows.set('collect-signature', {
      id: 'collect-signature',
      name: 'Collect Signature',
      description: 'Collect patient signature for consent forms',
      category: 'healthcare',
      steps: [
        {
          id: 'show-signature-form',
          type: 'click',
          target: { tagName: 'button', dataCommand: 'collect-signature' },
          parameters: { 
            instruction: 'Please review the consent form',
            requireInput: true 
          }
        },
        {
          id: 'confirm-consent',
          type: 'confirm',
          parameters: { 
            message: 'Do you consent to the terms and conditions? Say yes to continue.',
            requireInput: true 
          }
        },
        {
          id: 'activate-signature-pad',
          type: 'click',
          target: { tagName: 'canvas', dataCommand: 'signature-pad' },
          parameters: { 
            instruction: 'Signature pad activated. Please sign using your finger or stylus.',
            timeout: 60000
          }
        },
        {
          id: 'wait-signature',
          type: 'wait',
          timeout: 60000,
          parameters: { 
            instruction: 'Please sign in the signature area. Say "complete" when finished.',
            successMessage: 'Signature collected successfully'
          }
        },
        {
          id: 'save-signature',
          type: 'click',
          target: { tagName: 'button', textContent: 'save signature' },
          parameters: { 
            successMessage: 'Signature saved successfully'
          }
        }
      ],
      requiresConfirmation: true
    })

    // Insurance Verification Workflow
    this.workflows.set('verify-insurance', {
      id: 'verify-insurance',
      name: 'Verify Insurance',
      description: 'Verify patient insurance coverage',
      category: 'healthcare',
      steps: [
        {
          id: 'scan-insurance-card',
          type: 'click',
          target: { tagName: 'button', dataCommand: 'scan-insurance' },
          parameters: { 
            instruction: 'Please position your insurance card in front of the camera',
            timeout: 30000
          }
        },
        {
          id: 'process-insurance',
          type: 'wait',
          timeout: 5000,
          parameters: { 
            instruction: 'Processing insurance information. Please wait.',
            successMessage: 'Insurance card processed successfully'
          }
        },
        {
          id: 'verify-coverage',
          type: 'api',
          parameters: { 
            endpoint: '/api/insurance/verify',
            method: 'POST',
            successMessage: 'Insurance coverage verified'
          }
        },
        {
          id: 'show-coverage-details',
          type: 'click',
          target: { tagName: 'button', textContent: 'view coverage' },
          parameters: { 
            instruction: 'Here are your insurance coverage details',
            requireInput: true 
          }
        }
      ],
      requiresConfirmation: false
    })

    // Date of Birth Input Workflow
    this.workflows.set('input-dob', {
      id: 'input-dob',
      name: 'Input Date of Birth',
      description: 'Input patient date of birth',
      category: 'healthcare',
      steps: [
        {
          id: 'focus-dob-input',
          type: 'click',
          target: { tagName: 'input', dataCommand: 'dob-input' },
          parameters: { 
            instruction: 'Please say your date of birth in MM/DD/YYYY format'
          }
        },
        {
          id: 'enter-dob',
          type: 'input',
          target: { tagName: 'input', dataCommand: 'dob-input' },
          parameters: { 
            instruction: 'Please say your date of birth',
            pattern: '^\\d{2}/\\d{2}/\\d{4}$',
            errorMessage: 'Please say the date in MM/DD/YYYY format'
          }
        },
        {
          id: 'validate-dob',
          type: 'condition',
          condition: {
            type: 'api_response',
            expected: { valid: true }
          },
          nextStep: 'confirm-dob'
        },
        {
          id: 'confirm-dob',
          type: 'confirm',
          parameters: { 
            message: 'Please confirm your date of birth',
            requireInput: true 
          }
        }
      ],
      requiresConfirmation: true
    })
  }

  public getWorkflow(id: string): Workflow | undefined {
    return this.workflows.get(id)
  }

  public getAllWorkflows(): Workflow[] {
    return Array.from(this.workflows.values())
  }

  public executeWorkflow(workflowId: string, command: VoiceCommand): Promise<boolean> {
    const workflow = this.getWorkflow(workflowId)
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`)
    }

    return this.executeWorkflowSteps(workflow, command)
  }

  private async executeWorkflowSteps(workflow: Workflow, command: VoiceCommand): Promise<boolean> {
    let currentStep = workflow.steps[0]
    let stepIndex = 0

    try {
      while (currentStep) {
        const result = await this.executeStep(currentStep, command)
        
        if (result.success) {
          // Move to next step
          stepIndex++
          currentStep = workflow.steps[stepIndex]
          
          if (currentStep?.parameters?.successMessage) {
            this.speak(currentStep.parameters.successMessage)
          }
        } else if (result.nextStep) {
          // Move to specific step
          const nextStepIndex = workflow.steps.findIndex(step => step.id === result.nextStep)
          if (nextStepIndex !== -1) {
            stepIndex = nextStepIndex
            currentStep = workflow.steps[stepIndex]
          } else {
            throw new Error(`Next step ${result.nextStep} not found`)
          }
        } else {
          // Step failed
          throw new Error(result.error || `Step ${currentStep.id} failed`)
        }
      }

      return true
    } catch (error) {
      console.error('Workflow execution failed:', error)
      
      // Attempt rollback if available
      if (workflow.rollbackSteps && workflow.rollbackSteps.length > 0) {
        await this.executeRollbackSteps(workflow.rollbackSteps)
      }
      
      throw error
    }
  }

  private async executeStep(step: WorkflowStep, command: VoiceCommand): Promise<{
    success: boolean
    nextStep?: string
    error?: string
  }> {
    try {
      switch (step.type) {
        case 'click':
          return await this.executeClickStep(step)
        
        case 'input':
          return await this.executeInputStep(step, command)
        
        case 'wait':
          return await this.executeWaitStep(step)
        
        case 'confirm':
          return await this.executeConfirmStep(step, command)
        
        case 'api':
          return await this.executeApiStep(step)
        
        case 'condition':
          return await this.executeConditionStep(step)
        
        default:
          throw new Error(`Unknown step type: ${step.type}`)
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private async executeClickStep(step: WorkflowStep): Promise<{
    success: boolean
    error?: string
  }> {
    if (!step.target) {
      return { success: false, error: 'No target specified for click step' }
    }

    const elements = this.elementDetector.findElements(step.target)
    
    if (elements.length === 0) {
      return { success: false, error: `Target element not found: ${JSON.stringify(step.target)}` }
    }

    if (elements.length > 1) {
      console.warn(`Multiple elements found for target: ${JSON.stringify(step.target)}`)
    }

    const element = elements[0]
    
    if (!(element instanceof HTMLElement)) {
      return { success: false, error: 'Target element is not clickable' }
    }

    // Highlight element before clicking
    this.elementDetector.highlightElement(element, 1000)
    await this.delay(1000)

    // Click the element
    element.click()

    return { success: true }
  }

  private async executeInputStep(step: WorkflowStep, command: VoiceCommand): Promise<{
    success: boolean
    error?: string
  }> {
    const inputElement = step.target ? 
      this.elementDetector.findElements(step.target)[0] as HTMLInputElement :
      this.findFirstInputElement()

    if (!inputElement || !(inputElement instanceof HTMLInputElement)) {
      return { success: false, error: 'Input element not found' }
    }

    // Get input value from command or parameters
    let inputValue = step.parameters?.text || command.action
    
    // If pattern is specified, validate the input
    if (step.parameters?.pattern) {
      const pattern = new RegExp(step.parameters.pattern)
      if (!pattern.test(inputValue)) {
        return { 
          success: false, 
          error: step.parameters.errorMessage || 'Invalid input format' 
        }
      }
    }

    // Focus and enter value
    inputElement.focus()
    inputElement.value = inputValue
    
    // Dispatch events
    inputElement.dispatchEvent(new Event('input', { bubbles: true }))
    inputElement.dispatchEvent(new Event('change', { bubbles: true }))

    return { success: true }
  }

  private async executeWaitStep(step: WorkflowStep): Promise<{
    success: boolean
    error?: string
  }> {
    const timeout = step.timeout || 1000
    
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true })
      }, timeout)
    })
  }

  private async executeConfirmStep(step: WorkflowStep, command: VoiceCommand): Promise<{
    success: boolean
    error?: string
  }> {
    const message = step.parameters?.message || 'Please confirm this action'
    
    // Speak the confirmation message
    this.speak(message)
    
    // For voice commands, check if the user said "yes" or "confirm"
    const lowerAction = command.action.toLowerCase()
    const confirmed = lowerAction.includes('yes') || lowerAction.includes('confirm') || lowerAction.includes('okay')
    
    if (!confirmed && step.parameters?.requireInput) {
      return { success: false, error: 'Confirmation required' }
    }

    return { success: confirmed }
  }

  private async executeApiStep(step: WorkflowStep): Promise<{
    success: boolean
    error?: string
  }> {
    const { endpoint, method = 'GET', body } = step.parameters || {}
    
    if (!endpoint) {
      return { success: false, error: 'No API endpoint specified' }
    }

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      // Check condition if specified
      if (step.condition) {
        const conditionMet = this.checkCondition(data, step.condition)
        if (!conditionMet) {
          return { success: false, error: 'API condition not met' }
        }
      }

      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'API request failed' 
      }
    }
  }

  private async executeConditionStep(step: WorkflowStep): Promise<{
    success: boolean
    nextStep?: string
    error?: string
  }> {
    if (!step.condition) {
      return { success: false, error: 'No condition specified' }
    }

    const conditionMet = await this.evaluateCondition(step.condition)
    
    if (conditionMet && step.nextStep) {
      return { success: true, nextStep: step.nextStep }
    }

    return { success: conditionMet }
  }

  private async evaluateCondition(condition: WorkflowStep['condition']): Promise<boolean> {
    if (!condition) return false

    switch (condition.type) {
      case 'element_exists':
        if (!condition.expected) return false
        const elements = this.elementDetector.findElements(condition.expected)
        return elements.length > 0
      
      case 'text_matches':
        // Implementation for text matching
        return true
      
      case 'api_response':
        // Implementation for API response checking
        return true
      
      default:
        return false
    }
  }

  private checkCondition(data: any, condition: WorkflowStep['condition']): boolean {
    if (!condition || !condition.expected) return true
    
    // Simple implementation - extend as needed
    if (typeof condition.expected === 'object') {
      return JSON.stringify(data).includes(JSON.stringify(condition.expected))
    }
    
    return data === condition.expected
  }

  private async executeRollbackSteps(rollbackSteps: WorkflowStep[]): Promise<void> {
    console.log('Executing rollback steps...')
    
    for (const step of rollbackSteps) {
      try {
        await this.executeStep(step, { action: '', category: 'system' } as VoiceCommand)
      } catch (error) {
        console.error(`Rollback step ${step.id} failed:`, error)
      }
    }
  }

  private findFirstInputElement(): HTMLInputElement | null {
    const inputs = document.querySelectorAll('input[type="text"], input[type="search"], textarea')
    
    for (const input of inputs) {
      if (this.elementDetector.isElementVisible(input)) {
        return input as HTMLInputElement
      }
    }
    
    return null
  }

  private speak(text: string): void {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.9
      utterance.pitch = 1
      speechSynthesis.speak(utterance)
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  public generatePatientSearchWorkflow(patientInfo: Partial<PatientInfo>): Workflow {
    const steps: WorkflowStep[] = []

    if (patientInfo.firstName || patientInfo.lastName) {
      steps.push({
        id: 'search-by-name',
        type: 'input',
        target: { tagName: 'input', dataCommand: 'patient-name-search' },
        parameters: { 
          text: `${patientInfo.firstName || ''} ${patientInfo.lastName || ''}`.trim()
        }
      })
    }

    if (patientInfo.dateOfBirth) {
      steps.push({
        id: 'search-by-dob',
        type: 'input',
        target: { tagName: 'input', dataCommand: 'patient-dob-search' },
        parameters: { text: patientInfo.dateOfBirth }
      })
    }

    if (patientInfo.phoneNumber) {
      steps.push({
        id: 'search-by-phone',
        type: 'input',
        target: { tagName: 'input', dataCommand: 'patient-phone-search' },
        parameters: { text: patientInfo.phoneNumber }
      })
    }

    return {
      id: 'patient-search-custom',
      name: 'Patient Search',
      description: 'Search for patient with provided information',
      category: 'healthcare',
      steps,
      requiresConfirmation: false
    }
  }

  public generateCheckInWorkflow(checkInData: Partial<CheckInWorkflow>): Workflow {
    const steps: WorkflowStep[] = [
      {
        id: 'select-patient',
        type: 'click',
        target: { tagName: 'button', dataCommand: 'select-patient' }
      }
    ]

    if (checkInData.visitType) {
      steps.push({
        id: 'select-visit-type',
        type: 'click',
        target: { tagName: 'select', dataCommand: 'visit-type' },
        parameters: { text: checkInData.visitType }
      })
    }

    if (checkInData.copay && checkInData.copay > 0) {
      steps.push({
        id: 'enter-copay',
        type: 'input',
        target: { tagName: 'input', dataCommand: 'copay-amount' },
        parameters: { text: checkInData.copay.toString() }
      })
    }

    steps.push({
      id: 'complete-checkin',
      type: 'click',
      target: { tagName: 'button', textContent: 'complete check-in' },
      parameters: { 
        successMessage: 'Patient check-in completed successfully'
      }
    })

    return {
      id: 'patient-checkin-custom',
      name: 'Patient Check-in',
      description: 'Complete patient check-in with provided information',
      category: 'healthcare',
      steps,
      requiresConfirmation: true
    }
  }

  public destroy(): void {
    this.elementDetector.destroy()
    this.workflows.clear()
  }
}