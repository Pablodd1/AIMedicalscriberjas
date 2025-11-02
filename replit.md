# AI-Powered Medical Subscriber Platform

## Overview

This project is an AI-driven Electronic Health Records (EHR) and telemedicine platform for healthcare providers. It offers advanced patient management, appointment scheduling, virtual consultations, AI-powered medical note generation, remote patient monitoring, lab interpretation, and billing functionalities. The platform aims to streamline healthcare operations and enhance patient care through intelligent automation and comprehensive tools.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React.js with TypeScript
- **UI**: ShadCN-UI components with Tailwind CSS
- **State Management**: TanStack Query
- **Routing**: Wouter
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM (using Neon Database for serverless PostgreSQL)
- **Authentication**: Passport.js with local and session-based strategies
- **Real-time**: WebSockets for telemedicine and live updates

### Database Design
- **ORM**: Drizzle ORM for PostgreSQL
- **Schema**: Shared `./shared/schema.ts` for client/server type consistency
- **Migrations**: Automatic schema migrations via `drizzle-kit push`

### Key Features
- **Patient Management**: Profiles, medical history, document uploads, intake forms.
- **Appointment System**: Calendar scheduling, email notifications, multi-status tracking.
- **AI Medical Notes**: Speech-to-text, AI-generated (GPT-4) SOAP notes, template-based generation, voice recording. Features AIMS AI Medical Scribe for comprehensive, HIPAA-compliant clinical documentation, coding, and billing with structured JSON output and specialty-aware documentation.
- **Telemedicine**: WebRTC video consultations, real-time chat, session recording, patient join links. Supports 45+ minute recordings with automatic Cloudinary cloud storage. Upload protection prevents meeting termination during active uploads (up to 500MB files, 30-minute upload timeout).
- **Remote Patient Monitoring (RPM)**: Bluetooth integration with FDA-cleared devices, real-time data collection, alerts.
- **Lab Interpreter**: AI-powered blood panel analysis (GPT-4) with functional medicine approach, customizable knowledge base, peptide/supplement recommendations. Supports PDF and image uploads with robust processing.
- **Billing**: Invoice generation, payment tracking, financial reporting.
- **AI Assistant**: GPT-4 powered medical assistant with chat interface, session management, and medical knowledge base.

### Security & Error Handling
- **Security**: HIPAA compliance, encrypted data, secure sessions, CSRF protection, secure file uploads, parameterized queries.
- **Error Handling**: Centralized error management, structured error responses, authentication middleware, database error handling, OpenAI-specific error processing, Zod schema validation.

## External Dependencies

- **Database**: @neondatabase/serverless, drizzle-orm
- **AI Services**: OpenAI API (GPT-4 for notes, assistant, lab interpretation), Web Speech API, Deepgram (audio transcription)
- **Cloud Storage**: Cloudinary (telemedicine recording storage with 30-minute timeout, 6MB chunking, supports 500MB files)
- **Authentication**: passport, express-session
- **UI/Styling**: @radix-ui/, @tanstack/react-query, tailwindcss, wouter
- **Communication**: @sendgrid/mail, nodemailer, WebSockets
- **Medical Device Integration**: Web Bluetooth API, custom Bluetooth utilities

## Recent Updates (Oct 30 - Nov 2, 2025)

### Consultation Modal Fixes (Nov 2, 2025)
- **JSON Response Handling**: Fixed blank screen issue when pasting text in consultation modal with custom SOAP note prompts
- **Smart Format Detection**: Backend now automatically detects SOAP-formatted JSON responses (Subjective/Objective/Assessment/Plan) and converts them to readable text
- **State Management**: Added `resetModalState()` function to clear all previous consultation data when closing modal or using generated notes
- **Flexible Prompt Support**: System handles both default AIMS AI format (with `human_note` field) and custom JSON formats
- **Format Conversion**: 
  - SOAP-structured JSON → Professional multi-section text format
  - Other JSON structures → Pretty-printed readable format
  - Prevents React "Objects are not valid as a React child" errors
- **Files Updated**: `server/routes/ai.ts`, `client/src/components/consultation-modal.tsx`

### U.S. Time Standards Implementation (Oct 31, 2025)
- **Locale Configuration**: All date and time displays now use 'en-US' locale for consistency
- **Date Format**: MM/DD/YYYY format (U.S. standard) throughout the application
- **Time Format**: 12-hour format with AM/PM indicators (hour12: true)
- **Calendar Week Start**: Calendar components start week on Sunday (weekStartsOn: 0)
- **Updated Components**:
  - All `toLocaleDateString()` calls explicitly use 'en-US' locale
  - All `toLocaleTimeString()` calls use 'en-US' with 12-hour format
  - Calendar component (react-day-picker) configured for Sunday week start
  - Date-fns formatting uses default en-US locale for proper U.S. date display
- **Affected Pages**: Appointments, Medical Notes, Telemedicine, Lab Interpreter, Patient Intake, Assistant, Quick Notes, Patient Details, Billing, Analytics

### Mobile Responsiveness (Oct 30, 2025)
- **Complete Mobile Support**: All main pages now fully responsive for mobile, tablet, and desktop devices
- **Responsive Design System**: Tailwind responsive classes (sm:, md:, lg:) applied throughout
- **Page-Specific Implementations**:
  - **Appointments Page**: Responsive calendar with mobile cell sizing (h-16 md:h-24), stacked headers, single-letter day names on mobile, mobile-optimized dialogs
  - **Medical Notes Page**: Responsive grid layouts, stacked action buttons, mobile-friendly patient selector, adaptive form layouts
  - **Patients Page**: Dual view system - desktop table (hidden md:block) + mobile card view (md:hidden), responsive filters, touch-friendly buttons
  - **Telemedicine Page**: Responsive stats cards (grid-cols-1 sm:grid-cols-2 md:grid-cols-3), stacked waiting room items, mobile-optimized video controls
- **Key Features**:
  - Mobile-first approach with proper touch targets (44px minimum)
  - Responsive dialogs with w-[95vw] widths on mobile
  - Adaptive text sizes and spacing across breakpoints
  - No horizontal scrolling on any viewport size
  - Optimized for 375px - 1920px+ screen widths

### Telemedicine Recording Upload Configuration
- **Extended Timeouts**: All upload timeouts increased from 10 minutes to 30 minutes to support 45+ minute recordings
  - Frontend timeout: 30 minutes (1,800,000ms)
  - Server request/response timeout: 30 minutes
  - Cloudinary upload timeout: 30 minutes
- **File Size Limits**: Increased from 100MB to 500MB to accommodate longer consultations
- **Chunked Uploads**: 6MB chunk size for reliable large file transfers
- **Upload Protection**: End Meeting button disabled during active uploads with warning messages
- **Progress Tracking**: Real-time upload status displayed in meeting interface
- **Configuration Files**:
  - `server/cloudinary-storage.ts`: Cloudinary timeout and chunk configuration
  - `server/routes.ts`: Server timeout and file size limits
  - `client/src/pages/telemedicine.tsx`: Frontend timeout and upload state management