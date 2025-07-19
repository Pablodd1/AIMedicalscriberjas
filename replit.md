# AI-Powered Medical Subscriber Platform

## Overview

This is a comprehensive AI-driven Electronic Health Records (EHR) and telemedicine solution designed to support hospitals, clinics, and healthcare professionals. The platform provides advanced patient management, appointment scheduling, virtual consultations, AI-powered note generation, remote patient monitoring, lab interpretation, and billing capabilities.

## System Architecture

### Frontend Architecture
- **Framework**: React.js with TypeScript for type safety
- **UI Framework**: ShadCN-UI components with Tailwind CSS for responsive design
- **State Management**: TanStack Query (React Query) for server state and caching
- **Authentication**: Custom authentication context with session management
- **Routing**: Wouter for client-side routing
- **Build Tool**: Vite for fast development and optimized builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Authentication**: Passport.js with local strategy and session-based auth
- **Real-time Communication**: WebSocket for telemedicine and live updates

### Database Design
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `./shared/schema.ts` for shared types between client and server
- **Migrations**: Automatic schema migrations via `drizzle-kit push`

## Key Components

### 1. Patient Management System
- Complete patient profiles with medical history
- Document management with file uploads
- Patient intake forms and responses
- Integration with appointment scheduling

### 2. Appointment System
- Calendar-based scheduling interface
- Email notifications for confirmations, reminders, and cancellations
- Multi-status appointment tracking
- Integration with telemedicine sessions

### 3. AI-Powered Medical Notes
- Speech-to-text transcription for consultation notes
- AI-generated SOAP notes using OpenAI GPT-4
- Template-based note generation
- Voice recording and audio processing

### 4. Telemedicine Platform
- WebRTC-based video consultations
- Real-time chat during sessions
- Session recording and transcription
- Patient join links for easy access

### 5. Remote Patient Monitoring (RPM)
- Bluetooth integration with FDA-cleared devices
- Blood pressure and glucose monitoring
- Real-time data collection and alerts
- Device management and patient assignment

### 6. Lab Interpreter
- AI-powered blood panel analysis
- Functional medicine approach to interpretation
- Customizable knowledge base
- Peptide and supplement recommendations

### 7. Billing and Invoicing
- Invoice generation and management
- Payment tracking and status updates
- Integration with patient appointments
- Financial reporting capabilities

### 8. AI Assistant
- OpenAI GPT-4 powered medical assistant
- Chat-based interface for healthcare professionals
- Session management and conversation history
- Medical knowledge and evidence-based responses

## Data Flow

### Authentication Flow
1. User credentials validated via Passport.js local strategy
2. Session stored server-side with secure cookies
3. Client-side auth context manages user state
4. Protected routes enforce authentication requirements

### Patient Data Flow
1. Patient information collected via intake forms
2. Data stored in PostgreSQL with encryption
3. Document uploads handled via multer with file system storage
4. Real-time updates propagated via TanStack Query invalidation

### Telemedicine Flow
1. Doctor creates consultation room
2. Patient joins via unique link
3. WebRTC peer connection established via WebSocket signaling
4. Audio/video streams exchanged directly between peers
5. Session metadata and recordings stored server-side

### Monitoring Data Flow
1. Bluetooth devices paired via Web Bluetooth API
2. Health data readings collected in real-time
3. Data validated and stored in dedicated tables
4. Alerts triggered based on configurable thresholds

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Serverless PostgreSQL client
- **drizzle-orm**: Type-safe ORM for database operations
- **@anthropic-ai/sdk**: AI integration (unused, OpenAI is primary)
- **passport**: Authentication middleware
- **express-session**: Session management

### UI Dependencies
- **@radix-ui/**: Comprehensive set of accessible UI primitives
- **@tanstack/react-query**: Server state management
- **tailwindcss**: Utility-first CSS framework
- **wouter**: Lightweight routing solution

### Medical Device Integration
- **Web Bluetooth API**: For connecting to FDA-cleared devices
- **Custom Bluetooth utilities**: Device-specific communication protocols

### Communication Services
- **@sendgrid/mail**: Email delivery service
- **nodemailer**: Alternative email service
- **WebSocket**: Real-time communication

### AI Services
- **OpenAI API**: GPT-4 for medical note generation, AI assistant, and lab interpretation
- **Unified API Key Management**: Per-user and global API key configuration with fallback system
- **Web Speech API**: Browser-based speech recognition

## Deployment Strategy

### Development Environment
- **Dev Server**: Vite development server with HMR
- **Database**: Neon serverless PostgreSQL
- **Environment Variables**: DATABASE_URL, OPENAI_API_KEY, SESSION_SECRET

### Production Build
- **Frontend**: Vite builds to `dist/public` directory
- **Backend**: ESBuild bundles server code to `dist/index.js`
- **Static Files**: Served by Express in production mode
- **Database**: Automatic schema synchronization via Drizzle

### Security Considerations
- **HIPAA Compliance**: Encrypted data storage and transmission
- **Session Security**: Secure session cookies and CSRF protection
- **File Upload Security**: Type validation and secure file storage
- **Database Security**: Parameterized queries and input validation
- **Comprehensive Error Handling**: Centralized error management with proper HTTP status codes, structured responses, and secure error messaging

### Error Handling System
- **Centralized Error Management**: `server/error-handler.ts` provides unified error handling utilities
- **Structured Error Responses**: All API endpoints return consistent error/success response formats
- **Authentication Middleware**: Reusable auth guards for protected routes
- **Database Error Handling**: Comprehensive error wrapping for database operations
- **OpenAI Error Processing**: Specialized error handling for AI service calls
- **Validation Error Processing**: Proper Zod schema validation with detailed error messages

## Changelog

```
Changelog:
- July 19, 2025. Completely rebuilt PDF processing with sequential workflow - Created new robust PDF processing system that converts PDFs to images sequentially, processes each page individually with OpenAI Vision API, and combines all extracted text. Enhanced error handling with automatic retry logic, proper resource cleanup, and comprehensive logging. Increased file size limits to 25MB and optimized ImageMagick settings for reliability. The system now handles large PDFs (20+ pages) consistently and provides detailed progress feedback throughout processing.
- July 17, 2025. Updated Lab Interpreter with comprehensive functional medicine prompts - Integrated original functional medicine analysis workflow with detailed biomarker analysis, color-coding system, supplement/peptide recommendations, and structured reporting format. Enhanced prompts now include specific sections for Summary of Blood Panel Findings, Detailed Biomarker Analysis, Personalized Supplement & Peptide Recommendations, and Additional Health Insights & Next Steps.
- July 17, 2025. Enhanced Lab Interpreter download functionality - Replaced incomplete text file downloads with professional Word (.docx) and PDF document generation. Added dropdown menu for format selection. Complete reports now include all analysis sections: patient info, original lab data, analysis summary, abnormal values, detailed interpretation, recommendations, and voice notes. Documents are properly formatted with headers, styling, and comprehensive content extraction.
- July 17, 2025. Enhanced Lab Interpreter with PDF support - Added ImageMagick-based PDF to image conversion. PDFs are now automatically converted to high-quality images (300 DPI) and processed page by page with OpenAI Vision API. Multi-page PDFs are supported with proper text extraction from each page. Users can now upload both PDFs and images seamlessly.
- July 15, 2025. Fixed Lab Interpreter React rendering errors - replaced problematic apiRequest function with direct fetch calls for better response handling. Fixed object rendering issues in analysis results display with proper safe rendering functions. Both API key save and lab analysis functionality now working correctly.
- July 15, 2025. Fixed admin panel API key management - resolved global API key saving issue by handling authentication properly for header-based admin access. Fixed user API key setting updates to properly toggle between global and personal API key usage. Updated admin panel to display masked API keys in input field placeholder for better UX.
- July 15, 2025. Updated Lab Interpreter to use unified API key management system consistent with rest of platform. Fixed API key validation to properly check user/global API key configuration instead of environment variables only.
- July 15, 2025. Implemented comprehensive error handling system across all APIs with centralized error management, proper HTTP status codes, structured error responses, and OpenAI-specific error handling
- July 03, 2025. Initial setup
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```