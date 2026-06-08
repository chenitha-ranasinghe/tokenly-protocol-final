export default function Loading() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      zIndex: 10,
    }}>
      <div className="loading-spinner" style={{
        borderTopColor: 'var(--emerald-accent)',
        boxShadow: 'var(--emerald-glow)',
      }} />
      <p style={{
        marginTop: 24,
        fontSize: '0.7rem',
        textTransform: 'uppercase',
        letterSpacing: '0.2em',
        color: 'var(--text-muted)',
      }}>
        Synchronizing Protocol...
      </p>
    </div>
  );
}
