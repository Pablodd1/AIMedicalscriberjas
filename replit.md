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
- **Telemedicine**: WebRTC video consultations, real-time chat, session recording, patient join links.
- **Remote Patient Monitoring (RPM)**: Bluetooth integration with FDA-cleared devices, real-time data collection, alerts.
- **Lab Interpreter**: AI-powered blood panel analysis (GPT-4) with functional medicine approach, customizable knowledge base, peptide/supplement recommendations. Supports PDF and image uploads with robust processing.
- **Billing**: Invoice generation, payment tracking, financial reporting.
- **AI Assistant**: GPT-4 powered medical assistant with chat interface, session management, and medical knowledge base.

### Security & Error Handling
- **Security**: HIPAA compliance, encrypted data, secure sessions, CSRF protection, secure file uploads, parameterized queries.
- **Error Handling**: Centralized error management, structured error responses, authentication middleware, database error handling, OpenAI-specific error processing, Zod schema validation.

## External Dependencies

- **Database**: @neondatabase/serverless, drizzle-orm
- **AI Services**: OpenAI API (GPT-4 for notes, assistant, lab interpretation), Web Speech API
- **Authentication**: passport, express-session
- **UI/Styling**: @radix-ui/, @tanstack/react-query, tailwindcss, wouter
- **Communication**: @sendgrid/mail, nodemailer, WebSockets
- **Medical Device Integration**: Web Bluetooth API, custom Bluetooth utilities