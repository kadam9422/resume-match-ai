# ResumeMatch AI

ResumeMatch AI is a full-stack resume screening application that helps users upload their resume, analyze it against a target job role, and receive a concise report with key skills, strengths, improvement areas, and a match score.

Built for job seekers, recruiters, and career tools, the app combines resume parsing, role-based analysis, and AI-powered insights in a simple dashboard experience.

## Features

- User registration and login
- Resume upload for PDF, DOCX, and TXT files
- AI-assisted job-role analysis
- Skill extraction and matching
- Strengths and improvement suggestions
- Match score and history tracking
- React frontend with Express backend

## Tech Stack

- Node.js + Express
- React + Vite
- MongoDB + Mongoose
- JWT authentication
- PDF/DOCX/TXT parsing
- Gemini API integration

## Local Setup

1. Install dependencies:
   - `npm install`
   - `cd client && npm install`
2. Create environment file:
   - `copy .env.example .env`
3. Update the values in `.env`
4. Start the backend:
   - `npm start`
5. Start the frontend:
   - `cd client && npm run dev`

## Production Build

```bash
cd client
npm run build
```

The backend serves the built frontend when the `dist` folder exists.
