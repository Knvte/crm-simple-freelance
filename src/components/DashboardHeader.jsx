const pipelineStatuses = [
  { key: 'Prospect', label: 'Prospects', className: 'prospect' },
  { key: 'En négociation', label: 'Négociation', className: 'negotiation' },
  { key: 'Client', label: 'Clients', className: 'client' },
  { key: 'À relancer', label: 'À relancer', className: 'priority' },
]

function DashboardHeader({ stats, contacts }) {
  const statusCounts = pipelineStatuses.map((status) => ({
    ...status,
    count: contacts.filter((contact) => contact.status === status.key).length,
  }))
  const conversionRate = stats.total > 0 ? Math.round((stats.clients / stats.total) * 100) : 0
  const highestCount = Math.max(...statusCounts.map((status) => status.count), 1)

  return (
    <header className="dashboard-header">
      <div className="header-intro">
        <p className="eyebrow">CRM freelance</p>
        <h1>Suivi commercial</h1>
        <p className="header-subtitle">Une vue claire de vos opportunités, au même endroit.</p>
      </div>

      <div className="header-visuals">
        <div className="pipeline-chart" aria-label="Répartition des contacts par statut">
          <div className="visual-heading">
            <span>Pipeline</span>
            <span className="visual-total">{stats.total} contacts</span>
          </div>
          <div className="pipeline-bars">
            {statusCounts.map((status) => (
              <div className="pipeline-row" key={status.key}>
                <span className={`pipeline-dot ${status.className}`} aria-hidden="true" />
                <span className="pipeline-label">{status.label}</span>
                <div className="pipeline-track" aria-hidden="true">
                  <span
                    className={`pipeline-fill ${status.className}`}
                    style={{ width: `${(status.count / highestCount) * 100}%` }}
                  />
                </div>
                <strong>{status.count}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="conversion-card" aria-label={`${conversionRate}% de conversion en clients`}>
          <div className="conversion-ring" style={{ '--conversion': `${conversionRate}%` }}>
            <strong>{conversionRate}%</strong>
            <span>clients</span>
          </div>
          <div>
            <span className="label">Conversion</span>
            <p>Contacts devenus clients</p>
          </div>
        </div>
      </div>
    </header>
  )
}

export default DashboardHeader
