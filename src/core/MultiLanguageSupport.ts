import { VoiceRecognitionConfig } from '@/types'

export class MultiLanguageSupport {
  private languageConfigs: Map<string, any>
  private accentMappings: Map<string, string[]>

  constructor() {
    this.languageConfigs = new Map()
    this.accentMappings = new Map()
    this.initializeLanguageConfigs()
    this.initializeAccentMappings()
  }

  private initializeLanguageConfigs(): void {
    // English configurations
    this.languageConfigs.set('en-US', {
      wakeWords: ['hey healthcare', 'hello healthcare', 'hi healthcare'],
      commandPatterns: {
        navigation: [
          /go to (.+)/i,
          /open (.+)/i,
          /navigate to (.+)/i,
          /back/i,
          /home/i,
          /dashboard/i,
          /scroll (up|down|top|bottom)/i,
          /refresh/i
        ],
        healthcare: [
          /search patient (.+)/i,
          /find patient (.+)/i,
          /patient search/i,
          /check in patient/i,
          /patient check in/i,
          /sign here/i,
          /add signature/i,
          /verify insurance/i,
          /date of birth/i,
          /dob/i,
          /phone number/i
        ]
      },
      synonyms: {
        'patient': ['client', 'person'],
        'check in': ['check-in', 'register', 'sign in'],
        'signature': ['sign', 'autograph', 'initial'],
        'insurance': ['coverage', 'benefits'],
        'dob': ['date of birth', 'birthday', 'birth date'],
        'phone': ['telephone', 'mobile', 'cell']
      }
    })

    // Spanish configurations
    this.languageConfigs.set('es-ES', {
      wakeWords: ['oye healthcare', 'hola healthcare', 'hola salud'],
      commandPatterns: {
        navigation: [
          /ir a (.+)/i,
          /abrir (.+)/i,
          /navegar a (.+)/i,
          /atrás/i,
          /inicio/i,
          /panel principal/i,
          /desplazar (arriba|abriba|arriba|abajo)/i,
          /actualizar/i
        ],
        healthcare: [
          /buscar paciente (.+)/i,
          /encontrar paciente (.+)/i,
          /búsqueda de paciente/i,
          /registrar paciente/i,
          /firma aquí/i,
          /agregar firma/i,
          /verificar seguro/i,
          /fecha de nacimiento/i,
          /fecha nacimiento/i,
          /número de teléfono/i,
          /teléfono/i
        ]
      },
      synonyms: {
        'paciente': ['cliente', 'persona'],
        'registrar': ['registro', 'ingresar', 'firmar'],
        'firma': ['firmar', 'autógrafo', 'inicial'],
        'seguro': ['cobertura', 'beneficios'],
        'fecha nacimiento': ['fecha de nacimiento', 'cumpleaños', 'nacimiento'],
        'teléfono': ['móvil', 'celular', 'teléfono']
      }
    })

    // French configurations
    this.languageConfigs.set('fr-FR', {
      wakeWords: ['bonjour healthcare', 'salut healthcare', 'bonjour santé'],
      commandPatterns: {
        navigation: [
          /aller à (.+)/i,
          /ouvrir (.+)/i,
          /naviguer vers (.+)/i,
          /retour/i,
          /accueil/i,
          /tableau de bord/i,
          /faire défiler (haut|bas|haut|bas)/i,
          /actualiser/i
        ],
        healthcare: [
          /chercher patient (.+)/i,
          /trouver patient (.+)/i,
          /recherche patient/i,
          /enregistrer patient/i,
          /signature ici/i,
          /ajouter signature/i,
          /vérifier assurance/i,
          /date de naissance/i,
          /date naissance/i,
          /numéro de téléphone/i,
          /téléphone/i
        ]
      },
      synonyms: {
        'patient': ['client', 'personne'],
        'enregistrer': ['inscription', 's\'inscrire', 'signer'],
        'signature': ['signer', 'autographe', 'initiale'],
        'assurance': ['couverture', 'prestations'],
        'date naissance': ['date de naissance', 'anniversaire', 'naissance'],
        'téléphone': ['portable', 'mobile', 'téléphone']
      }
    })

    // Chinese configurations
    this.languageConfigs.set('zh-CN', {
      wakeWords: ['你好 healthcare', '嗨 healthcare', '你好医疗'],
      commandPatterns: {
        navigation: [
          /去 (.+)/i,
          /打开 (.+)/i,
          /导航到 (.+)/i,
          /返回/i,
          /首页/i,
          /仪表板/i,
          /滚动 (上|下|顶部|底部)/i,
          /刷新/i
        ],
        healthcare: [
          /搜索患者 (.+)/i,
          /查找患者 (.+)/i,
          /患者搜索/i,
          /患者签到/i,
          /在这里签名/i,
          /添加签名/i,
          /验证保险/i,
          /出生日期/i,
          /生日/i,
          /电话号码/i,
          /电话/i
        ]
      },
      synonyms: {
        '患者': ['客户', '人员'],
        '签到': ['登记', '注册', '签名'],
        '签名': ['签字', '署名', ' initials'],
        '保险': ['覆盖', '福利'],
        '生日': ['出生日期', '生日', '出生'],
        '电话': ['手机', '移动电话', '电话']
      }
    })
  }

  private initializeAccentMappings(): void {
    this.accentMappings.set('english', [
      'en-US', // American English
      'en-GB', // British English
      'en-AU', // Australian English
      'en-CA', // Canadian English
      'en-IN', // Indian English
      'en-NZ', // New Zealand English
    ])

    this.accentMappings.set('spanish', [
      'es-ES', // Spanish (Spain)
      'es-MX', // Spanish (Mexico)
      'es-AR', // Spanish (Argentina)
      'es-CO', // Spanish (Colombia)
      'es-US', // Spanish (United States)
    ])

    this.accentMappings.set('french', [
      'fr-FR', // French (France)
      'fr-CA', // French (Canada)
      'fr-BE', // French (Belgium)
      'fr-CH', // French (Switzerland)
    ])

    this.accentMappings.set('chinese', [
      'zh-CN', // Chinese (Simplified, China)
      'zh-TW', // Chinese (Traditional, Taiwan)
      'zh-HK', // Chinese (Traditional, Hong Kong)
    ])
  }

  public getLanguageConfig(language: string): any {
    return this.languageConfigs.get(language) || this.languageConfigs.get('en-US')
  }

  public getWakeWords(language: string): string[] {
    const config = this.getLanguageConfig(language)
    return config.wakeWords || ['hey healthcare']
  }

  public getCommandPatterns(language: string, category: string): RegExp[] {
    const config = this.getLanguageConfig(language)
    return config.commandPatterns[category] || []
  }

  public getSynonyms(language: string): Record<string, string[]> {
    const config = this.getLanguageConfig(language)
    return config.synonyms || {}
  }

  public getAccents(language: string): string[] {
    const languageFamily = this.getLanguageFamily(language)
    return this.accentMappings.get(languageFamily) || [language]
  }

  private getLanguageFamily(language: string): string {
    if (language.startsWith('en')) return 'english'
    if (language.startsWith('es')) return 'spanish'
    if (language.startsWith('fr')) return 'french'
    if (language.startsWith('zh')) return 'chinese'
    return 'english'
  }

  public detectAccent(transcript: string, language: string): string {
    const accents = this.getAccents(language)
    
    // Simple accent detection based on common words and phrases
    const accentIndicators = {
      'en-GB': ['bloody', 'mate', 'cheers', 'loo', 'queue'],
      'en-AU': ['mate', 'g\'day', 'arvo', 'barbie', 'brekkie'],
      'en-IN': ['yaar', 'acha', 'thik hai', 'kya'],
      'es-MX': ['güey', 'órale', 'chido', 'carnal'],
      'es-ES': ['vale', 'tío', 'guay', 'mola'],
      'fr-CA': ['tabarnak', 'calisse', 'oui mais', 'char'],
      'fr-FR': ['putain', 'mec', 'grave', 'ouais'],
      'zh-TW': ['的', '了', '是', '我'],
      'zh-CN': ['的', '了', '是', '我']
    }

    const lowerTranscript = transcript.toLowerCase()
    let bestMatch = language
    let maxMatches = 0

    for (const [accent, indicators] of Object.entries(accentIndicators)) {
      const matches = indicators.filter(indicator => 
        lowerTranscript.includes(indicator.toLowerCase())
      ).length
      
      if (matches > maxMatches) {
        maxMatches = matches
        bestMatch = accent
      }
    }

    return bestMatch
  }

  public normalizeTranscript(transcript: string, language: string): string {
    const config = this.getLanguageConfig(language)
    let normalized = transcript.toLowerCase()

    // Apply synonyms
    const synonyms = this.getSynonyms(language)
    for (const [standard, variations] of Object.entries(synonyms)) {
      for (const variation of variations) {
        const regex = new RegExp(`\\b${variation}\\b`, 'gi')
        normalized = normalized.replace(regex, standard)
      }
    }

    // Language-specific normalizations
    switch (language) {
      case 'en-US':
        // American English normalization
        normalized = normalized.replace(/\bcolour\b/g, 'color')
        normalized = normalized.replace(/\bfavour\b/g, 'favor')
        normalized = normalized.replace(/\bcentre\b/g, 'center')
        break
      
      case 'en-GB':
        // British English normalization
        normalized = normalized.replace(/\bcolor\b/g, 'colour')
        normalized = normalized.replace(/\bfavor\b/g, 'favour')
        normalized = normalized.replace(/\bcenter\b/g, 'centre')
        break
      
      case 'es-ES':
        // Spanish normalization
        normalized = normalized.replace(/[áàä]/g, 'a')
        normalized = normalized.replace(/[éèë]/g, 'e')
        normalized = normalized.replace(/[íìï]/g, 'i')
        normalized = normalized.replace(/[óòö]/g, 'o')
        normalized = normalized.replace(/[úùü]/g, 'u')
        normalized = normalized.replace(/[ñ]/g, 'n')
        break
      
      case 'fr-FR':
        // French normalization
        normalized = normalized.replace(/[àâä]/g, 'a')
        normalized = normalized.replace(/[éèêë]/g, 'e')
        normalized = normalized.replace(/[îï]/g, 'i')
        normalized = normalized.replace(/[ôö]/g, 'o')
        normalized = normalized.replace(/[ùûü]/g, 'u')
        normalized = normalized.replace(/[ç]/g, 'c')
        break
    }

    return normalized.trim()
  }

  public translateCommand(transcript: string, fromLanguage: string, toLanguage: string): string {
    // Simple translation for common commands
    const translations: Record<string, Record<string, string>> = {
      'en-US': {
        'go to': 'go to',
        'search patient': 'search patient',
        'check in': 'check in',
        'collect signature': 'collect signature',
        'verify insurance': 'verify insurance'
      },
      'es-ES': {
        'go to': 'ir a',
        'search patient': 'buscar paciente',
        'check in': 'registrar',
        'collect signature': 'recoger firma',
        'verify insurance': 'verificar seguro'
      },
      'fr-FR': {
        'go to': 'aller à',
        'search patient': 'chercher patient',
        'check in': 'enregistrer',
        'collect signature': 'collecter signature',
        'verify insurance': 'vérifier assurance'
      },
      'zh-CN': {
        'go to': '去',
        'search patient': '搜索患者',
        'check in': '签到',
        'collect signature': '收集签名',
        'verify insurance': '验证保险'
      }
    }

    const fromTranslations = translations[fromLanguage] || translations['en-US']
    const toTranslations = translations[toLanguage] || translations['en-US']

    let translated = transcript

    // Translate common phrases
    for (const [english, fromPhrase] of Object.entries(fromTranslations)) {
      const toPhrase = toTranslations[english] || english
      const regex = new RegExp(`\\b${fromPhrase}\\b`, 'gi')
      translated = translated.replace(regex, toPhrase)
    }

    return translated
  }

  public getSupportedLanguages(): string[] {
    return Array.from(this.languageConfigs.keys())
  }

  public isLanguageSupported(language: string): boolean {
    return this.languageConfigs.has(language)
  }

  public getLanguageDisplayName(language: string): string {
    const displayNames: Record<string, string> = {
      'en-US': 'English (US)',
      'en-GB': 'English (UK)',
      'en-AU': 'English (Australia)',
      'en-CA': 'English (Canada)',
      'en-IN': 'English (India)',
      'es-ES': 'Spanish (Spain)',
      'es-MX': 'Spanish (Mexico)',
      'es-AR': 'Spanish (Argentina)',
      'fr-FR': 'French (France)',
      'fr-CA': 'French (Canada)',
      'zh-CN': 'Chinese (Simplified)',
      'zh-TW': 'Chinese (Traditional)'
    }

    return displayNames[language] || language
  }

  public getDefaultConfig(language: string): Partial<VoiceRecognitionConfig> {
    const configs: Record<string, Partial<VoiceRecognitionConfig>> = {
      'en-US': {
        wakeWord: 'Hey Healthcare',
        languages: ['en-US'],
        confidenceThreshold: 0.7,
        timeoutMs: 5000
      },
      'es-ES': {
        wakeWord: 'oye healthcare',
        languages: ['es-ES'],
        confidenceThreshold: 0.7,
        timeoutMs: 5000
      },
      'fr-FR': {
        wakeWord: 'bonjour healthcare',
        languages: ['fr-FR'],
        confidenceThreshold: 0.7,
        timeoutMs: 5000
      },
      'zh-CN': {
        wakeWord: '你好 healthcare',
        languages: ['zh-CN'],
        confidenceThreshold: 0.7,
        timeoutMs: 5000
      }
    }

    return configs[language] || configs['en-US']
  }
}