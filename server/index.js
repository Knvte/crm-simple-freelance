require('dotenv').config({ path: require('path').join(__dirname, '.env') })

const express = require('express')
const cors = require('cors')
const { initDatabase, getAllContacts, createContactFromClient } = require('./src/db')
const { registerWebhookRoutes } = require('./src/webhook')

const app = express()
const port = Number(process.env.PORT || 3000)

// CORS est important ici, sinon le CRM React (port 5173) ne pourra pas appeler le backend (port 3000).
app.use(cors())

// Le backend Express parse le JSON reçu par Meta pour l'exploiter dans les routes webhook.
app.use(express.json({ limit: '1mb' }))

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'crm-whatsapp-webhook' })
})

app.get('/contacts', (req, res) => {
  try {
    const contacts = getAllContacts()
    res.json({ success: true, contacts })
  } catch (error) {
    console.error('[API] Erreur lors de la récupération des contacts :', error)
    res.status(500).json({ success: false, message: 'Erreur de lecture des contacts' })
  }
})

app.post('/contacts', (req, res) => {
  try {
    const contact = createContactFromClient(req.body || {})
    res.status(201).json({ success: true, contact })
  } catch (error) {
    console.error('[API] Erreur lors de la création du contact :', error)
    res.status(400).json({ success: false, message: error.message || 'Impossible de créer le contact' })
  }
})

// On centralise toute la logique du WhatsApp dans un fichier dédié pour garder le projet lisible.
registerWebhookRoutes(app)

app.use((error, req, res, next) => {
  console.error('[SERVER] Erreur non gérée :', error)
  res.status(500).json({ success: false, message: 'Erreur interne du serveur' })
})

initDatabase()

app.listen(port, () => {
  console.log(`[SERVER] Backend démarré sur http://localhost:${port}`)
  console.log('[SERVER] Variables utiles : WHATSAPP_VERIFY_TOKEN, ANTHROPIC_API_KEY')
})
