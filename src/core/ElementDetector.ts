import { ElementDescriptor, VoiceCommand } from '@/types'

export class ElementDetector {
  private readonly OBSERVER_CONFIG = {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: ['aria-label', 'data-command', 'data-testid', 'class']
  }

  private observer: MutationObserver | null = null
  private elementCache: Map<string, Element> = new Map()
  private selectorCache: Map<string, string> = new Map()

  constructor() {
    this.setupMutationObserver()
  }

  private setupMutationObserver(): void {
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          this.invalidateCache()
        } else if (mutation.type === 'attributes') {
          this.invalidateElement(mutation.target as Element)
        }
      })
    })

    this.observer.observe(document.body, this.OBSERVER_CONFIG)
  }

  public findElements(descriptor: ElementDescriptor): Element[] {
    const cacheKey = this.getCacheKey(descriptor)
    
    if (this.elementCache.has(cacheKey)) {
      const cachedElement = this.elementCache.get(cacheKey)!
      if (document.contains(cachedElement)) {
        return [cachedElement]
      } else {
        this.elementCache.delete(cacheKey)
      }
    }

    const elements = this.searchElements(descriptor)
    
    if (elements.length === 1) {
      this.elementCache.set(cacheKey, elements[0])
    }

    return elements
  }

  private searchElements(descriptor: ElementDescriptor): Element[] {
    const selectors = this.buildSelectors(descriptor)
    const elements: Element[] = []

    for (const selector of selectors) {
      try {
        const foundElements = Array.from(document.querySelectorAll(selector))
        elements.push(...foundElements)
      } catch (error) {
        console.warn('Invalid selector:', selector, error)
      }
    }

    // Filter by descriptor properties
    return this.filterElements(elements, descriptor)
  }

  private buildSelectors(descriptor: ElementDescriptor): string[] {
    const selectors: string[] = []
    const tagName = descriptor.tagName.toLowerCase()

    // ID selector (highest priority)
    if (descriptor.id) {
      selectors.push(`#${descriptor.id}`)
    }

    // Data-command selector
    if (descriptor.dataCommand) {
      selectors.push(`[data-command="${descriptor.dataCommand}"]`)
    }

    // ARIA label selector
    if (descriptor.ariaLabel) {
      selectors.push(`[aria-label*="${descriptor.ariaLabel}" i]`)
    }

    // Data-testid selector
    if (descriptor.dataTestId) {
      selectors.push(`[data-testid="${descriptor.dataTestId}"]`)
    }

    // Text content selector
    if (descriptor.textContent) {
      const text = descriptor.textContent.toLowerCase()
      selectors.push(`${tagName}:not(script):not(style):not(noscript)`)
      selectors.push(`button:contains("${text}"), a:contains("${text}"), [role="button"]:contains("${text}")`)
    }

    // Role-based selector
    if (descriptor.role) {
      selectors.push(`[role="${descriptor.role}"]`)
    }

    // Type-based selector
    if (descriptor.type) {
      selectors.push(`${tagName}[type="${descriptor.type}"]`)
    }

    // Class-based selector
    if (descriptor.className) {
      const classes = descriptor.className.split(' ')
      classes.forEach(className => {
        selectors.push(`.${className}`)
      })
    }

    // Generic tag selector
    selectors.push(tagName)

    return [...new Set(selectors)] // Remove duplicates
  }

  private filterElements(elements: Element[], descriptor: ElementDescriptor): Element[] {
    return elements.filter(element => {
      // Check visibility
      if (!this.isElementVisible(element)) return false

      // Check text content
      if (descriptor.textContent) {
        const elementText = this.getElementText(element).toLowerCase()
        const searchText = descriptor.textContent.toLowerCase()
        
        if (!elementText.includes(searchText) && 
            !this.fuzzyMatch(elementText, searchText)) {
          return false
        }
      }

      // Check ARIA label
      if (descriptor.ariaLabel) {
        const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || ''
        const searchLabel = descriptor.ariaLabel.toLowerCase()
        
        if (ariaLabel && !ariaLabel.includes(searchLabel) && 
            !this.fuzzyMatch(ariaLabel, searchLabel)) {
          return false
        }
      }

      // Check data attributes
      if (descriptor.dataCommand) {
        const dataCommand = element.getAttribute('data-command')
        if (dataCommand !== descriptor.dataCommand) return false
      }

      if (descriptor.dataTestId) {
        const dataTestId = element.getAttribute('data-testid')
        if (dataTestId !== descriptor.dataTestId) return false
      }

      // Check role
      if (descriptor.role) {
        const role = element.getAttribute('role')
        if (role !== descriptor.role) return false
      }

      // Check type
      if (descriptor.type) {
        const type = element.getAttribute('type')
        if (type !== descriptor.type) return false
      }

      return true
    })
  }

  public findClickableElement(text: string): Element | null {
    const clickableSelectors = [
      'button',
      'a[href]',
      '[role="button"]',
      '[role="link"]',
      '[tabindex="0"]',
      'input[type="button"]',
      'input[type="submit"]',
      'input[type="reset"]'
    ]

    for (const selector of clickableSelectors) {
      const elements = Array.from(document.querySelectorAll(selector))
      
      for (const element of elements) {
        if (!this.isElementVisible(element)) continue
        
        const elementText = this.getElementText(element)
        
        if (this.fuzzyMatch(elementText, text)) {
          return element
        }
      }
    }

    return null
  }

  public findInputElement(label: string): HTMLInputElement | null {
    // Try to find by label text
    const labels = Array.from(document.querySelectorAll('label'))
    for (const labelElement of labels) {
      const labelText = labelElement.textContent?.toLowerCase() || ''
      if (this.fuzzyMatch(labelText, label)) {
        const inputId = labelElement.getAttribute('for')
        if (inputId) {
          const input = document.getElementById(inputId) as HTMLInputElement
          if (input) return input
        }
      }
    }

    // Try to find by placeholder
    const inputs = Array.from(document.querySelectorAll('input, textarea, select'))
    for (const input of inputs) {
      const placeholder = input.getAttribute('placeholder')?.toLowerCase() || ''
      if (this.fuzzyMatch(placeholder, label)) {
        return input as HTMLInputElement
      }
    }

    // Try to find by aria-label
    const ariaInputs = Array.from(document.querySelectorAll('input[aria-label], textarea[aria-label], select[aria-label]'))
    for (const input of ariaInputs) {
      const ariaLabel = input.getAttribute('aria-label')?.toLowerCase() || ''
      if (this.fuzzyMatch(ariaLabel, label)) {
        return input as HTMLInputElement
      }
    }

    return null
  }

  public highlightElement(element: Element, duration = 1000): void {
    const originalOutline = element.style.outline
    const originalBoxShadow = element.style.boxShadow
    
    element.style.outline = '3px solid #10b981'
    element.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.5)'
    element.style.transition = 'outline 0.3s ease, box-shadow 0.3s ease'
    
    element.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center' 
    })

    setTimeout(() => {
      element.style.outline = originalOutline
      element.style.boxShadow = originalBoxShadow
    }, duration)
  }

  public isElementVisible(element: Element): boolean {
    if (!(element instanceof HTMLElement)) return false

    const rect = element.getBoundingClientRect()
    const style = window.getComputedStyle(element)

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      rect.top < window.innerHeight &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.right > 0
    )
  }

  public getElementText(element: Element): string {
    // Try multiple methods to get text
    const methods = [
      () => element.textContent?.trim() || '',
      () => element.getAttribute('aria-label') || '',
      () => element.getAttribute('title') || '',
      () => element.getAttribute('alt') || '',
      () => {
        const ariaLabelledBy = element.getAttribute('aria-labelledby')
        if (ariaLabelledBy) {
          const labelElement = document.getElementById(ariaLabelledBy)
          return labelElement?.textContent?.trim() || ''
        }
        return ''
      }
    ]

    for (const method of methods) {
      const text = method()
      if (text) return text
    }

    return ''
  }

  private fuzzyMatch(text1: string, text2: string, threshold = 0.7): boolean {
    const normalize = (str: string) => 
      str.toLowerCase().replace(/[^\w\s]/g, '').trim()
    
    const norm1 = normalize(text1)
    const norm2 = normalize(text2)
    
    if (norm1 === norm2) return true
    if (norm1.includes(norm2) || norm2.includes(norm1)) return true
    
    // Calculate word overlap
    const words1 = norm1.split(/\s+/)
    const words2 = norm2.split(/\s+/)
    
    const overlap = words1.filter(word1 =>
      words2.some(word2 =>
        this.levenshteinDistance(word1, word2) <= 2
      )
    )
    
    return overlap.length / Math.max(words1.length, words2.length) >= threshold
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() =>
      Array(str1.length + 1).fill(null)
    )
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i
    }
    
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        )
      }
    }
    
    return matrix[str2.length][str1.length]
  }

  private getCacheKey(descriptor: ElementDescriptor): string {
    return JSON.stringify({
      tagName: descriptor.tagName,
      textContent: descriptor.textContent,
      ariaLabel: descriptor.ariaLabel,
      dataCommand: descriptor.dataCommand,
      dataTestId: descriptor.dataTestId,
      id: descriptor.id
    })
  }

  private invalidateCache(): void {
    this.elementCache.clear()
    this.selectorCache.clear()
  }

  private invalidateElement(element: Element): void {
    // Remove cached entries that might reference this element
    for (const [key, cachedElement] of this.elementCache) {
      if (cachedElement === element) {
        this.elementCache.delete(key)
      }
    }
  }

  public getAllInteractiveElements(): Element[] {
    const selectors = [
      'button',
      'a[href]',
      'input:not([type="hidden"])',
      'textarea',
      'select',
      '[role="button"]',
      '[role="link"]',
      '[tabindex="0"]',
      '[onclick]',
      '[data-command]'
    ]

    const elements: Element[] = []
    
    for (const selector of selectors) {
      const found = Array.from(document.querySelectorAll(selector))
        .filter(element => this.isElementVisible(element))
      
      elements.push(...found)
    }

    // Remove duplicates
    return [...new Set(elements)]
  }

  public describeElement(element: Element): string {
    const descriptions: string[] = []
    
    if (element instanceof HTMLElement) {
      // Text content
      const text = element.textContent?.trim()
      if (text && text.length < 50) {
        descriptions.push(`"${text}"`)
      }
      
      // Tag name
      descriptions.push(element.tagName.toLowerCase())
      
      // Role
      const role = element.getAttribute('role')
      if (role) {
        descriptions.push(`role: ${role}`)
      }
      
      // Type
      const type = element.getAttribute('type')
      if (type) {
        descriptions.push(`type: ${type}`)
      }
      
      // ARIA label
      const ariaLabel = element.getAttribute('aria-label')
      if (ariaLabel) {
        descriptions.push(`aria-label: "${ariaLabel}"`)
      }
      
      // Data command
      const dataCommand = element.getAttribute('data-command')
      if (dataCommand) {
        descriptions.push(`data-command: ${dataCommand}`)
      }
    }
    
    return descriptions.join(', ')
  }

  public destroy(): void {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
    
    this.elementCache.clear()
    this.selectorCache.clear()
  }
}