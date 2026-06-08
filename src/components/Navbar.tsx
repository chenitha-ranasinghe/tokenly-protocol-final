'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import GlobalTicker from '@/components/GlobalTicker';
import { usePrivy } from '@privy-io/react-auth';
import { useAuthStore } from '@/lib/store';
import { clearAuth } from '@/lib/client';
import NotificationBell from '@/components/NotificationBell';
import styles from './Navbar.module.css';

interface SearchHit {
  id: string;
  name?: string;
  sku?: string;
  category?: string;
  type?: string;
  brand?: string;
  live_price?: number;
}

export default function Navbar() {
  const { user: privyUser, logout: privyLogout, login: privyLogin, ready, authenticated } = usePrivy();
  const manualUser = useAuthStore(state => state.user);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
   const pathname = usePathname();
   const [searchQuery, setSearchQuery] = useState('');
   const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
   const [isSearching, setIsSearching] = useState(false);
 
   // Feature 4: Smart Search Debounce
   useEffect(() => {
     if (searchQuery.length < 2) {
       setSearchResults([]);
       return;
     }
     const timeout = setTimeout(async () => {
       setIsSearching(true);
       try {
         const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
         const data = await res.json();
         if (data.success) setSearchResults(data.results);
       } finally {
         setIsSearching(false);
       }
     }, 300);
     return () => clearTimeout(timeout);
   }, [searchQuery]);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  // Close on Escape for accessibility
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setSearchQuery('');
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('global-search-input')?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleLogout = async () => {
    if (authenticated) {
      await privyLogout();
    }
    clearAuth();
    router.push('/');
    router.refresh();
  };

  const navigate = (href: string) => {
    setMenuOpen(false);
    router.push(href);
  };

  // Consider the user authenticated if either Privy is ready/authed OR we have a manual session.
  const isAuthed = (ready && authenticated && privyUser) || !!manualUser;

  const navLinks = [
    { href: '/products', label: 'Review', icon: '◆' },
    { href: '/vault', label: 'Vault', icon: '▣' },
    { href: '/portfolio', label: 'Portfolio', icon: '◈' },
    { href: '/dashboard', label: 'Dashboard', icon: '◎' },
    { href: '/market', label: 'Market', icon: '◬' },
    { href: '/can', label: 'CAN', icon: '⬡' },
    { href: '/leaderboard', label: 'Ranks', icon: '△' },
    { href: '/analytics', label: 'Analytics', icon: '◫' },
    { href: '/archionlabs', label: 'Archion', icon: '⚗' },
    { href: '/construction', label: 'Build', icon: '⌂' },
    { href: '/resale', label: 'Resale', icon: '↻' },
  ];

  const isAdmin = (manualUser?.email || '').toLowerCase() === 'admin@tokenly.luxury' || manualUser?.is_admin === 1;
  if (isAdmin) {
    navLinks.push({ href: '/admin', label: 'Admin', icon: '⚙' });
  }

  // Helper to get initials or wallet display
  const getDisplayIdentity = () => {
    if (privyUser) {
      if (privyUser.email) return privyUser.email.address;
      if (privyUser.wallet) return `${privyUser.wallet.address.substring(0, 4)}...${privyUser.wallet.address.substring(38)}`;
    }
    if (manualUser) return manualUser.email || manualUser.name || 'User';
    return 'User';
  };

  const displayIdentity = getDisplayIdentity();
  const initials = displayIdentity.substring(0, 2).toUpperCase();

  return (
    <>
      {/* Skip to content (Accessibility) */}
      <a href="#main-content" className="skip-to-content">Skip to Content</a>

      <div className={styles.shell}>
        <GlobalTicker className="w-full overflow-hidden bg-black border-b border-[var(--border-gold)] h-7 flex items-center relative z-[70]" />
        <nav role="navigation" aria-label="Main navigation" className={styles.navBar}>
          <div className={styles.left}>
            <a
              href={isAuthed ? "/dashboard" : "/"}
              onClick={(e) => { e.preventDefault(); navigate(isAuthed ? "/dashboard" : "/"); }}
              aria-label="Tokenly Home"
              className={styles.logo}
            >
              <div className={styles.mark}>T</div>
              <div className={styles.logoInfo}>
                <span className={styles.wordmark}>Tokenly</span>
                <div className={styles.protocolStatus}>
                  <div className={`${styles.statusIndicator} animate-pulse`} />
                  <span className={styles.statusText}>Protocol Live</span>
                </div>
              </div>
            </a>

            {isAuthed && (
              <div className={styles.desktopNav}>
                {/* Feature 4: Global Smart Search */}
                <div className={styles.searchContainer}>
                  <div className={styles.searchWrapper}>
                    <input 
                      id="global-search-input"
                      type="text" 
                      placeholder="Search Protocol..." 
                      className={styles.searchInput}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <div className="absolute right-3 flex items-center gap-2 pointer-events-none">
                      <span className="hidden sm:flex items-center justify-center bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[8px] font-mono text-[var(--text-muted)]">⌘K</span>
                      <span className={styles.searchIcon}>🔍</span>
                    </div>
                  </div>
                  
                  {searchResults.length > 0 && (
                    <div className={styles.searchResults}>
                      {searchResults.map(p => (
                        <div 
                          key={p.id} 
                          onClick={() => { navigate(`/vault/${p.id}`); setSearchQuery(''); }}
                          className={styles.searchResultItem}
                        >
                          <div className={styles.resultName}>{p.name}</div>
                          <div className={styles.resultMeta}>
                            <span className={styles.resultBrand}>{p.brand ?? ''}</span>
                            <span className={styles.resultPrice}>${(p.live_price ?? 0).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {navLinks.map(l => {
                  const active = pathname === l.href;
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setMenuOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={`${styles.link} ${active ? styles.linkActive : ''}`}
                    >
                      {l.label}
                      {active && <span className={styles.activeUnderline} />}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className={styles.right}>
            {isAuthed ? (
              <>
                <NotificationBell />

                <div
                  onClick={() => navigate('/dashboard')}
                  role="button"
                  tabIndex={0}
                  aria-label={`Profile: ${getDisplayIdentity()}`}
                  onKeyDown={e => e.key === 'Enter' && navigate('/dashboard')}
                  className={styles.avatar}
                  title={getDisplayIdentity()}
                >
                  {initials}
                </div>

                <button
                  onClick={handleLogout}
                  aria-label="Log out"
                  title="Terminate Web3 Session"
                  className={styles.iconButton}
                >
                  ✕
                </button>

                <button
                  className={`${styles.hamburger} ${menuOpen ? styles.hamburgerActive : ''}`}
                  onClick={() => setMenuOpen(!menuOpen)}
                  aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                  aria-expanded={menuOpen}
                  aria-controls="mobile-nav-menu"
                >
                  <span className={styles.hamburgerLine} />
                  <span className={styles.hamburgerLine} />
                  <span className={styles.hamburgerLine} />
                </button>
              </>
            ) : (
              <div className={styles.ctaGroup}>
                <Link className={styles.ctaGhost} href="/explorer">Explorer</Link>
                {process.env.NODE_ENV === 'development' && (
                  <button
                    type="button"
                    className={styles.ctaGhost}
                    onClick={async () => {
                      const res = await fetch('/api/auth/demo', { method: 'POST' });
                      if (res.ok) window.location.href = '/dashboard';
                    }}
                    style={{ color: 'var(--rolex-gold)', borderColor: 'var(--rolex-gold)' }}
                  >
                    God Mode
                  </button>
                )}
                <button
                  type="button"
                  className={styles.ctaPrimary}
                  onClick={() => privyLogin()}
                  disabled={!ready}
                  aria-disabled={!ready}
                >
                  Connect
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* Spacer for fixed nav */}
      <div className={styles.spacer} />

      {/* Mobile Menu Overlay */}
      {isAuthed && (
        <div
          id="mobile-nav-menu"
          className={`${styles.mobileMenu} ${menuOpen ? styles.mobileMenuOpen : ''}`}
          role="navigation"
          aria-label="Mobile navigation"
        >
          {navLinks.map(l => (
            <a
              key={l.href}
              href={l.href}
              onClick={e => { e.preventDefault(); navigate(l.href); }}
              className={`${styles.mobileLink} ${pathname === l.href ? styles.mobileLinkActive : ''}`}
              aria-current={pathname === l.href ? 'page' : undefined}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ color: 'var(--rolex-gold)', fontSize: '0.9rem' }}>{l.icon}</span>
                {l.label}
              </span>
              <span className={styles.mobileLinkAfter}>→</span>
            </a>
          ))}

          <div className={styles.mobileFooter}>
            <div className={styles.mobileFooterLabel}>Web3 Identity</div>
            <div className={styles.mobileFooterIdentity}>{getDisplayIdentity()}</div>
            <button onClick={handleLogout} className={styles.mobileLogout}>
              Terminate Session
            </button>
          </div>
        </div>
      )}
    </>
  );
}
