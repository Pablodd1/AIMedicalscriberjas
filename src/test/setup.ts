// Test setup file for Vitest
import { vi } from 'vitest'

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock crypto for environments where it's not available
if (!global.crypto) {
  global.crypto = {
    getRandomValues: (array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256)
      }
      return array
    },
    subtle: {
      generateKey: vi.fn().mockResolvedValue({}),
      encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
      decrypt: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
    }
  } as any
}

// Mock speech synthesis
if (!global.speechSynthesis) {
  global.speechSynthesis = {
    speak: vi.fn(),
    cancel: vi.fn(),
    getVoices: vi.fn().mockReturnValue([]),
    paused: false,
    pending: false,
    speaking: false,
  } as any
}

// Mock speech recognition
if (!global.SpeechRecognition && !global.webkitSpeechRecognition) {
  global.SpeechRecognition = vi.fn().mockImplementation(() => ({
    continuous: false,
    interimResults: false,
    lang: '',
    maxAlternatives: 1,
    start: vi.fn(),
    stop: vi.fn(),
    onstart: null,
    onend: null,
    onresult: null,
    onerror: null,
  }))

  global.webkitSpeechRecognition = global.SpeechRecognition
}

// Mock navigator.mediaDevices
if (!global.navigator) {
  global.navigator = {} as any
}

if (!global.navigator.mediaDevices) {
  global.navigator.mediaDevices = {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => []
    }),
    enumerateDevices: vi.fn().mockResolvedValue([])
  } as any
}

// Mock document methods
global.document.createElement = vi.fn().mockImplementation((tagName) => {
  const element = {
    tagName: tagName.toUpperCase(),
    style: {},
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn()
    },
    setAttribute: vi.fn(),
    getAttribute: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    click: vi.fn(),
    focus: vi.fn(),
    blur: vi.fn(),
    querySelector: vi.fn(),
    querySelectorAll: vi.fn().mockReturnValue([]),
    getBoundingClientRect: vi.fn().mockReturnValue({
      width: 100,
      height: 50,
      top: 0,
      bottom: 50,
      left: 0,
      right: 100
    }),
    scrollIntoView: vi.fn(),
    textContent: '',
    innerHTML: '',
    value: '',
    id: '',
    className: '',
    children: [],
    parentNode: null,
    removeChild: vi.fn(),
    appendChild: vi.fn(),
    insertBefore: vi.fn(),
    replaceChild: vi.fn(),
    cloneNode: vi.fn().mockReturnValue(this)
  }
  
  // Add common methods
  Object.defineProperty(element, 'textContent', {
    get: () => element._textContent || '',
    set: (value) => { element._textContent = value }
  })
  
  Object.defineProperty(element, 'value', {
    get: () => element._value || '',
    set: (value) => { element._value = value }
  })
  
  return element
})

// Mock document methods
global.document.querySelector = vi.fn().mockReturnValue(null)
global.document.querySelectorAll = vi.fn().mockReturnValue([])
global.document.getElementById = vi.fn().mockReturnValue(null)
global.document.body = {
  appendChild: vi.fn(),
  removeChild: vi.fn(),
  querySelector: vi.fn(),
  querySelectorAll: vi.fn().mockReturnValue([])
} as any

// Mock URL methods
global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
global.URL.revokeObjectURL = vi.fn()

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((callback) => {
  return setTimeout(callback, 16) as any
})

global.cancelAnimationFrame = vi.fn((id) => {
  clearTimeout(id)
})

// Mock performance APIs
global.performance = {
  now: vi.fn().mockReturnValue(Date.now()),
  mark: vi.fn(),
  measure: vi.fn(),
  clearMarks: vi.fn(),
  clearMeasures: vi.fn(),
  getEntriesByType: vi.fn().mockReturnValue([]),
  getEntriesByName: vi.fn().mockReturnValue([])
} as any

// Mock localStorage
global.localStorage = {
  getItem: vi.fn().mockReturnValue(null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn().mockReturnValue(null)
} as any

// Mock sessionStorage
global.sessionStorage = {
  getItem: vi.fn().mockReturnValue(null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn().mockReturnValue(null)
} as any

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
} as any

// Export for use in tests
export { vi }