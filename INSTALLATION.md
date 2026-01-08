# Quick Installation Guide

## Local Development

1. **Prerequisites**
   - Node.js 18+
   - PostgreSQL
   - FFmpeg

2. **Setup**
   ```bash
   cd vetrecord-pro
   npm install
   cp .env.example .env
   # Edit .env with your values
   psql -U postgres -f database-schema.sql
   npm run db:push
   npm run dev
   ```

3. **Login**
   - Open `http://localhost:5000`
   - Use the username/password configured in `.env`

## Getting API Keys

**OpenAI API Key:**
1. Go to https://platform.openai.com/api-keys
2. Create new secret key
3. Copy and add to your environment

**Session Secret:**
Generate a random string:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**App Login (POC):**
Set `APP_USERNAME` and `APP_PASSWORD` in `.env` to control the single-user login.

## Troubleshooting

- **Audio not working**: Check microphone permissions
- **Transcription fails**: Verify OpenAI API key and credits
- **Database errors**: Check DATABASE_URL connection string
- **FFmpeg errors**: Ensure FFmpeg is installed and in PATH
