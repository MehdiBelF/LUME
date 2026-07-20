import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import Database from 'better-sqlite3';

const PORT = Number(process.env.PORT || 4000);
const PUBLIC_APP_URL = (process.env.PUBLIC_APP_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const DATABASE_PATH = process.env.DATABASE_PATH || './data/lume-reviews.db';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'local-development-key';
const WHATSAPP_MODE = process.env.WHATSAPP_MODE || 'mock';
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v23.0';
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || '';
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID || '';
const META_WEBHOOK_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || '';
const META_TEMPLATE_NAME = process.env.META_TEMPLATE_NAME || 'lume_experience_request';
const META_TEMPLATE_LANGUAGE = process.env.META_TEMPLATE_LANGUAGE || 'fr';
const GOOGLE_REVIEW_URL = process.env.GOOGLE_REVIEW_URL || 'https://google.com';
const SEND_BATCH_SIZE = Number(process.env.SEND_BATCH_SIZE || 10);

fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });
const db = new Database(DATABASE_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  wa_id TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  name TEXT,
  consent_status TEXT NOT NULL DEFAULT 'pending',
  excluded INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'whatsapp',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS recipients (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  public_token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  meta_message_id TEXT,
  error_message TEXT,
  sent_at TEXT,
  delivered_at TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  recipient_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  sentiment TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  message TEXT,
  preferred_time TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`);

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;
const token = () => crypto.randomBytes(18).toString('base64url');
const digits = (value = '') => String(value).replace(/\D/g, '');

function requireAdmin(req, res, next) {
  if (req.header('x-admin-key') !== ADMIN_API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

function upsertContact({ waId, name = '', source = 'whatsapp' }) {
  const phone = digits(waId);
  const existing = db.prepare('SELECT * FROM contacts WHERE wa_id=?').get(phone);
  if (existing) {
    db.prepare('UPDATE contacts SET name=COALESCE(NULLIF(?,\'\'),name), updated_at=? WHERE id=?')
      .run(name, now(), existing.id);
    return db.prepare('SELECT * FROM contacts WHERE id=?').get(existing.id);
  }
  const row = { id: id('ctc'), wa_id: phone, phone, name, source, created_at: now(), updated_at: now() };
  db.prepare(`INSERT INTO contacts (id,wa_id,phone,name,source,created_at,updated_at)
              VALUES (@id,@wa_id,@phone,@name,@source,@created_at,@updated_at)`).run(row);
  return row;
}

async function sendTemplate(recipient, contact) {
  if (WHATSAPP_MODE === 'mock') return { id: `mock_${id('msg')}` };
  if (!META_ACCESS_TOKEN || !META_PHONE_NUMBER_ID) throw new Error('Meta credentials are missing');
  const endpoint = `https://graph.facebook.com/${META_GRAPH_VERSION}/${META_PHONE_NUMBER_ID}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: contact.phone,
    type: 'template',
    template: {
      name: META_TEMPLATE_NAME,
      language: { code: META_TEMPLATE_LANGUAGE },
      components: [
        { type: 'body', parameters: [{ type: 'text', text: contact.name || 'Bonjour' }] },
        { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: recipient.public_token }] },
        { type: 'button', sub_type: 'url', index: '1', parameters: [{ type: 'text', text: recipient.public_token }] }
      ]
    }
  };
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  return { id: data.messages?.[0]?.id };
}

async function processCampaign(campaignId) {
  const rows = db.prepare(`SELECT r.*, c.phone, c.name FROM recipients r
    JOIN contacts c ON c.id=r.contact_id
    WHERE r.campaign_id=? AND r.status='queued' LIMIT ?`).all(campaignId, SEND_BATCH_SIZE);
  for (const row of rows) {
    try {
      const sent = await sendTemplate(row, row);
      const timestamp = now();
      db.prepare(`UPDATE recipients SET status=?,meta_message_id=?,sent_at=?,delivered_at=?,updated_at=? WHERE id=?`)
        .run(WHATSAPP_MODE === 'mock' ? 'delivered' : 'sent', sent.id, timestamp,
          WHATSAPP_MODE === 'mock' ? timestamp : null, timestamp, row.id);
    } catch (error) {
      db.prepare(`UPDATE recipients SET status='failed',error_message=?,updated_at=? WHERE id=?`)
        .run(error instanceof Error ? error.message : 'Send failed', now(), row.id);
    }
  }
  const remaining = db.prepare(`SELECT COUNT(*) count FROM recipients WHERE campaign_id=? AND status='queued'`).get(campaignId).count;
  db.prepare('UPDATE campaigns SET status=?,updated_at=? WHERE id=?')
    .run(remaining ? 'sending' : 'completed', now(), campaignId);
  if (remaining) setTimeout(() => processCampaign(campaignId), 1500);
}

app.get('/api/health', (_req, res) => res.json({ ok: true, whatsappMode: WHATSAPP_MODE }));

app.get('/api/dashboard', requireAdmin, (_req, res) => {
  const scalar = (sql) => db.prepare(sql).get().count;
  res.json({
    contacts: scalar('SELECT COUNT(*) count FROM contacts'),
    eligible: scalar("SELECT COUNT(*) count FROM contacts WHERE consent_status='opted_in' AND excluded=0"),
    campaigns: scalar('SELECT COUNT(*) count FROM campaigns'),
    sent: scalar("SELECT COUNT(*) count FROM recipients WHERE status IN ('sent','delivered','read')"),
    delivered: scalar("SELECT COUNT(*) count FROM recipients WHERE status IN ('delivered','read')"),
    read: scalar("SELECT COUNT(*) count FROM recipients WHERE status='read'"),
    help: scalar("SELECT COUNT(*) count FROM feedback WHERE sentiment='help' AND status!='resolved'")
  });
});

app.get('/api/contacts', requireAdmin, (_req, res) => {
  res.json(db.prepare('SELECT * FROM contacts ORDER BY updated_at DESC').all());
});

app.patch('/api/contacts/:id', requireAdmin, (req, res) => {
  const allowed = ['pending', 'opted_in', 'opted_out'];
  if (!allowed.includes(req.body.consent_status)) return res.status(400).json({ error: 'Invalid consent status' });
  db.prepare('UPDATE contacts SET consent_status=?,excluded=?,updated_at=? WHERE id=?')
    .run(req.body.consent_status, req.body.excluded ? 1 : 0, now(), req.params.id);
  res.json({ ok: true });
});

app.post('/api/campaigns/send-all', requireAdmin, (req, res) => {
  const contacts = db.prepare("SELECT * FROM contacts WHERE consent_status='opted_in' AND excluded=0").all();
  if (!contacts.length) return res.status(400).json({ error: 'No eligible opted-in contacts' });
  const campaignId = id('cmp');
  const timestamp = now();
  db.prepare('INSERT INTO campaigns (id,name,status,created_at,updated_at) VALUES (?,?,?,?,?)')
    .run(campaignId, req.body.name || `Campagne ${new Date().toLocaleDateString('fr-MA')}`, 'queued', timestamp, timestamp);
  const insert = db.prepare(`INSERT INTO recipients
    (id,campaign_id,contact_id,public_token,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`);
  const tx = db.transaction(() => contacts.forEach((contact) =>
    insert.run(id('rcp'), campaignId, contact.id, token(), 'queued', timestamp, timestamp)));
  tx();
  void processCampaign(campaignId);
  res.json({ ok: true, campaignId, recipients: contacts.length });
});

app.get('/api/feedback', requireAdmin, (_req, res) => {
  res.json(db.prepare(`SELECT f.*, c.name contact_name, c.phone contact_phone FROM feedback f
    JOIN contacts c ON c.id=f.contact_id ORDER BY f.created_at DESC`).all());
});

app.patch('/api/feedback/:id/resolve', requireAdmin, (req, res) => {
  db.prepare("UPDATE feedback SET status='resolved',updated_at=? WHERE id=?").run(now(), req.params.id);
  res.json({ ok: true });
});

app.get('/api/webhooks/whatsapp', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === META_WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(req.query['hub.challenge']);
  }
  res.sendStatus(403);
});

app.post('/api/webhooks/whatsapp', (req, res) => {
  const changes = req.body?.entry?.flatMap((entry) => entry.changes || []) || [];
  for (const change of changes) {
    const value = change.value || {};
    const profiles = new Map((value.contacts || []).map((c) => [c.wa_id, c.profile?.name || '']));
    for (const message of value.messages || []) {
      const contact = upsertContact({ waId: message.from, name: profiles.get(message.from) || '' });
      const text = String(message.text?.body || '').trim().toUpperCase();
      if (['STOP', 'ARRET', 'ARRÊT', 'DESABONNER', 'DÉSABONNER'].includes(text)) {
        db.prepare("UPDATE contacts SET consent_status='opted_out',updated_at=? WHERE id=?").run(now(), contact.id);
      }
    }
    for (const status of value.statuses || []) {
      const column = status.status === 'read' ? 'read_at' : status.status === 'delivered' ? 'delivered_at' : null;
      const normalized = ['sent', 'delivered', 'read', 'failed'].includes(status.status) ? status.status : 'sent';
      if (column) db.prepare(`UPDATE recipients SET status=?,${column}=?,updated_at=? WHERE meta_message_id=?`)
        .run(normalized, now(), now(), status.id);
      else db.prepare('UPDATE recipients SET status=?,updated_at=? WHERE meta_message_id=?')
        .run(normalized, now(), status.id);
    }
  }
  res.sendStatus(200);
});

app.get('/experience/:token/satisfied', (req, res) => {
  const recipient = db.prepare(`SELECT r.*, c.name, c.phone FROM recipients r JOIN contacts c ON c.id=r.contact_id
    WHERE r.public_token=?`).get(req.params.token);
  if (!recipient) return res.status(404).send('Lien invalide');
  res.send(`<!doctype html><html lang="fr"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/style.css"><body class="public"><main><div class="logo">LUME</div><h1>Merci pour votre retour.</h1><p>Votre avis sincère aide LUME à améliorer son expérience et à faire connaître son travail.</p><a class="primary" href="/review/${req.params.token}">Laisser un avis Google</a><a href="/experience/${req.params.token}/help">Envoyer un commentaire privé</a></main></body></html>`);
});

app.get('/experience/:token/help', (req, res) => {
  const recipient = db.prepare(`SELECT r.*, c.name, c.phone FROM recipients r JOIN contacts c ON c.id=r.contact_id
    WHERE r.public_token=?`).get(req.params.token);
  if (!recipient) return res.status(404).send('Lien invalide');
  res.send(`<!doctype html><html lang="fr"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/style.css"><body class="public"><main><div class="logo">LUME</div><h1>Comment pouvons-nous vous aider ?</h1><p>Expliquez-nous votre expérience. Notre équipe vous contactera pour chercher une solution.</p><form method="post"><input name="name" value="${escapeHtml(recipient.name || '')}" placeholder="Nom" required><input name="phone" value="${escapeHtml(recipient.phone || '')}" placeholder="WhatsApp" required><textarea name="message" placeholder="Votre message" required></textarea><input name="preferred_time" placeholder="Moment préféré pour être rappelé"><button>Envoyer ma demande</button></form><a href="/review/${req.params.token}">Laisser aussi un avis Google</a></main></body></html>`);
});

app.post('/experience/:token/help', (req, res) => {
  const recipient = db.prepare('SELECT * FROM recipients WHERE public_token=?').get(req.params.token);
  if (!recipient) return res.status(404).send('Lien invalide');
  db.prepare(`INSERT INTO feedback (id,recipient_id,contact_id,sentiment,name,phone,message,preferred_time,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(id('fbk'), recipient.id, recipient.contact_id, 'help', req.body.name,
      req.body.phone, req.body.message, req.body.preferred_time || '', 'new', now(), now());
  res.send(`<!doctype html><html lang="fr"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/style.css"><body class="public"><main><div class="logo">LUME</div><h1>Demande enregistrée.</h1><p>Notre équipe vous contactera prochainement.</p><a class="primary" href="/review/${req.params.token}">Laisser un avis Google</a></main></body></html>`);
});

app.get('/review/:token', (req, res) => {
  const recipient = db.prepare('SELECT id FROM recipients WHERE public_token=?').get(req.params.token);
  if (!recipient) return res.status(404).send('Lien invalide');
  res.redirect(302, GOOGLE_REVIEW_URL);
});

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

app.get('*', (_req, res) => res.sendFile(path.resolve('public/index.html')));
app.listen(PORT, () => console.log(`LUME Experience running on ${PUBLIC_APP_URL}`));
