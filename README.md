# ResumeMatch AI

<p align="center">
  <img src="https://img.shields.io/badge/AI-Resume%20Analyzer-00C2FF?style=for-the-badge&logo=googlecloud&logoColor=white" alt="ResumeMatch AI" />
</p>

<p align="center">
  <a href="https://github.com/kadam9422/resume-match-ai/stargazers">
    <img src="https://img.shields.io/github/stars/kadam9422/resume-match-ai?style=social" alt="GitHub stars" />
  </a>
  <a href="https://github.com/kadam9422/resume-match-ai/forks">
    <img src="https://img.shields.io/github/forks/kadam9422/resume-match-ai?style=social" alt="GitHub forks" />
  </a>
  <a href="https://github.com/kadam9422/resume-match-ai/issues">
    <img src="https://img.shields.io/github/issues/kadam9422/resume-match-ai" alt="GitHub issues" />
  </a>
  <a href="https://github.com/kadam9422/resume-match-ai/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/kadam9422/resume-match-ai" alt="License" />
  </a>
</p>

ResumeMatch AI is a full-stack resume analysis platform that helps users upload a CV, target a job role, and receive AI-powered insights such as skill matches, strengths, improvement areas, and a match score.

The project is designed to help job seekers and recruiters quickly evaluate resume alignment with a role while keeping the experience simple and fast.

## Features

- User registration and login
- Resume upload for PDF, DOCX, and TXT files
- AI-assisted role analysis
- Skill extraction and matching
- Strengths and improvement suggestions
- Match score and upload history
- JWT-based authentication
- React frontend with Express backend

## Tech Stack

- Node.js + Express
- React + Vite
- MongoDB + Mongoose
- JWT authentication
- PDF, DOCX, and TXT parsing
- Gemini API integration

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   cd client && npm install
   ```
2. Create environment file:
   ```bash
   copy .env.example .env
   ```
3. Update the values in `.env`
4. Start the backend:
   ```bash
   npm start
   ```
5. Start the frontend:
   ```bash
   cd client
   npm run dev
   ```

## Production Build

```bash
cd client
npm run build
```

The backend serves the built frontend when the `dist` folder exists.

## Deployment

This project is ready for deployment on Render or a similar Node hosting platform.

### Render quick setup

- Connect the GitHub repo
- Use the following build command:
  ```bash
  npm install && cd client && npm install && npm run build
  ```
- Use the following start command:
  ```bash
  npm start
  ```
- Add environment variables:
  - `PORT=5000`
  - `JWT_SECRET=your-secret`
  - `MONGODB_URI=your-mongodb-connection-string`
  - `GEMINI_API_KEY=your-gemini-key`

## Release Notes

See [RELEASE.md](RELEASE.md) for the project release description and changelog summary.
