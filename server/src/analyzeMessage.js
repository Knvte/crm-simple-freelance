async function analyzeMessage(messageText) {
  const text = String(messageText || '').trim()

  if (!text) {
    return {
      nom: '',
      entreprise: '',
      resume: '',
      contact_probable: false,
      ignored_reason: 'Message vide',
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[AI] Aucune clé ANTHROPIC_API_KEY détectée. Analyse simulée désactivée.')
    return {
      nom: '',
      entreprise: '',
      resume: text,
      contact_probable: true,
    }
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: `Tu es un assistant d’extraction de données pour CRM.

Extrait uniquement les informations utiles dans ce message WhatsApp.
Retourne uniquement un JSON valide, sans texte autour.

Règles :
- Extrait le nom si présent.
- Extrait l'entreprise si présent.
- Résume le besoin ou l’intention du message en 1 ou 2 phrases.
- Si le message est une salutation simple, du spam, un message sans vrai besoin commercial ou sans information exploitable, mets "contact_probable": false.
- Sinon mets "contact_probable": true.

Format exact :
{
  "nom": "...",
  "entreprise": "...",
  "resume": "...",
  "contact_probable": true
}

Message à analyser :
${text}`,
          },
        ],
      }),
    })

    const rawResponseText = await response.text()

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} - ${rawResponseText}`)
    }

    const data = JSON.parse(rawResponseText)
    const content = data?.content?.[0]?.text || ''

    if (!content) {
      throw new Error('Réponse Claude vide ou mal structurée.')
    }

    const cleaned = content.replace(/```json|```/gi, '').trim()
    const parsed = JSON.parse(cleaned)

    if (typeof parsed.contact_probable !== 'boolean') {
      parsed.contact_probable = false
    }

    console.log('[AI] Analyse terminée :', parsed)
    return parsed
  } catch (error) {
    console.error('[AI] Erreur pendant l’analyse du message :', error.message)
    return {
      nom: '',
      entreprise: '',
      resume: text,
      contact_probable: false,
      ignored_reason: 'Erreur d’analyse IA',
    }
  }
}

module.exports = {
  analyzeMessage,
}
