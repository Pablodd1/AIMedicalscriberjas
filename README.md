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

## Recent Updates (Oct 30-Nov 02, 2025)

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

### Medical Notes AI Improvements (Nov 02, 2025)
- **AI Assistant Chat**: Fully functional React-based chat interface in Medical Notes AI Suggestions section
  - Real-time chat with GPT-4o medical assistant via `/api/ai/chat` endpoint
  - Proper React state management (chatMessages, chatInput, isAssistantThinking)
  - Message history tracking with user/assistant role differentiation
  - Loading states and error handling for API requests
  - Medical context-aware responses for healthcare professionals
- **Patient Analysis Section**: Real patient data display instead of demo/placeholder content
  - Dynamic patient overview showing name, DOB, email, phone, address
  - Patient medical history display
  - Previous medical notes count and most recent note date
  - Current note type context and description
  - Type-safe implementation using MedicalNote type from shared schema
- **Consultation Modal State Management**: Fixed data persistence issue
  - Added resetModalState() function to clear all form data
  - Clears transcript, notes, liveTranscript, consultationId when modal closes or notes are used
  - Prevents old consultation data from appearing in new sessions
- **Type Safety**: Eliminated `any` types in favor of proper TypeScript types from @shared/schema

### Appointments Page Search Bar in List View (Nov 07, 2025)
- **Search/Filter Section**: Added comprehensive search functionality to list view
  - **Mini Appointment Reports Cards**: Compact status summary cards at the top of search section
    - Same colorful theme as calendar view (blue, red, green, orange, purple)
    - Smaller size with p-3 padding and text-xl count display
    - Clickable to show filtered appointment details dialog
    - Displays count for Scheduled, Cancelled, Complete, Pending, and All appointments
    - 2 columns (mobile) to 3 (tablet) to 5 (desktop) responsive grid
  - **Name Filter**: Text input to filter appointments by patient name (case-insensitive, partial match)
  - **Email Filter**: Text input to filter appointments by patient email (case-insensitive, partial match)
  - **Date Filter**: Calendar picker to filter appointments by specific date
  - **Status Filter**: Dropdown to filter by status (All, Scheduled, Cancelled, Complete, Pending)
  - **Clear Button**: One-click button to reset all search filters
- **Search Logic**: Real-time filtering as user types or selects options
  - Filters work together (AND logic) - all selected criteria must match
  - Shows helpful message when no appointments match search criteria
  - Maintains original appointments list when no filters applied
- **Styling**: Uses shadcn Card component with theme colors (not black)
  - Responsive grid layout: 1 column (mobile) to 2 (tablet) to 4 (desktop)
  - Clean, professional appearance matching existing design system
- **User Experience**: Instant feedback with no "Search" button needed - filters apply automatically

### Appointments Page Status Summary & Enhanced Functionality (Nov 07, 2025)
- **Appointment Reports Section**: Interactive status summary cards at the top of calendar view
  - **Scheduled Card**: Blue gradient (blue-500→blue-600) showing scheduled appointments count
  - **Cancelled Card**: Red gradient (red-500→red-600) showing cancelled appointments count
  - **Complete Card**: Green gradient (green-500→green-600) showing completed appointments count
  - **Pending Card**: Orange gradient (orange-500→orange-600) showing pending appointments count
  - **All Card**: Purple gradient (purple-500→purple-600) showing total appointments count
- **Theme-Based Styling**: Uses colorful gradients matching theme colors instead of black
  - shadcn Card components with CardHeader and CardContent
  - Hover effects: hover:shadow-lg and hover:scale-105 for better interactivity
  - White text on colored backgrounds for high contrast
  - White download buttons with colored text matching card theme
- **Functional Download Buttons**: Excel export functionality for each status
  - Downloads filtered appointments to .xlsx format using xlsx library
  - Includes patient name, email, date (MM/DD/YYYY), time (12-hour format), status, patient confirmation, notes
  - Filename includes status and current date (e.g., "Scheduled_Appointments_11-07-2025.xlsx")
  - Toast notifications for success/empty results
  - Event propagation prevented to allow both card click and download button
- **Clickable Cards**: Cards open filtered appointments dialog
  - Shows detailed list of appointments for clicked status
  - Displays patient info, status badges, patient confirmation badges, date/time, notes
  - Includes Edit and Delete buttons for each appointment
  - Mobile-responsive dialog with flexible layouts
- **Icons**: Status-specific icons for each card (Calendar, XCircle, CheckCircle, Clock, ClipboardCheck, Download)
- **Responsive Design**: Grid layout adapts from 2 columns (mobile) to 3 (tablet) to 5 (desktop)
- **Real-time Updates**: Counts and data automatically update when appointments change

### Quick Notes Complete Redesign (Nov 02, 2025)
- **Complete UI Overhaul**: Rebuilt Quick Notes to match Medical Notes page exactly (minus patient selection)
  - **2-Column Grid Layout**: SOAP Note editor on left, AI Suggestions on right
  - **Identical Header**: Settings button, Start Consultation button, Generate SOAP button
  - **Same Button Layout**: Preview, Download, Save buttons in 3-column grid
  - **Consultation Modal Integration**: Full recording, transcription, and AI note generation without patient requirement
- **Settings Dialog**: Complete template and prompt customization system
  - Note type selection (Initial, Follow-up, Physical, Re-evaluation, Procedure, Psychiatric, Discharge)
  - Custom system prompt editing for AI note generation
  - Template structure configuration
  - Automatic template sync when switching note types
  - Save custom prompts to database with cache invalidation
- **AI Suggestions Section**: Three-tab interface matching Medical Notes
  - **Templates Tab**: Pre-built note templates (Initial Consultation, Follow-up, Physical Exam, Re-evaluation)
  - **Analysis Tab**: General documentation tips and best practices for quick notes
  - **Assistant Tab**: Full AI chat functionality with GPT-4o medical assistant
- **Preview & Download**: Professional note preview dialog and .docx export functionality
- **State Management**: Proper React state management with useEffect hooks for template synchronization
- **Type Safety**: Full TypeScript implementation with proper types from @shared/schema
- **Implementation Pattern**: Exact mirror of Medical Notes architecture adapted for patient-agnostic workflow
