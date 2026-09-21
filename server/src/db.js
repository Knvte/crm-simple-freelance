const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'crm.sqlite')

fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const db = new Database(dbPath)

db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT 'Contact WhatsApp',
    company TEXT,
    phone TEXT UNIQUE NOT NULL,
    email TEXT,
    status TEXT NOT NULL DEFAULT 'Prospect',
    last_contact TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(contact_id) REFERENCES contacts(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
  CREATE INDEX IF NOT EXISTS idx_notes_contact_id ON notes(contact_id);
`)

function normalizePhoneNumber(rawPhone) {
  if (!rawPhone) {
    return ''
  }

  const digits = String(rawPhone).replace(/\D/g, '')

  if (!digits) {
    return ''
  }

  return `+${digits}`
}

function sanitizeText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function findContactByPhone(phone) {
  const normalized = normalizePhoneNumber(phone)

  if (!normalized) {
    return null
  }

  return db.prepare('SELECT * FROM contacts WHERE phone = ?').get(normalized)
}

function upsertContactFromWhatsApp({ phone, name, company, resume }) {
  const normalizedPhone = normalizePhoneNumber(phone)

  if (!normalizedPhone) {
    throw new Error('Numéro WhatsApp invalide : impossible de créer ou mettre à jour le contact.')
  }

  const contactName = sanitizeText(name) || 'Contact WhatsApp'
  const companyName = sanitizeText(company)
  const summary = sanitizeText(resume) || 'Message WhatsApp reçu.'
  const now = new Date().toISOString()

  const existing = findContactByPhone(normalizedPhone)

  if (existing) {
    db.prepare(
      'INSERT INTO notes (contact_id, text, created_at) VALUES (?, ?, ?)',
    ).run(existing.id, summary, now)

    db.prepare(
      'UPDATE contacts SET last_contact = ?, updated_at = ? WHERE id = ?',
    ).run(now, now, existing.id)

    console.log(`[CRM] Contact existant mis à jour : ${existing.name} (${normalizedPhone})`)
    return { action: 'updated', contactId: existing.id }
  }

  const result = db.prepare(
    `INSERT INTO contacts (name, company, phone, email, status, last_contact, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'Prospect', ?, ?, ?)`,
  ).run(contactName, companyName || null, normalizedPhone, '', now, now, now)

  const contactId = Number(result.lastInsertRowid)

  db.prepare('INSERT INTO notes (contact_id, text, created_at) VALUES (?, ?, ?)').run(
    contactId,
    summary,
    now,
  )

  console.log(`[CRM] Nouveau contact créé : ${contactName} (${normalizedPhone})`)
  return { action: 'created', contactId }
}

function getAllContacts() {
  const rows = db.prepare(`
    SELECT c.*, 
      json_group_array(
        json_object('id', n.id, 'text', n.text, 'created_at', n.created_at)
      ) AS notes_json
    FROM contacts c
    LEFT JOIN notes n ON n.contact_id = c.id
    GROUP BY c.id
    ORDER BY c.last_contact DESC, c.created_at DESC
  `).all()

  return rows.map((row) => {
    let notes = []

    try {
      const rawNotes = row.notes_json
      notes = Array.isArray(JSON.parse(rawNotes || '[]')) ? JSON.parse(rawNotes || '[]') : []
    } catch (error) {
      notes = []
    }

    return {
      id: row.id,
      name: row.name,
      company: row.company,
      phone: row.phone,
      email: row.email,
      status: row.status,
      last_contact: row.last_contact,
      created_at: row.created_at,
      updated_at: row.updated_at,
      notes,
    }
  })
}

function createContactFromClient(payload) {
  const name = sanitizeText(payload.name) || 'Contact WhatsApp'
  const phone = normalizePhoneNumber(payload.phone)
  const company = sanitizeText(payload.company)
  const email = sanitizeText(payload.email)
  const status = sanitizeText(payload.status) || 'Prospect'
  const lastContact = sanitizeText(payload.last_contact || payload.lastContact) || new Date().toISOString()

  if (!phone) {
    throw new Error('Le téléphone est obligatoire pour créer un contact.')
  }

  const existing = findContactByPhone(phone)
  if (existing) {
    return existing
  }

  const result = db.prepare(
    `INSERT INTO contacts (name, company, phone, email, status, last_contact, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(name, company || null, phone, email || null, status, lastContact, new Date().toISOString(), new Date().toISOString())

  const contactId = Number(result.lastInsertRowid)

  return {
    id: contactId,
    name,
    company: company || null,
    phone,
    email: email || null,
    status,
    last_contact: lastContact,
    notes: [],
  }
}

function initDatabase() {
  console.log(`[DB] Base SQLite initialisée : ${dbPath}`)
  return db
}

module.exports = {
  db,
  initDatabase,
  findContactByPhone,
  upsertContactFromWhatsApp,
  normalizePhoneNumber,
  getAllContacts,
  createContactFromClient,
}
