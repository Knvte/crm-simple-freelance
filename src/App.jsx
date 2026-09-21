import { useEffect, useMemo, useState } from 'react'
import './App.css'
import AddContactForm from './components/AddContactForm'
import ContactDetail from './components/ContactDetail'
import ContactList from './components/ContactList'
import DashboardHeader from './components/DashboardHeader'
import SearchBar from './components/SearchBar'

const STORAGE_KEY = 'crm-freelance-contacts'
const API_BASE_URL = 'http://localhost:3000'

const initialContacts = [
  {
    id: '1',
    name: 'Koffi Yao',
    company: 'Yao Studio',
    phone: '+225 07 66 12 34',
    email: 'contact@yaostudio.ci',
    status: 'À relancer',
    lastContact: '2026-09-01',
    notes: [
      { id: 'n1', text: 'Appel : intéressé par la refonte de site.', createdAt: '2026-09-01T10:15:00.000Z' },
      { id: 'n2', text: 'Premier contact par WhatsApp.', createdAt: '2026-09-06T13:10:00.000Z' },
    ],
  },
  {
    id: '2',
    name: 'Lina Dembele',
    company: 'Atelier Lune',
    phone: '+225 05 88 44 90',
    email: 'hello@atelierlune.com',
    status: 'Client',
    lastContact: '2026-09-18',
    notes: [{ id: 'n3', text: 'Mission de branding validée.', createdAt: '2026-09-18T09:30:00.000Z' }],
  },
  {
    id: '3',
    name: 'Moussa Nguessan',
    company: 'Nessa Events',
    phone: '+225 01 45 89 12',
    email: '',
    status: 'En négociation',
    lastContact: '',
    notes: [{ id: 'n4', text: 'Rencontre prévue cette semaine.', createdAt: '2026-09-20T15:45:00.000Z' }],
  },
]

function App() {
  // useState permet de conserver les contacts entre deux rendus.
  // Lorsque setContacts est appelé, React re-rend l'interface avec les nouvelles données.
  const [contacts, setContacts] = useState(() => {
    try {
      const storedContacts = localStorage.getItem(STORAGE_KEY)

      if (!storedContacts) {
        return initialContacts
      }

      const parsedContacts = JSON.parse(storedContacts)
      if (!Array.isArray(parsedContacts)) {
        return initialContacts
      }

      return parsedContacts
    } catch (error) {
      console.error('Données locales invalides:', error)
      return initialContacts
    }
  })

  const [selectedContactId, setSelectedContactId] = useState(initialContacts[0]?.id ?? null)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('priority')
  const [isFormOpen, setIsFormOpen] = useState(false)

  function normalizeContactFromApi(contact) {
    const normalizedNotes = Array.isArray(contact.notes)
      ? contact.notes.map((note) => ({
          id: String(note.id ?? crypto.randomUUID()),
          text: note.text ?? '',
          createdAt: note.created_at ?? note.createdAt ?? new Date().toISOString(),
        }))
      : []

    return {
      id: String(contact.id),
      name: contact.name ?? 'Contact',
      company: contact.company ?? '',
      phone: contact.phone ?? '',
      email: contact.email ?? '',
      status: contact.status ?? 'Prospect',
      lastContact: contact.last_contact ?? contact.lastContact ?? '',
      notes: normalizedNotes,
    }
  }

  async function loadContactsFromApi() {
    try {
      const response = await fetch(`${API_BASE_URL}/contacts`)

      if (!response.ok) {
        throw new Error('Impossible de charger les contacts depuis le backend')
      }

      const payload = await response.json()
      const normalizedContacts = (payload.contacts || []).map(normalizeContactFromApi)

      if (normalizedContacts.length > 0) {
        setContacts(normalizedContacts)
      }
    } catch (error) {
      console.warn('[CRM] Chargement depuis le backend impossible, utilisation du cache local.', error)
    }
  }

  useEffect(() => {
    loadContactsFromApi()
  }, [])

  // useEffect sert ici à synchroniser le state React avec le localStorage.
  // Chaque fois que 'contacts' change, React exécute cet effet et enregistre la liste.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts))
  }, [contacts])

  // useMemo sert à calculer des données dérivées qui ne doivent pas être recalculées inutilement.
  // Ici, on recalculera uniquement quand la recherche, le tri ou les contacts changent.
  const filteredContacts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    const searched = normalizedSearch
      ? contacts.filter((contact) => contact.name.toLowerCase().includes(normalizedSearch))
      : [...contacts]

    return [...searched].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'status':
          return a.status.localeCompare(b.status)
        case 'lastContact': {
          const dateA = a.lastContact ? new Date(a.lastContact) : new Date('9999-12-31')
          const dateB = b.lastContact ? new Date(b.lastContact) : new Date('9999-12-31')
          return dateA - dateB
        }
        case 'priority':
          return Number(isPriorityContact(b)) - Number(isPriorityContact(a)) || a.name.localeCompare(b.name)
        default:
          return 0
      }
    })
  }, [contacts, searchTerm, sortBy])

  const stats = useMemo(() => {
    const total = contacts.length
    const clients = contacts.filter((contact) => contact.status === 'Client').length
    const priority = contacts.filter(isPriorityContact).length

    return { total, clients, priority }
  }, [contacts])

  const selectedContact =
    contacts.find((contact) => contact.id === selectedContactId) ?? contacts[0] ?? null

  // Les props permettent de passer des données d'un composant parent vers un composant enfant.
  // App transmet les contacts, la recherche et les callbacks à ContactList / ContactDetail / SearchBar.
  // La donnée circule du parent vers l'enfant, puis les événements remontent via des fonctions.

  function isPriorityContact(contact) {
    if (!contact || contact.status !== 'À relancer') {
      return false
    }

    if (!contact.lastContact) {
      return true
    }

    const lastContactDate = new Date(`${contact.lastContact}T12:00:00`)
    const today = new Date()
    const differenceInDays = (today - lastContactDate) / (1000 * 60 * 60 * 24)

    return differenceInDays > 7
  }

  function addContact(newContact) {
    const cleanName = newContact.name?.trim()
    const cleanPhone = newContact.phone?.trim()

    if (!cleanName || !cleanPhone) {
      window.alert('Le nom et le téléphone sont obligatoires.')
      return
    }

    const payload = {
      name: cleanName,
      company: newContact.company?.trim() || '',
      phone: cleanPhone,
      email: newContact.email?.trim() || '',
      status: newContact.status || 'Prospect',
      last_contact: newContact.lastContact || new Date().toISOString().slice(0, 10),
    }

    fetch(`${API_BASE_URL}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Le backend a refusé la création du contact')
        }

        return response.json()
      })
      .then((data) => {
        const nextContact = normalizeContactFromApi(data.contact || data)

        setContacts((currentContacts) => [nextContact, ...currentContacts.filter((contact) => contact.phone !== nextContact.phone)])
        setSelectedContactId(nextContact.id)
        setIsFormOpen(false)
      })
      .catch((error) => {
        console.error('[CRM] Erreur lors de l’ajout du contact via l’API :', error)
        window.alert('Le contact n’a pas pu être enregistré sur le backend. Vérifiez le serveur.')
      })
  }

  function updateContactStatus(contactId, nextStatus) {
    setContacts((currentContacts) =>
      currentContacts.map((contact) =>
        contact.id === contactId ? { ...contact, status: nextStatus } : contact,
      ),
    )
  }

  function updateLastContact(contactId, nextDate) {
    setContacts((currentContacts) =>
      currentContacts.map((contact) =>
        contact.id === contactId ? { ...contact, lastContact: nextDate } : contact,
      ),
    )
  }

  function addNote(contactId, noteText) {
    const newNote = {
      id: crypto.randomUUID(),
      text: noteText,
      createdAt: new Date().toISOString(),
    }

    setContacts((currentContacts) =>
      currentContacts.map((contact) => {
        if (contact.id !== contactId) {
          return contact
        }

        const updatedNotes = [...(contact.notes || []), newNote]
        const latestDate = new Date(newNote.createdAt).toISOString().slice(0, 10)

        return {
          ...contact,
          notes: updatedNotes,
          lastContact: latestDate,
        }
      }),
    )
  }

  function deleteContact(contactId) {
    const contactToDelete = contacts.find((contact) => contact.id === contactId)

    if (!contactToDelete) {
      return
    }

    const confirmed = window.confirm(`Supprimer ${contactToDelete.name} ? Cette action est irréversible.`)
    if (!confirmed) {
      return
    }

    setContacts((currentContacts) => currentContacts.filter((contact) => contact.id !== contactId))

    if (selectedContactId === contactId) {
      setSelectedContactId(null)
    }
  }

  return (
    <div className="crm-app">
      <DashboardHeader stats={stats} />

      <div className="toolbar">
        <SearchBar value={searchTerm} onChange={setSearchTerm} onClear={() => setSearchTerm('')} />

        <div className="toolbar-actions">
          <label className="sort-select">
            <span>Trier par</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="priority">Priorité</option>
              <option value="name">Nom</option>
              <option value="status">Statut</option>
              <option value="lastContact">Date du dernier contact</option>
            </select>
          </label>

          <button type="button" className="primary-button" onClick={() => setIsFormOpen(true)}>
            + Ajouter
          </button>
        </div>
      </div>

      <main className="dashboard-layout">
        <section className="list-panel">
          {filteredContacts.length === 0 ? (
            <div className="empty-box">
              <h2>{contacts.length === 0 ? 'Aucun contact pour le moment' : 'Aucun résultat'}</h2>
              <p>
                {contacts.length === 0
                  ? 'Ajoutez votre premier prospect pour commencer à construire votre pipeline.'
                  : 'Essayez un autre nom ou effacez la recherche.'}
              </p>
            </div>
          ) : (
            <ContactList
              contacts={filteredContacts.map((contact) => ({
                ...contact,
                priority: isPriorityContact(contact),
              }))}
              selectedId={selectedContactId}
              onSelectContact={setSelectedContactId}
              onDeleteContact={deleteContact}
            />
          )}
        </section>

        <ContactDetail
          contact={selectedContact ? { ...selectedContact, priority: isPriorityContact(selectedContact) } : null}
          onStatusChange={updateContactStatus}
          onDelete={deleteContact}
          onAddNote={addNote}
          onDateChange={updateLastContact}
        />
      </main>

      {isFormOpen && <AddContactForm onSubmit={addContact} onClose={() => setIsFormOpen(false)} />}
    </div>
  )
}

export default App
