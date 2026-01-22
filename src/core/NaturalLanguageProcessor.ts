import nlp from 'compromise'
import { VoiceCommand, CommandCategory, ElementDescriptor, Workflow, PatientInfo } from '@/types'

export class NaturalLanguageProcessor {
  private commandPatterns: Map<CommandCategory, RegExp[]>
  private synonyms: Map<string, string[]>
  private healthcareTerms: Map<string, string[]>

  constructor() {
    this.initializeCommandPatterns()
    this.initializeSynonyms()
    this.initializeHealthcareTerms()
  }

  private initializeCommandPatterns(): void {
    this.commandPatterns = new Map([
      ['navigation', [
        /go to (.+)/i,
        /open (.+)/i,
        /navigate to (.+)/i,
        /show me (.+)/i,
        /take me to (.+)/i,
        /back/i,
        /go back/i,
        /previous page/i,
        /home/i,
        /main screen/i,
        /dashboard/i,
        /scroll (up|down|top|bottom)/i,
        /next page/i,
        /previous page/i,
        /refresh/i,
        /reload/i
      ]],
      ['ui-action', [
        /click (.+)/i,
        /press (.+)/i,
        /tap (.+)/i,
        /select (.+)/i,
        /choose (.+)/i,
        /submit/i,
        /send/i,
        /confirm/i,
        /yes/i,
        /okay/i,
        /continue/i,
        /cancel/i,
        /no/i,
        /close/i,
        /dismiss/i,
        /search for (.+)/i,
        /find (.+)/i,
        /expand (.+)/i,
        /collapse (.+)/i
      ]],
      ['healthcare', [
        /search patient (.+)/i,
        /find patient (.+)/i,
        /look up patient (.+)/i,
        /patient search/i,
        /check in patient/i,
        /patient check in/i,
        /patient check-in/i,
        /sign here/i,
        /add signature/i,
        /complete signature/i,
        /verify insurance/i,
        /check insurance/i,
        /update patient info/i,
        /patient details/i,
        /medical record/i,
        /date of birth/i,
        /dob/i,
        /phone number/i,
        /insurance/i
      ]],
      ['workflow', [
        /start (.+)/i,
        /begin (.+)/i,
        /complete (.+)/i,
        /finish (.+)/i,
        /create (.+)/i,
        /save/i,
        /update/i,
        /delete (.+)/i,
        /remove (.+)/i,
        /share (.+)/i,
        /download (.+)/i,
        /export (.+)/i
      ]],
      ['accessibility', [
        /read this page/i,
        /read screen/i,
        /describe current screen/i,
        /what's on this page/i,
        /what can i do here/i,
        /available actions/i,
        /list commands/i,
        /show all commands/i,
        /help/i,
        /how do i (.+)/i
      ]],
      ['system', [
        /sleep/i,
        /stop listening/i,
        /mute/i,
        /unmute/i,
        /repeat last action/i,
        /undo/i
      ]]
    ])
  }

  private initializeSynonyms(): void {
    this.synonyms = new Map([
      ['click', ['press', 'tap', 'select', 'choose', 'pick']],
      ['go', ['navigate', 'open', 'show', 'take']],
      ['search', ['find', 'look', 'locate']],
      ['patient', ['client', 'person']],
      ['check in', ['check-in', 'register', 'sign in']],
      ['signature', ['sign', 'autograph', 'initial']],
      ['insurance', ['coverage', 'benefits']],
      ['dob', ['date of birth', 'birthday', 'birth date']],
      ['phone', ['telephone', 'mobile', 'cell']],
      ['complete', ['finish', 'done', 'submit']]
    ])
  }

  private initializeHealthcareTerms(): void {
    this.healthcareTerms = new Map([
      ['patient-search', [
        'search patient', 'find patient', 'look up patient', 'patient lookup',
        'find person', 'search client', 'patient search'
      ]],
      ['check-in', [
        'check in', 'check-in', 'register', 'sign in', 'arrive'
      ]],
      ['signature', [
        'sign', 'signature', 'autograph', 'initial', 'sign here'
      ]],
      ['insurance', [
        'insurance', 'coverage', 'benefits', 'verify insurance'
      ]],
      ['medical-record', [
        'medical record', 'chart', 'file', 'patient record'
      ]],
      ['appointment', [
        'appointment', 'visit', 'scheduled', 'booking'
      ]],
      ['waiting-room', [
        'waiting room', 'lobby', 'queue', 'waiting'
      ]]
    ])
  }

  public parseCommand(transcript: string, confidence: number): VoiceCommand | null {
    const doc = nlp(transcript.toLowerCase())
    
    // Extract entities
    const entities = this.extractEntities(doc)
    
    // Determine command category and action
    const category = this.determineCategory(transcript)
    const action = this.extractAction(transcript, category)
    
    if (!category || !action) {
      return null
    }

    return {
      id: `cmd_${Date.now()}`,
      category,
      action,
      description: this.generateDescription(transcript, category, action),
      confidence,
      timestamp: new Date(),
      entities
    }
  }

  private determineCategory(transcript: string): CommandCategory | null {
    for (const [category, patterns] of this.commandPatterns) {
      for (const pattern of patterns) {
        if (pattern.test(transcript)) {
          return category as CommandCategory
        }
      }
    }
    
    // Check healthcare-specific terms
    for (const [term, variations] of this.healthcareTerms) {
      for (const variation of variations) {
        if (transcript.includes(variation)) {
          return 'healthcare'
        }
      }
    }
    
    return null
  }

  private extractAction(transcript: string, category: CommandCategory): string {
    const patterns = this.commandPatterns.get(category)
    if (!patterns) return transcript

    for (const pattern of patterns) {
      const match = transcript.match(pattern)
      if (match && match[1]) {
        return match[1].trim()
      }
    }

    return transcript
  }

  private extractEntities(doc: any): Record<string, any> {
    const entities: Record<string, any> = {}

    // Extract names
    const people = doc.people().out('array')
    if (people.length > 0) {
      entities.names = people
    }

    // Extract dates
    const dates = doc.dates().out('array')
    if (dates.length > 0) {
      entities.dates = dates
    }

    // Extract numbers
    const numbers = doc.numbers().out('array')
    if (numbers.length > 0) {
      entities.numbers = numbers
    }

    // Extract phone numbers
    const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g
    const phones = doc.text().match(phoneRegex)
    if (phones) {
      entities.phones = phones
    }

    // Extract email addresses
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
    const emails = doc.text().match(emailRegex)
    if (emails) {
      entities.emails = emails
    }

    return entities
  }

  private generateDescription(transcript: string, category: CommandCategory, action: string): string {
    const descriptions: Record<CommandCategory, string> = {
      'navigation': `Navigate to: ${action}`,
      'ui-action': `Perform action: ${action}`,
      'healthcare': `Healthcare action: ${action}`,
      'workflow': `Workflow step: ${action}`,
      'accessibility': `Accessibility request: ${action}`,
      'system': `System command: ${action}`,
      'patient-management': `Patient management: ${action}`
    }

    return descriptions[category] || `Command: ${transcript}`
  }

  public findElementDescriptors(action: string): ElementDescriptor[] {
    const descriptors: ElementDescriptor[] = []
    const lowerAction = action.toLowerCase()

    // Common button patterns
    const buttonPatterns = [
      { text: lowerAction, tagName: 'button' },
      { text: lowerAction, tagName: 'a' },
      { ariaLabel: lowerAction, tagName: 'button' },
      { dataCommand: lowerAction.replace(/\s+/g, '-'), tagName: 'button' }
    ]

    buttonPatterns.forEach(pattern => {
      descriptors.push({
        tagName: pattern.tagName,
        textContent: pattern.text || lowerAction,
        ariaLabel: pattern.ariaLabel,
        dataCommand: pattern.dataCommand
      })
    })

    // Specific healthcare elements
    if (lowerAction.includes('patient') || lowerAction.includes('search')) {
      descriptors.push({
        tagName: 'input',
        type: 'search',
        ariaLabel: 'patient search'
      })
    }

    if (lowerAction.includes('signature')) {
      descriptors.push({
        tagName: 'canvas',
        dataCommand: 'signature-pad'
      })
    }

    if (lowerAction.includes('check') && lowerAction.includes('in')) {
      descriptors.push({
        tagName: 'button',
        textContent: 'check in',
        dataCommand: 'patient-checkin'
      })
    }

    return descriptors
  }

  public expandSynonyms(text: string): string {
    let expanded = text
    
    for (const [original, synonyms] of this.synonyms) {
      for (const synonym of synonyms) {
        if (expanded.includes(synonym)) {
          expanded = expanded.replace(new RegExp(synonym, 'gi'), original)
        }
      }
    }
    
    return expanded
  }

  public fuzzyMatch(text: string, target: string, threshold = 0.7): boolean {
    const normalizedText = text.toLowerCase().trim()
    const normalizedTarget = target.toLowerCase().trim()
    
    // Exact match
    if (normalizedText === normalizedTarget) return true
    
    // Contains match
    if (normalizedText.includes(normalizedTarget) || 
        normalizedTarget.includes(normalizedText)) return true
    
    // Word overlap
    const textWords = normalizedText.split(/\s+/)
    const targetWords = normalizedTarget.split(/\s+/)
    
    const overlap = textWords.filter(word => 
      targetWords.some(targetWord => 
        this.levenshteinDistance(word, targetWord) <= 2
      )
    )
    
    return overlap.length / Math.max(textWords.length, targetWords.length) >= threshold
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

  public parsePatientInfo(transcript: string): Partial<PatientInfo> {
    const info: Partial<PatientInfo> = {}
    const doc = nlp(transcript)
    
    // Extract name
    const people = doc.people().out('array')
    if (people.length > 0) {
      const nameParts = people[0].split(' ')
      if (nameParts.length >= 2) {
        info.firstName = nameParts[0]
        info.lastName = nameParts.slice(1).join(' ')
      }
    }
    
    // Extract date of birth
    const dates = doc.dates().out('array')
    if (dates.length > 0) {
      info.dateOfBirth = dates[0]
    }
    
    // Extract phone number
    const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g
    const phones = transcript.match(phoneRegex)
    if (phones && phones.length > 0) {
      info.phoneNumber = phones[0]
    }
    
    return info
  }

  public generateHealthcareWorkflow(command: VoiceCommand): Workflow | null {
    const action = command.action.toLowerCase()
    
    if (action.includes('patient') && action.includes('search')) {
      return {
        id: 'patient-search',
        name: 'Patient Search',
        description: 'Search for patient by name or ID',
        category: 'healthcare',
        steps: [
          {
            id: 'focus-search',
            type: 'click',
            target: { tagName: 'input', type: 'search' }
          },
          {
            id: 'enter-query',
            type: 'input',
            parameters: { text: action.replace('patient search', '').trim() }
          },
          {
            id: 'submit-search',
            type: 'click',
            target: { tagName: 'button', textContent: 'search' }
          }
        ],
        requiresConfirmation: false
      }
    }
    
    if (action.includes('check') && action.includes('in')) {
      return {
        id: 'patient-checkin',
        name: 'Patient Check-in',
        description: 'Check in a patient for their appointment',
        category: 'healthcare',
        steps: [
          {
            id: 'click-checkin',
            type: 'click',
            target: { tagName: 'button', dataCommand: 'patient-checkin' }
          },
          {
            id: 'confirm-checkin',
            type: 'confirm',
            parameters: { 
              message: 'Please confirm patient check-in',
              requireInput: true 
            }
          }
        ],
        requiresConfirmation: true
      }
    }
    
    if (action.includes('signature')) {
      return {
        id: 'collect-signature',
        name: 'Collect Signature',
        description: 'Collect patient signature on forms',
        category: 'healthcare',
        steps: [
          {
            id: 'show-signature-pad',
            type: 'click',
            target: { tagName: 'canvas', dataCommand: 'signature-pad' }
          },
          {
            id: 'wait-for-signature',
            type: 'wait',
            timeout: 30000,
            parameters: { 
              instruction: 'Please sign in the signature area',
              requireInput: true 
            }
          }
        ],
        requiresConfirmation: true
      }
    }
    
    return null
  }
}