# LUME Experience — WhatsApp Review Manager

Standalone application connected to the official Meta WhatsApp Cloud API.

## What it does

- Captures new contacts automatically when they message the connected WhatsApp Business number.
- Stores the WhatsApp profile name and number without manual entry.
- Lets an administrator mark consent as accepted, pending, or opted out.
- Sends one approved WhatsApp template to every eligible contact with one click.
- Tracks sent, delivered, read, and failed statuses through Meta webhooks.
- Provides two experience routes: **Satisfait** and **Besoin d’aide**.
- Sends satisfied contacts to the Google review page.
- Creates a private support ticket for people who need help.
- Keeps the Google review option visible in both routes.
- Automatically handles common STOP messages.

## Local launch

```bash
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:4000`.

The default development administrator key is:

```text
local-development-key
```

Change `ADMIN_API_KEY` before deployment.

## Connect Meta WhatsApp

Set these variables in `.env` or in the hosting dashboard:

```env
WHATSAPP_MODE=cloud
META_ACCESS_TOKEN=...
META_PHONE_NUMBER_ID=...
META_WEBHOOK_VERIFY_TOKEN=...
PUBLIC_APP_URL=https://your-domain.com
GOOGLE_REVIEW_URL=https://search.google.com/local/writereview?placeid=YOUR_PLACE_ID
```

Configure this webhook in Meta:

```text
https://your-domain.com/api/webhooks/whatsapp
```

Subscribe to the `messages` webhook field.

## Required WhatsApp template

Create an approved template named `lume_experience_request` or change `META_TEMPLATE_NAME`.

Suggested message:

```text
Bonjour {{1}},

Merci d’avoir découvert ou échangé avec LUME.
Comment décririez-vous votre expérience avec notre showroom ou notre équipe ?
```

Add two dynamic URL buttons:

1. **Satisfait** → `https://your-domain.com/experience/{{1}}/satisfied`
2. **Besoin d’aide** → `https://your-domain.com/experience/{{1}}/help`

The app inserts a unique token into both URLs.

## Testing an incoming contact

With the server running, simulate Meta’s incoming-message webhook:

```bash
curl -X POST http://localhost:4000/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "entry":[{
      "changes":[{
        "value":{
          "contacts":[{"wa_id":"212600000000","profile":{"name":"Client Test"}}],
          "messages":[{"from":"212600000000","text":{"body":"Bonjour"}}]
        }
      }]
    }]
  }'
```

Open **Audience**, change the contact consent to **Accepté**, then use **Envoyer maintenant** on the dashboard.

In `WHATSAPP_MODE=mock`, the message is marked delivered without contacting Meta.

## Deploy

The folder includes Docker and Railway configuration. It can also run on Render, Fly.io, or a VPS.

SQLite needs persistent disk storage in production. For a larger multi-worker deployment, move the database to PostgreSQL or Supabase.

## Safety

Never commit `.env`, Meta access tokens, or administrator keys. Only send campaigns to contacts with valid permission, and keep opt-out handling active.
