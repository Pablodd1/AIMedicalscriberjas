import { ElementDetector } from './ElementDetector'
import { VoiceCommand, ElementDescriptor, ErrorHandler } from '@/types'

export class ActionExecutor {
  private elementDetector: ElementDetector
  private isExecuting = false

  constructor() {
    this.elementDetector = new ElementDetector()
  }

  public async executeCommand(command: VoiceCommand): Promise<boolean> {
    if (this.isExecuting) {
      throw new Error('Another command is already being executed')
    }

    this.isExecuting = true
    
    try {
      const success = await this.performAction(command)
      return success
    } catch (error) {
      console.error('Command execution failed:', error)
      throw this.createError(error, command)
    } finally {
      this.isExecuting = false
    }
  }

  private async performAction(command: VoiceCommand): Promise<boolean> {
    const { category, action } = command

    switch (category) {
      case 'navigation':
        return await this.handleNavigation(action)
      
      case 'ui-action':
        return await this.handleUiAction(action, command.entities)
      
      case 'healthcare':
        return await this.handleHealthcareAction(action, command.entities)
      
      case 'workflow':
        return await this.handleWorkflow(action)
      
      case 'accessibility':
        return await this.handleAccessibility(action)
      
      case 'system':
        return await this.handleSystemAction(action)
      
      default:
        throw new Error(`Unknown command category: ${category}`)
    }
  }

  private async handleNavigation(action: string): Promise<boolean> {
    const lowerAction = action.toLowerCase()

    // Handle back navigation
    if (lowerAction.includes('back') || lowerAction.includes('previous')) {
      window.history.back()
      return true
    }

    // Handle home/dashboard navigation
    if (lowerAction.includes('home') || lowerAction.includes('dashboard')) {
      window.location.href = '/'
      return true
    }

    // Handle refresh
    if (lowerAction.includes('refresh') || lowerAction.includes('reload')) {
      window.location.reload()
      return true
    }

    // Handle scroll commands
    const scrollMatch = lowerAction.match(/scroll (up|down|top|bottom)/)
    if (scrollMatch) {
      const direction = scrollMatch[1]
      this.handleScroll(direction)
      return true
    }

    // Handle page navigation
    const pageMatch = lowerAction.match(/(?:go to|open|navigate to|show me|take me to) (.+)/)
    if (pageMatch) {
      const pageName = pageMatch[1].trim()
      return await this.navigateToPage(pageName)
    }

    return false
  }

  private async handleUiAction(action: string, entities?: Record<string, any>): Promise<boolean> {
    const lowerAction = action.toLowerCase()

    // Handle click actions
    const clickMatch = lowerAction.match(/(?:click|press|tap|select|choose) (.+)/)
    if (clickMatch) {
      const elementName = clickMatch[1].trim()
      return await this.clickElement(elementName)
    }

    // Handle form submission
    if (lowerAction.includes('submit') || lowerAction.includes('send')) {
      return await this.submitForm()
    }

    // Handle confirmation
    if (lowerAction.includes('confirm') || lowerAction.includes('yes') || lowerAction.includes('okay')) {
      return await this.confirmAction()
    }

    // Handle cancellation
    if (lowerAction.includes('cancel') || lowerAction.includes('no') || lowerAction.includes('close')) {
      return await this.cancelAction()
    }

    // Handle search
    const searchMatch = lowerAction.match(/search for (.+)/)
    if (searchMatch) {
      const query = searchMatch[1].trim()
      return await this.performSearch(query)
    }

    // Handle expand/collapse
    const expandMatch = lowerAction.match(/expand (.+)/)
    if (expandMatch) {
      const section = expandMatch[1].trim()
      return await this.toggleSection(section, true)
    }

    const collapseMatch = lowerAction.match(/collapse (.+)/)
    if (collapseMatch) {
      const section = collapseMatch[1].trim()
      return await this.toggleSection(section, false)
    }

    return false
  }

  private async handleHealthcareAction(action: string, entities?: Record<string, any>): Promise<boolean> {
    const lowerAction = action.toLowerCase()

    // Patient search
    if (lowerAction.includes('patient') && lowerAction.includes('search')) {
      const searchTerm = action.replace(/patient search|search patient/i, '').trim()
      return await this.searchPatient(searchTerm)
    }

    // Patient check-in
    if (lowerAction.includes('check') && lowerAction.includes('in') && lowerAction.includes('patient')) {
      return await this.checkInPatient()
    }

    // Signature collection
    if (lowerAction.includes('signature') || lowerAction.includes('sign')) {
      return await this.collectSignature()
    }

    // Insurance verification
    if (lowerAction.includes('insurance') && lowerAction.includes('verify')) {
      return await this.verifyInsurance()
    }

    // Date of birth input
    if (lowerAction.includes('date of birth') || lowerAction.includes('dob')) {
      const dob = entities?.dates?.[0] || this.extractDateFromAction(action)
      if (dob) {
        return await this.inputDateOfBirth(dob)
      }
    }

    // Phone number input
    if (lowerAction.includes('phone')) {
      const phone = entities?.phones?.[0]
      if (phone) {
        return await this.inputPhoneNumber(phone)
      }
    }

    return false
  }

  private async handleWorkflow(action: string): Promise<boolean> {
    // This would be implemented based on specific workflow requirements
    console.log('Workflow action:', action)
    return true
  }

  private async handleAccessibility(action: string): Promise<boolean> {
    const lowerAction = action.toLowerCase()

    if (lowerAction.includes('read this page') || lowerAction.includes('read screen')) {
      return await this.readPageContent()
    }

    if (lowerAction.includes('describe') && lowerAction.includes('screen')) {
      return await this.describeCurrentScreen()
    }

    if (lowerAction.includes('what can i do') || lowerAction.includes('available actions')) {
      return await this.listAvailableActions()
    }

    if (lowerAction.includes('list commands') || lowerAction.includes('show all commands')) {
      return await this.listAllCommands()
    }

    if (lowerAction.includes('help')) {
      return await this.showHelp()
    }

    return false
  }

  private async handleSystemAction(action: string): Promise<boolean> {
    // Handle system-level actions
    console.log('System action:', action)
    return true
  }

  private async clickElement(elementName: string): Promise<boolean> {
    const element = this.elementDetector.findClickableElement(elementName)
    
    if (!element) {
      // Try to find by descriptor
      const descriptors = this.createElementDescriptors(elementName)
      for (const descriptor of descriptors) {
        const elements = this.elementDetector.findElements(descriptor)
        if (elements.length > 0) {
          return await this.clickElementWithConfirmation(elements[0])
        }
      }
      
      throw new Error(`Element "${elementName}" not found`)
    }

    return await this.clickElementWithConfirmation(element)
  }

  private async clickElementWithConfirmation(element: Element): Promise<boolean> {
    // Highlight element before clicking
    this.elementDetector.highlightElement(element, 1000)
    
    // Wait for user to see the highlight
    await this.delay(1000)
    
    // Click the element
    if (element instanceof HTMLElement) {
      element.click()
      return true
    }
    
    return false
  }

  private async navigateToPage(pageName: string): Promise<boolean> {
    // Try to find navigation elements
    const navigationTerms = ['nav', 'menu', 'navigation', 'sidebar']
    
    for (const term of navigationTerms) {
      const navElements = this.elementDetector.findElements({
        tagName: 'nav'
      })
      
      if (navElements.length > 0) {
        const nav = navElements[0]
        const link = this.findLinkInContainer(nav, pageName)
        
        if (link) {
          return await this.clickElementWithConfirmation(link)
        }
      }
    }

    // Try to find direct links
    const link = this.elementDetector.findClickableElement(pageName)
    if (link) {
      return await this.clickElementWithConfirmation(link)
    }

    return false
  }

  private async searchPatient(searchTerm: string): Promise<boolean> {
    // Find patient search input
    const searchInput = this.elementDetector.findInputElement('patient search')
    
    if (!searchInput) {
      // Try generic search input
      const searchInputs = Array.from(document.querySelectorAll('input[type="search"], input[placeholder*="search" i]'))
      if (searchInputs.length > 0) {
        searchInput = searchInputs[0] as HTMLInputElement
      }
    }

    if (!searchInput) {
      throw new Error('Patient search input not found')
    }

    // Focus and enter search term
    searchInput.focus()
    searchInput.value = searchTerm
    searchInput.dispatchEvent(new Event('input', { bubbles: true }))
    searchInput.dispatchEvent(new Event('change', { bubbles: true }))

    // Find and click search button
    const searchButton = this.elementDetector.findClickableElement('search')
    if (searchButton) {
      await this.delay(500) // Wait for input to be processed
      return await this.clickElementWithConfirmation(searchButton)
    }

    return true
  }

  private async checkInPatient(): Promise<boolean> {
    // Find check-in button
    const checkInButton = this.elementDetector.findClickableElement('check in')
    
    if (!checkInButton) {
      // Try alternative terms
      const alternatives = ['check-in', 'register', 'arrive']
      for (const term of alternatives) {
        const button = this.elementDetector.findClickableElement(term)
        if (button) {
          return await this.clickElementWithConfirmation(button)
        }
      }
      
      throw new Error('Check-in button not found')
    }

    return await this.clickElementWithConfirmation(checkInButton)
  }

  private async collectSignature(): Promise<boolean> {
    // Find signature pad or button
    const signatureElements = this.elementDetector.findElements({
      tagName: 'canvas',
      dataCommand: 'signature-pad'
    })

    if (signatureElements.length > 0) {
      // Highlight signature area
      this.elementDetector.highlightElement(signatureElements[0], 2000)
      return true
    }

    // Find signature button
    const signatureButton = this.elementDetector.findClickableElement('signature')
    if (signatureButton) {
      return await this.clickElementWithConfirmation(signatureButton)
    }

    throw new Error('Signature element not found')
  }

  private createElementDescriptors(elementName: string): ElementDescriptor[] {
    const descriptors: ElementDescriptor[] = []
    const normalizedName = elementName.toLowerCase()

    // Button descriptors
    descriptors.push({
      tagName: 'button',
      textContent: normalizedName
    })

    // Link descriptors
    descriptors.push({
      tagName: 'a',
      textContent: normalizedName
    })

    // ARIA label descriptors
    descriptors.push({
      tagName: 'button',
      ariaLabel: normalizedName
    })

    // Data command descriptors
    descriptors.push({
      tagName: 'button',
      dataCommand: normalizedName.replace(/\s+/g, '-')
    })

    return descriptors
  }

  private findLinkInContainer(container: Element, linkText: string): Element | null {
    const links = container.querySelectorAll('a[href], button, [role="button"], [role="link"]')
    
    for (const link of links) {
      if (!this.elementDetector.isElementVisible(link)) continue
      
      const text = this.elementDetector.getElementText(link)
      if (this.elementDetector.fuzzyMatch(text, linkText)) {
        return link
      }
    }
    
    return null
  }

  private async handleScroll(direction: string): Promise<void> {
    const scrollAmount = 300
    
    switch (direction) {
      case 'up':
        window.scrollBy({ top: -scrollAmount, behavior: 'smooth' })
        break
      case 'down':
        window.scrollBy({ top: scrollAmount, behavior: 'smooth' })
        break
      case 'top':
        window.scrollTo({ top: 0, behavior: 'smooth' })
        break
      case 'bottom':
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
        break
    }
  }

  private async submitForm(): Promise<boolean> {
    const forms = document.querySelectorAll('form')
    
    if (forms.length === 0) {
      throw new Error('No form found')
    }

    const form = forms[0]
    const submitButton = form.querySelector('input[type="submit"], button[type="submit"], button:contains("submit")')
    
    if (submitButton) {
      return await this.clickElementWithConfirmation(submitButton)
    }

    // Submit form programmatically
    form.dispatchEvent(new Event('submit', { bubbles: true }))
    return true
  }

  private async confirmAction(): Promise<boolean> {
    const confirmButtons = Array.from(document.querySelectorAll('button, [role="button"]'))
      .filter(button => {
        const text = this.elementDetector.getElementText(button).toLowerCase()
        return text.includes('confirm') || text.includes('yes') || text.includes('ok')
      })

    if (confirmButtons.length > 0) {
      return await this.clickElementWithConfirmation(confirmButtons[0])
    }

    return false
  }

  private async cancelAction(): Promise<boolean> {
    const cancelButtons = Array.from(document.querySelectorAll('button, [role="button"]'))
      .filter(button => {
        const text = this.elementDetector.getElementText(button).toLowerCase()
        return text.includes('cancel') || text.includes('no') || text.includes('close')
      })

    if (cancelButtons.length > 0) {
      return await this.clickElementWithConfirmation(cancelButtons[0])
    }

    return false
  }

  private async performSearch(query: string): Promise<boolean> {
    const searchInput = this.elementDetector.findInputElement('search')
    
    if (!searchInput) {
      // Try to find any search input
      const searchInputs = Array.from(document.querySelectorAll('input[type="search"], input[placeholder*="search" i]'))
      if (searchInputs.length > 0) {
        searchInput = searchInputs[0] as HTMLInputElement
      }
    }

    if (!searchInput) {
      throw new Error('Search input not found')
    }

    searchInput.focus()
    searchInput.value = query
    searchInput.dispatchEvent(new Event('input', { bubbles: true }))

    // Find and click search button
    const searchButton = this.elementDetector.findClickableElement('search')
    if (searchButton) {
      await this.delay(500)
      return await this.clickElementWithConfirmation(searchButton)
    }

    return true
  }

  private async toggleSection(sectionName: string, expand: boolean): Promise<boolean> {
    const section = this.elementDetector.findClickableElement(sectionName)
    
    if (section) {
      return await this.clickElementWithConfirmation(section)
    }

    return false
  }

  private async readPageContent(): Promise<boolean> {
    const mainContent = document.querySelector('main, article, [role="main"]')
    const content = mainContent || document.body
    
    const text = this.elementDetector.getElementText(content)
    
    // This would be integrated with text-to-speech
    console.log('Reading page content:', text)
    return true
  }

  private async describeCurrentScreen(): Promise<boolean> {
    const interactiveElements = this.elementDetector.getAllInteractiveElements()
    const descriptions = interactiveElements.map(element => 
      this.elementDetector.describeElement(element)
    )
    
    console.log('Available elements:', descriptions)
    return true
  }

  private async listAvailableActions(): Promise<boolean> {
    const actions = [
      'Navigation: go to [page], back, home, refresh, scroll [direction]',
      'UI Actions: click [element], submit, confirm, cancel, search for [query]',
      'Healthcare: search patient, check in patient, collect signature',
      'Accessibility: read page, describe screen, list commands, help'
    ]
    
    console.log('Available actions:', actions)
    return true
  }

  private async listAllCommands(): Promise<boolean> {
    return await this.listAvailableActions()
  }

  private async showHelp(): Promise<boolean> {
    return await this.listAvailableActions()
  }

  private async verifyInsurance(): Promise<boolean> {
    const verifyButton = this.elementDetector.findClickableElement('verify insurance')
    
    if (verifyButton) {
      return await this.clickElementWithConfirmation(verifyButton)
    }

    return false
  }

  private async inputDateOfBirth(dob: string): Promise<boolean> {
    const dobInput = this.elementDetector.findInputElement('date of birth')
    
    if (!dobInput) {
      // Try alternative labels
      const alternatives = ['dob', 'birth', 'birthday']
      for (const alt of alternatives) {
        const input = this.elementDetector.findInputElement(alt)
        if (input) {
          dobInput = input
          break
        }
      }
    }

    if (!dobInput) {
      throw new Error('Date of birth input not found')
    }

    dobInput.focus()
    dobInput.value = dob
    dobInput.dispatchEvent(new Event('input', { bubbles: true }))

    return true
  }

  private async inputPhoneNumber(phone: string): Promise<boolean> {
    const phoneInput = this.elementDetector.findInputElement('phone')
    
    if (!phoneInput) {
      throw new Error('Phone input not found')
    }

    phoneInput.focus()
    phoneInput.value = phone
    phoneInput.dispatchEvent(new Event('input', { bubbles: true }))

    return true
  }

  private extractDateFromAction(action: string): string | null {
    const dateRegex = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/
    const match = action.match(dateRegex)
    return match ? match[0] : null
  }

  private createError(error: any, command: VoiceCommand): ErrorHandler {
    return {
      type: 'execution',
      message: error.message || 'Command execution failed',
      retryable: true,
      code: 'EXECUTION_ERROR'
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  public destroy(): void {
    this.elementDetector.destroy()
  }
}