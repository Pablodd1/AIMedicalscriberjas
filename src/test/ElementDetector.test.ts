import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ElementDetector } from '@/core/ElementDetector'
import type { ElementDescriptor } from '@/types'

// Mock DOM APIs
global.document = {
  querySelectorAll: vi.fn(),
  getElementById: vi.fn(),
  createElement: vi.fn()
} as any

global.window = {
  getComputedStyle: vi.fn(() => ({
    display: 'block',
    visibility: 'visible',
    opacity: '1'
  }))
} as any

describe('ElementDetector', () => {
  let detector: ElementDetector

  beforeEach(() => {
    detector = new ElementDetector()
    vi.clearAllMocks()
  })

  afterEach(() => {
    detector.destroy()
  })

  describe('Element Finding', () => {
    it('should find elements by descriptor', () => {
      const mockElement = document.createElement('button')
      mockElement.textContent = 'Search Patient'
      mockElement.style.display = 'block'
      mockElement.style.visibility = 'visible'
      mockElement.style.opacity = '1'

      vi.mocked(document.querySelectorAll).mockReturnValue([mockElement] as any)

      const descriptor: ElementDescriptor = {
        tagName: 'button',
        textContent: 'search patient'
      }

      const elements = detector.findElements(descriptor)
      
      expect(elements).toHaveLength(1)
      expect(elements[0]).toBe(mockElement)
    })

    it('should find elements by data-command', () => {
      const mockElement = document.createElement('button')
      mockElement.setAttribute('data-command', 'patient-search')

      vi.mocked(document.querySelectorAll).mockReturnValue([mockElement] as any)

      const descriptor: ElementDescriptor = {
        tagName: 'button',
        dataCommand: 'patient-search'
      }

      const elements = detector.findElements(descriptor)
      
      expect(elements).toHaveLength(1)
      expect(elements[0]).toBe(mockElement)
    })

    it('should find elements by ARIA label', () => {
      const mockElement = document.createElement('button')
      mockElement.setAttribute('aria-label', 'Patient Search')

      vi.mocked(document.querySelectorAll).mockReturnValue([mockElement] as any)

      const descriptor: ElementDescriptor = {
        tagName: 'button',
        ariaLabel: 'patient search'
      }

      const elements = detector.findElements(descriptor)
      
      expect(elements).toHaveLength(1)
      expect(elements[0]).toBe(mockElement)
    })

    it('should handle multiple matching elements', () => {
      const mockElements = [
        document.createElement('button'),
        document.createElement('button'),
        document.createElement('button')
      ]

      vi.mocked(document.querySelectorAll).mockReturnValue(mockElements as any)

      const descriptor: ElementDescriptor = {
        tagName: 'button'
      }

      const elements = detector.findElements(descriptor)
      
      expect(elements).toHaveLength(3)
    })
  })

  describe('Clickable Element Detection', () => {
    it('should find clickable elements', () => {
      const mockButton = document.createElement('button')
      mockButton.textContent = 'Submit'

      vi.mocked(document.querySelectorAll).mockImplementation((selector) => {
        if (selector === 'button') return [mockButton] as any
        return [] as any
      })

      const element = detector.findClickableElement('submit')
      
      expect(element).toBe(mockButton)
    })

    it('should handle fuzzy matching for clickable elements', () => {
      const mockButton = document.createElement('button')
      mockButton.textContent = 'Patient Check-in'

      vi.mocked(document.querySelectorAll).mockImplementation((selector) => {
        if (selector === 'button') return [mockButton] as any
        return [] as any
      })

      const element = detector.findClickableElement('check in')
      
      expect(element).toBe(mockButton)
    })
  })

  describe('Input Element Detection', () => {
    it('should find input elements by label', () => {
      const mockLabel = document.createElement('label')
      mockLabel.textContent = 'Patient Name'
      mockLabel.setAttribute('for', 'patient-name')

      const mockInput = document.createElement('input')
      mockInput.id = 'patient-name'

      vi.mocked(document.querySelectorAll).mockImplementation((selector) => {
        if (selector === 'label') return [mockLabel] as any
        return [] as any
      })
      vi.mocked(document.getElementById).mockReturnValue(mockInput)

      const input = detector.findInputElement('patient name')
      
      expect(input).toBe(mockInput)
    })

    it('should find input elements by placeholder', () => {
      const mockInput = document.createElement('input')
      mockInput.setAttribute('placeholder', 'Patient Name')

      vi.mocked(document.querySelectorAll).mockImplementation((selector) => {
        if (selector.includes('input')) return [mockInput] as any
        return [] as any
      })

      const input = detector.findInputElement('patient name')
      
      expect(input).toBe(mockInput)
    })

    it('should find input elements by ARIA label', () => {
      const mockInput = document.createElement('input')
      mockInput.setAttribute('aria-label', 'Patient Name')

      vi.mocked(document.querySelectorAll).mockImplementation((selector) => {
        if (selector.includes('input')) return [mockInput] as any
        return [] as any
      })

      const input = detector.findInputElement('patient name')
      
      expect(input).toBe(mockInput)
    })
  })

  describe('Element Visibility', () => {
    it('should detect visible elements', () => {
      const mockElement = document.createElement('button')
      mockElement.style.display = 'block'
      mockElement.style.visibility = 'visible'
      mockElement.style.opacity = '1'

      global.window.getComputedStyle = vi.fn(() => ({
        display: 'block',
        visibility: 'visible',
        opacity: '1'
      }))

      const isVisible = detector.isElementVisible(mockElement)
      
      expect(isVisible).toBe(true)
    })

    it('should detect hidden elements', () => {
      const mockElement = document.createElement('button')
      mockElement.style.display = 'none'

      global.window.getComputedStyle = vi.fn(() => ({
        display: 'none',
        visibility: 'visible',
        opacity: '1'
      }))

      const isVisible = detector.isElementVisible(mockElement)
      
      expect(isVisible).toBe(false)
    })

    it('should detect elements with zero dimensions', () => {
      const mockElement = document.createElement('button')
      Object.defineProperty(mockElement, 'getBoundingClientRect', {
        value: vi.fn(() => ({ width: 0, height: 100, top: 0, bottom: 100, left: 0, right: 100 }))
      })

      const isVisible = detector.isElementVisible(mockElement)
      
      expect(isVisible).toBe(false)
    })
  })

  describe('Element Highlighting', () => {
    it('should highlight elements', () => {
      const mockElement = document.createElement('button')
      mockElement.style.outline = ''
      mockElement.style.boxShadow = ''
      mockElement.style.transition = ''

      vi.spyOn(mockElement, 'scrollIntoView')

      detector.highlightElement(mockElement, 100)
      
      expect(mockElement.style.outline).toBe('3px solid #10b981')
      expect(mockElement.style.boxShadow).toBe('0 0 20px rgba(16, 185, 129, 0.5)')
      expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center'
      })
    })

    it('should restore original styles after highlighting', (done) => {
      const mockElement = document.createElement('button')
      const originalOutline = '1px solid black'
      const originalBoxShadow = 'none'
      
      mockElement.style.outline = originalOutline
      mockElement.style.boxShadow = originalBoxShadow

      detector.highlightElement(mockElement, 50)
      
      setTimeout(() => {
        expect(mockElement.style.outline).toBe(originalOutline)
        expect(mockElement.style.boxShadow).toBe(originalBoxShadow)
        done()
      }, 100)
    })
  })

  describe('Element Text Extraction', () => {
    it('should extract text content', () => {
      const mockElement = document.createElement('button')
      mockElement.textContent = 'Search Patient'

      const text = detector.getElementText(mockElement)
      
      expect(text).toBe('Search Patient')
    })

    it('should extract ARIA label when text content is empty', () => {
      const mockElement = document.createElement('button')
      mockElement.setAttribute('aria-label', 'Patient Search')

      const text = detector.getElementText(mockElement)
      
      expect(text).toBe('Patient Search')
    })

    it('should extract title attribute', () => {
      const mockElement = document.createElement('button')
      mockElement.setAttribute('title', 'Patient Search')

      const text = detector.getElementText(mockElement)
      
      expect(text).toBe('Patient Search')
    })
  })

  describe('Fuzzy Matching', () => {
    it('should match exact text', () => {
      const result = detector.fuzzyMatch('patient search', 'patient search')
      expect(result).toBe(true)
    })

    it('should match contained text', () => {
      const result = detector.fuzzyMatch('patient search button', 'patient search')
      expect(result).toBe(true)
    })

    it('should match with small typos', () => {
      const result = detector.fuzzyMatch('patent search', 'patient search', 0.7)
      expect(result).toBe(true)
    })

    it('should not match very different text', () => {
      const result = detector.fuzzyMatch('completely different', 'patient search', 0.7)
      expect(result).toBe(false)
    })
  })

  describe('Interactive Elements', () => {
    it('should find all interactive elements', () => {
      const mockElements = [
        document.createElement('button'),
        document.createElement('a'),
        document.createElement('input'),
        document.createElement('textarea')
      ]

      vi.mocked(document.querySelectorAll).mockImplementation((selector) => {
        if (selector === 'button') return [mockElements[0]] as any
        if (selector === 'a[href]') return [mockElements[1]] as any
        if (selector === 'input:not([type="hidden"])') return [mockElements[2]] as any
        if (selector === 'textarea') return [mockElements[3]] as any
        return [] as any
      })

      const elements = detector.getAllInteractiveElements()
      
      expect(elements.length).toBe(4)
    })
  })

  describe('Element Description', () => {
    it('should describe elements with text content', () => {
      const mockElement = document.createElement('button')
      mockElement.textContent = 'Search Patient'

      const description = detector.describeElement(mockElement)
      
      expect(description).toContain('"Search Patient"')
      expect(description).toContain('button')
    })

    it('should describe elements with ARIA label', () => {
      const mockElement = document.createElement('button')
      mockElement.setAttribute('aria-label', 'Patient Search')

      const description = detector.describeElement(mockElement)
      
      expect(description).toContain('aria-label: "Patient Search"')
    })

    it('should describe elements with role', () => {
      const mockElement = document.createElement('div')
      mockElement.setAttribute('role', 'button')

      const description = detector.describeElement(mockElement)
      
      expect(description).toContain('role: button')
    })
  })
})