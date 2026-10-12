import { Suspense, useEffect, useState, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Store, UtensilsCrossed, Package, Receipt, BarChart3, LogOut, Users, Sun, Moon, User } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { ROLE_HQ, ROLE_LABELS, ROLE_OUTLET, ROLE_SUPERADMIN } from '../constants/roles';
import { useOutletStore } from '../store/outlet';
import { useThemeStore } from '../store/theme';
import { logout } from '../api/auth';
import OutletSelector from './OutletSelector';
import Toast from './Toast';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { PageSkeleton } from './ui/skeleton';
import { preloadPages } from '../lib/routes';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/outlets', label: 'Outlets', icon: Store, hqOnly: true },
  { to: '/menu', label: 'Menu', icon: UtensilsCrossed },
  { to: '/menu/master', label: 'Master menu', icon: UtensilsCrossed, hqOnly: true },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/sales', label: 'Sales', icon: Receipt },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/users', label: 'Users', icon: Users, superadminOnly: true },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const user = useAuthStore((s) => s.user);
  const setSelectedOutletId = useOutletStore((s) => s.setSelectedOutletId);
  useEffect(() => {
    if (user?.role === ROLE_OUTLET && user?.outletId != null) setSelectedOutletId(user.outletId);
  }, [user?.role, user?.outletId, setSelectedOutletId]);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      clearAuth();
      navigate('/login', { replace: true });
    }
  };

  // Signed in: warm up every page's code so navigation never suspends on a chunk download.
  useEffect(() => {
    preloadPages();
  }, []);

  // The page scrolls inside <main>, so reset it on navigation like a full page load would.
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('click', fn);
    return () => document.removeEventListener('click', fn);
  }, []);
  const filteredNav = nav.filter((n) => {
    const hqOnly = 'hqOnly' in n && n.hqOnly;
    const superadminOnly = 'superadminOnly' in n && n.superadminOnly;
    if (superadminOnly) return user?.role === ROLE_SUPERADMIN;
    if (hqOnly) return user?.role === ROLE_HQ || user?.role === ROLE_SUPERADMIN;
    return true;
  });

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-56 flex-col border-r border-border bg-card">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
            <Store className="h-5 w-5 text-primary" />
            POS
          </Link>
        </div>
        <div className="flex flex-1 flex-col gap-1 p-2">
          <nav className="flex flex-1 flex-col gap-0.5">
            {filteredNav.map((item) => {
              const Icon = item.icon;
              const exactMatch = location.pathname === item.to;
              const childMatch = item.to !== '/' && location.pathname.startsWith(item.to + '/');
              const hasLongerMatch = filteredNav.some((n) => n.to !== item.to && n.to.startsWith(item.to) && location.pathname.startsWith(n.to));
              const active = exactMatch || (childMatch && !hasLongerMatch);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-out',
                    active
                      ? 'bg-primary/10 text-primary border-l-2 border-l-primary'
                      : 'border-l-2 border-l-transparent text-muted-foreground hover:translate-x-0.5 hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0 transition-colors duration-200', active && 'text-primary')} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-14 shrink-0 items-center justify-end gap-2 border-b border-border bg-card px-4">
          <OutletSelector />
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <div className="relative" ref={profileRef}>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setProfileOpen((o) => !o)} aria-label="Profile">
              <User className="h-4 w-4" />
            </Button>
            {profileOpen && user && (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] origin-top-right animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150 rounded-md border border-border bg-card py-2 shadow-lg">
                <div className="px-3 py-2 text-sm">
                  <p className="font-medium text-foreground">{user.username}</p>
                  <p className="text-xs text-muted-foreground">{ROLE_LABELS[user.role] ?? user.role}</p>
                </div>
                <Button variant="ghost" className="w-full justify-start gap-2 rounded-none px-3 text-muted-foreground hover:text-foreground" onClick={() => { setProfileOpen(false); handleLogout(); }}>
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </div>
            )}
          </div>
        </header>
        <main ref={mainRef} className="flex-1 overflow-auto">
          <Suspense fallback={<PageSkeleton />}>
            {/* Keyed by route: a subtle settle on navigation. Opacity is never animated here - fading
                the whole content area from 0 read as the page blinking. */}
            <div key={location.pathname} className="animate-in slide-in-from-bottom-1 duration-200 ease-out-expo">
              <Outlet />
            </div>
          </Suspense>
        </main>
      </div>
      <Toast />
    </div>
  );
}
