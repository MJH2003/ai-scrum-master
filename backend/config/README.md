# Environment Configuration Templates

This directory contains environment configuration templates for different deployment stages.

## Files

| File | Purpose |
|------|---------|
| `.env.development` | Local development settings |
| `.env.staging` | Staging environment settings |
| `.env.production` | Production environment settings |

## Usage

### Local Development

1. Copy the development config to the backend root:
   ```bash
   cp config/.env.development .env
   ```

2. Update the `.env` file with your API keys (OpenAI, Anthropic, etc.)

3. Start the development server:
   ```bash
   pnpm dev
   ```

### Staging/Production

For staging and production environments, sensitive values should be injected via:

1. **Environment Variables** - Set directly in your deployment platform
2. **Kubernetes Secrets** - See `/k8s/secrets.template.yaml`
3. **Secrets Manager** - AWS Secrets Manager, HashiCorp Vault, etc.

## Required Secrets

The following values must be provided as secrets (never commit these!):

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | JWT signing secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | Refresh token secret (min 32 chars) |
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `GOOGLE_AI_API_KEY` | Google AI API key |

## Generating Secrets

```bash
# Generate a secure random secret
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"

# Or using OpenSSL
openssl rand -base64 64
```

## Validation

The application validates all required environment variables at startup. If any required variable is missing, the application will fail to start with a descriptive error message.

See `src/config/configuration.ts` for the full configuration schema.
