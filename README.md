# VetRecord Pro - Veterinary Consultation Management System

A comprehensive veterinary consultation recording application that allows vets to record consultations, transcribe audio to text, generate AI-powered SOAP notes, and manage patient records with client and pet information.

## Features

- **Audio Recording & Transcription**: Record consultations and automatically transcribe using OpenAI Whisper
- **AI SOAP Notes**: Generate structured SOAP notes with OpenAI GPT-4o
- **Patient Management**: Store patient IDs, client info, and pet details
- **Audio Playback**: Play back recorded consultations directly in the browser
- **File Downloads**: Download audio files (MP3), transcripts, and SOAP notes (.docx)
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Simple Authentication**: Single-user login for POC use

## Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **AI Services**: OpenAI API (Whisper, GPT-4o)
- **Audio Processing**: FFmpeg for format conversion
- **Authentication**: Passport local strategy (single-user)

## Prerequisites

Before installing, ensure you have:

1. **Node.js** (v18 or higher)
2. **PostgreSQL** database
3. **FFmpeg** installed on your system
4. **OpenAI API Key**
5. **App login credentials** (configured in .env)

## Installation Instructions

### 1. Database Setup

First, create your PostgreSQL database and run the schema:

```bash
# Connect to your PostgreSQL instance
psql -U your_username -d your_database

# Run the database schema
\i database-schema.sql
```

### 2. Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/vetrecord_pro

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Session Configuration (generate a random 32+ character string)
SESSION_SECRET=your_secure_session_secret_here

# App Login (single-user POC)
APP_USERNAME=vet
APP_PASSWORD=vet
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Database Migration

Push the schema to your database:

```bash
npm run db:push
```

### 5. System Dependencies

Install FFmpeg for audio processing:

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Windows:**
Download from https://ffmpeg.org/download.html

### 6. Start the Application

For development:
```bash
npm run dev
```

For production:
```bash
npm run build
npm start
```

The application will be available at `http://localhost:5000`

## Usage Guide

### 1. Authentication
- Navigate to your application URL
- Enter the configured username/password
- You'll be redirected to the home dashboard after login

### 2. Patient Management
- Go to "Patients" to add new patient records
- Fill in patient ID, client details, and pet information
- View and edit existing patient records

### 3. Recording Consultations
- Select a patient from the home screen
- Click "Start Recording" to begin audio capture
- The system will automatically transcribe and generate SOAP notes
- Review the results in the consultation detail view

### 4. Consultation Management
- View all consultations on the home screen
- Click on any consultation to see details
- Play back audio recordings in-browser
- Download audio files, transcripts, and SOAP notes

## API Endpoints

### Authentication
- `POST /api/login` - Login with username/password
- `POST /api/logout` - Logout user
- `GET /api/auth/user` - Get current user info

### Patients
- `GET /api/customers` - List user's patients
- `POST /api/customers` - Create new patient
- `GET /api/customers/:id` - Get patient details
- `PUT /api/customers/:id` - Update patient
- `DELETE /api/customers/:id` - Delete patient

### Consultations
- `GET /api/consultations` - List user's consultations
- `POST /api/consultations` - Create new consultation with audio
- `GET /api/consultations/:id` - Get consultation details
- `PUT /api/consultations/:id` - Update consultation
- `DELETE /api/consultations/:id` - Delete consultation
- `GET /api/consultations/:id/download` - Download audio file
- `GET /api/consultations/:id/export?type=transcript|soap` - Export transcript or SOAP note (.docx)

## File Structure

```
vetrecord-pro/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Application pages
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # Utility functions
├── server/                 # Express backend application
│   ├── db.ts              # Database connection
│   ├── routes.ts          # API routes
│   ├── storage.ts         # Data access layer
│   ├── openai.ts          # OpenAI integration
│   └── replitAuth.ts      # Authentication setup
├── shared/                 # Shared TypeScript types
│   └── schema.ts          # Database schema definitions
├── database-schema.sql    # Database creation script
└── package.json           # Dependencies and scripts
```

## Database Schema

The application uses four main tables:

1. **users** - User authentication data
2. **sessions** - Session storage for authentication
3. **customers** - Patient IDs, client details, and pet information
4. **consultations** - Consultation records with audio, transcripts, and SOAP notes

## Security Considerations

- All API endpoints are protected with authentication
- Audio files are stored securely and only accessible to the owning user
- Database uses proper foreign key constraints
- Session data is encrypted and stored securely

## Troubleshooting

### Common Issues

1. **Audio recording not working**
   - Ensure microphone permissions are granted
   - Check browser compatibility (Chrome/Firefox recommended)

2. **Transcription failing**
   - Verify OpenAI API key is valid and has credits
   - Check audio file format and size limits

3. **Database connection errors**
   - Verify DATABASE_URL is correct
   - Ensure PostgreSQL is running and accessible

4. **FFmpeg conversion errors**
   - Ensure FFmpeg is installed and in system PATH
   - Check file permissions in uploads directory

### Support

For technical support or questions:
1. Check the console logs for error messages
2. Verify all environment variables are set correctly
3. Ensure all dependencies are installed properly

## License

This project is licensed under the MIT License.
