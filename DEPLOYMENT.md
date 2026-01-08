# Deployment Guide - VetRecord Pro

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL connection string | Yes |
| OPENAI_API_KEY | OpenAI API key for transcription | Yes |
| SESSION_SECRET | Random string for session encryption | Yes |
| APP_USERNAME | Single-user login username | Yes |
| APP_PASSWORD | Single-user login password | Yes |

## Deployment Steps (General)

1. Provision a PostgreSQL database and apply `database-schema.sql`.
2. Build and deploy the app with:
   ```bash
   npm install
   npm run build
   npm start
   ```
3. Set the required environment variables in your hosting provider.

## Health Checks

- `GET /` - Frontend application
- `GET /api/auth/user` - Authentication status

## Security Notes

- All API endpoints require authentication
- Audio files are user-scoped
- Session data is encrypted and stored securely
