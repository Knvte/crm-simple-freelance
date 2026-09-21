const { upsertContactFromWhatsApp } = require('./db')
const { analyzeMessage } = require('./analyzeMessage')

function normalizePhoneNumber(rawPhone) {
  if (!rawPhone) {
    return ''
  }

  const digits = String(rawPhone).replace(/\D/g, '')
  return digits ? `+${digits}` : ''
}

async function processIncomingWebhookPayload(payload) {
  const entries = payload?.entry || []

  for (const entry of entries) {
    const changes = entry?.changes || []

    for (const change of changes) {
      const value = change?.value || {}
      const messages = value?.messages || []

      for (const message of messages) {
        if (message?.type !== 'text') {
          continue
        }

        const senderPhone = normalizePhoneNumber(message?.from)
        const rawText = message?.text?.body || ''

        if (!senderPhone || !rawText.trim()) {
          console.warn('[WEBHOOK] Message ignoré : données incomplètes.')
          continue
        }

        console.log(`[WEBHOOK] Message reçu de ${senderPhone} : ${rawText}`)

        try {
          const analysis = await analyzeMessage(rawText)

          if (!analysis || analysis.contact_probable === false) {
            console.log('[WEBHOOK] Message non pertinent, ignoré par l’IA.')
            continue
          }

          const result = upsertContactFromWhatsApp({
            phone: senderPhone,
            name: analysis.nom,
            company: analysis.entreprise,
            resume: analysis.resume,
          })

          console.log('[WEBHOOK] Action CRM effectuée :', result)
        } catch (error) {
          console.error('[WEBHOOK] Erreur lors du traitement du message :', error)
        }
      }
    }
  }
}

function registerWebhookRoutes(app) {
  app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      console.log('[WEBHOOK] Vérification Meta OK. Challenge renvoyé.')
      return res.status(200).send(String(challenge))
    }

    console.warn('[WEBHOOK] Vérification Meta refusée.')
    return res.status(403).send('Forbidden')
  })

  app.post('/webhook', (req, res) => {
    const payload = req.body || {}

    // Meta exige une réponse 200 immédiatement, même si on traite ensuite le message en arrière-plan.
    res.status(200).json({ success: true, received: true })

    // Traitement en asynchrone pour éviter de bloquer le webhook Meta.
    setImmediate(() => {
      processIncomingWebhookPayload(payload)
    })
  })
}

module.exports = {
  registerWebhookRoutes,
  processIncomingWebhookPayload,
}
