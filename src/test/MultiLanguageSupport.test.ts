import { describe, it, expect, beforeEach } from 'vitest'
import { MultiLanguageSupport } from '@/core/MultiLanguageSupport'

describe('MultiLanguageSupport', () => {
  let multiLang: MultiLanguageSupport

  beforeEach(() => {
    multiLang = new MultiLanguageSupport()
  })

  describe('Language Configuration', () => {
    it('should get language config for supported languages', () => {
      const config = multiLang.getLanguageConfig('en-US')
      expect(config).toBeDefined()
      expect(config.wakeWords).toContain('hey healthcare')
    })

    it('should return default config for unsupported languages', () => {
      const config = multiLang.getLanguageConfig('unknown-lang')
      expect(config).toBeDefined()
      expect(config).toBe(multiLang.getLanguageConfig('en-US'))
    })

    it('should get wake words for different languages', () => {
      const enWakeWords = multiLang.getWakeWords('en-US')
      expect(enWakeWords).toContain('hey healthcare')

      const esWakeWords = multiLang.getWakeWords('es-ES')
      expect(esWakeWords).toContain('oye healthcare')

      const frWakeWords = multiLang.getWakeWords('fr-FR')
      expect(frWakeWords).toContain('bonjour healthcare')

      const zhWakeWords = multiLang.getWakeWords('zh-CN')
      expect(zhWakeWords).toContain('你好 healthcare')
    })

    it('should get command patterns for different languages', () => {
      const enPatterns = multiLang.getCommandPatterns('en-US', 'navigation')
      expect(enPatterns.length).toBeGreaterThan(0)

      const esPatterns = multiLang.getCommandPatterns('es-ES', 'healthcare')
      expect(esPatterns.length).toBeGreaterThan(0)

      const frPatterns = multiLang.getCommandPatterns('fr-FR', 'navigation')
      expect(frPatterns.length).toBeGreaterThan(0)
    })

    it('should get synonyms for different languages', () => {
      const enSynonyms = multiLang.getSynonyms('en-US')
      expect(enSynonyms['patient']).toContain('client')

      const esSynonyms = multiLang.getSynonyms('es-ES')
      expect(esSynonyms['paciente']).toContain('cliente')

      const frSynonyms = multiLang.getSynonyms('fr-FR')
      expect(frSynonyms['patient']).toContain('client')
    })
  })

  describe('Accent Detection', () => {
    it('should detect American English accent', () => {
      const transcript = 'Hey mate, let\'s go to the patient search'
      const accent = multiLang.detectAccent(transcript, 'en-US')
      expect(accent).toBe('en-AU') // Contains Australian indicators
    })

    it('should detect British English accent', () => {
      const transcript = 'Hello healthcare, let\'s go to the loo'
      const accent = multiLang.detectAccent(transcript, 'en-US')
      expect(accent).toBe('en-GB') // Contains British indicators
    })

    it('should detect Spanish (Spain) accent', () => {
      const transcript = 'oye healthcare, vale tío'
      const accent = multiLang.detectAccent(transcript, 'es-ES')
      expect(accent).toBe('es-ES')
    })

    it('should detect Spanish (Mexico) accent', () => {
      const transcript = 'oye healthcare, güey'
      const accent = multiLang.detectAccent(transcript, 'es-ES')
      expect(accent).toBe('es-MX')
    })

    it('should return original language if no accent detected', () => {
      const transcript = 'Hey healthcare, normal text'
      const accent = multiLang.detectAccent(transcript, 'en-US')
      expect(accent).toBe('en-US')
    })
  })

  describe('Text Normalization', () => {
    it('should normalize American English text', () => {
      const text = 'colour favour centre'
      const normalized = multiLang.normalizeTranscript(text, 'en-US')
      expect(normalized).toBe('color favor center')
    })

    it('should normalize British English text', () => {
      const text = 'color favor center'
      const normalized = multiLang.normalizeTranscript(text, 'en-GB')
      expect(normalized).toBe('colour favour centre')
    })

    it('should normalize Spanish text', () => {
      const text = 'canción niño'
      const normalized = multiLang.normalizeTranscript(text, 'es-ES')
      expect(normalized).toBe('cancion nino')
    })

    it('should normalize French text', () => {
      const text = 'français été'
      const normalized = multiLang.normalizeTranscript(text, 'fr-FR')
      expect(normalized).toBe('francais ete')
    })
  })

  describe('Command Translation', () => {
    it('should translate commands from English to Spanish', () => {
      const text = 'go to patient search'
      const translated = multiLang.translateCommand(text, 'en-US', 'es-ES')
      expect(translated).toContain('ir a')
      expect(translated).toContain('buscar paciente')
    })

    it('should translate commands from English to French', () => {
      const text = 'search patient john doe'
      const translated = multiLang.translateCommand(text, 'en-US', 'fr-FR')
      expect(translated).toContain('chercher patient')
    })

    it('should translate commands from English to Chinese', () => {
      const text = 'check in patient'
      const translated = multiLang.translateCommand(text, 'en-US', 'zh-CN')
      expect(translated).toContain('签到')
      expect(translated).toContain('患者')
    })
  })

  describe('Supported Languages', () => {
    it('should return supported languages', () => {
      const languages = multiLang.getSupportedLanguages()
      expect(languages).toContain('en-US')
      expect(languages).toContain('es-ES')
      expect(languages).toContain('fr-FR')
      expect(languages).toContain('zh-CN')
    })

    it('should check if language is supported', () => {
      expect(multiLang.isLanguageSupported('en-US')).toBe(true)
      expect(multiLang.isLanguageSupported('es-ES')).toBe(true)
      expect(multiLang.isLanguageSupported('unknown')).toBe(false)
    })
  })

  describe('Language Display Names', () => {
    it('should return display names for languages', () => {
      expect(multiLang.getLanguageDisplayName('en-US')).toBe('English (US)')
      expect(multiLang.getLanguageDisplayName('en-GB')).toBe('English (UK)')
      expect(multiLang.getLanguageDisplayName('es-ES')).toBe('Spanish (Spain)')
      expect(multiLang.getLanguageDisplayName('fr-FR')).toBe('French (France)')
      expect(multiLang.getLanguageDisplayName('zh-CN')).toBe('Chinese (Simplified)')
    })

    it('should return language code for unknown languages', () => {
      expect(multiLang.getLanguageDisplayName('unknown')).toBe('unknown')
    })
  })

  describe('Default Configurations', () => {
    it('should return default config for languages', () => {
      const enConfig = multiLang.getDefaultConfig('en-US')
      expect(enConfig.wakeWord).toBe('Hey Healthcare')
      expect(enConfig.confidenceThreshold).toBe(0.7)

      const esConfig = multiLang.getDefaultConfig('es-ES')
      expect(esConfig.wakeWord).toBe('oye healthcare')

      const frConfig = multiLang.getDefaultConfig('fr-FR')
      expect(frConfig.wakeWord).toBe('bonjour healthcare')

      const zhConfig = multiLang.getDefaultConfig('zh-CN')
      expect(zhConfig.wakeWord).toBe('你好 healthcare')
    })

    it('should return English default for unknown languages', () => {
      const config = multiLang.getDefaultConfig('unknown')
      expect(config).toBe(multiLang.getDefaultConfig('en-US'))
    })
  })

  describe('Accent Mappings', () => {
    it('should return accents for English', () => {
      const accents = multiLang.getAccents('english')
      expect(accents).toContain('en-US')
      expect(accents).toContain('en-GB')
      expect(accents).toContain('en-AU')
      expect(accents).toContain('en-CA')
    })

    it('should return accents for Spanish', () => {
      const accents = multiLang.getAccents('spanish')
      expect(accents).toContain('es-ES')
      expect(accents).toContain('es-MX')
      expect(accents).toContain('es-AR')
    })

    it('should return accents for French', () => {
      const accents = multiLang.getAccents('french')
      expect(accents).toContain('fr-FR')
      expect(accents).toContain('fr-CA')
      expect(accents).toContain('fr-BE')
    })

    it('should return single language for unknown families', () => {
      const accents = multiLang.getAccents('unknown')
      expect(accents).toEqual(['unknown'])
    })
  })
})