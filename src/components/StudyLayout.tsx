import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ChevronLeft,
  Clock,
  GraduationCap,
  Layers,
  LogOut,
  Menu,
  Monitor,
  Moon,
  PhoneCall,
  Send,
  Sun,
  UserCheck,
} from 'lucide-react';
import { useTheme, ThemeMode } from './ThemeContext';
import { logoutApi } from '../lib/api';
import { toast } from './Toast';

interface StudyLayoutProps {
  children: React.ReactNode;
  tgChannel?: string;
  sharedLogin?: boolean;
}

const NAV_ITEMS = [
  { key: 'study', label: 'Study', href: '/study', exact: true },
  { key: 'batches', label: 'Batches', href: '/study/batches', prefix: '/study/batches/' },
  { key: 'mybatches', label: 'My Batches', href: '/study/mybatches', exact: true },
  { key: 'history', label: 'History', href: '/history', exact: true },
  { key: 'telegram', label: 'Join Telegram', href: 'https://t.me/GBFreestudy', external: true },
  { key: 'contact', label: 'Contact Us', href: '/contact', exact: true },
];

function NavIcon({ name, active }: { name: string; active: boolean }) {
  const iconClass = `w-5 h-5 flex-shrink-0 ${active ? 'text-background' : 'text-[#5a4bda] dark:text-white'}`;
  switch (name) {
    case 'study':
      return <BookOpen className={iconClass} />;
    case 'batches':
      return <Layers className={iconClass} />;
    case 'mybatches':
      return <UserCheck className={iconClass} />;
    case 'history':
      return <Clock className={iconClass} />;
    case 'telegram':
      return <Send className={iconClass} />;
    default:
      return <PhoneCall className={iconClass} />;
  }
}

export function StudyLayout({ children, tgChannel, sharedLogin }: StudyLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const themeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setThemeMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setThemeMenuOpen(false);
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const handleLogout = async () => {
    await logoutApi();
    toast.success('Logged out successfully.');
    navigate('/auth', { replace: true });
  };

  const selectTheme = (next: ThemeMode) => {
    setTheme(next);
    setThemeMenuOpen(false);
  };

  const pathname = location.pathname;
  const showBackButton = pathname !== '/study' && pathname !== '/study/';

  return (
    <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-background">
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 xl:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`z-50 w-64 bg-background border-r shadow-md transform transition-transform duration-200 ease-in-out ${
          isMobileMenuOpen
            ? 'fixed top-0 left-0 translate-x-0 h-full'
            : 'fixed top-0 left-0 -translate-x-full h-full'
        } xl:fixed xl:top-0 xl:left-0 xl:translate-x-0 xl:h-screen xl:z-40`}
      >
        <div className="p-4 border-b sticky top-0 bg-background z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full dark:bg-foreground overflow-hidden shrink-0">
            <img
              src="/gb-study-icon.png"
              alt="GB STUDY logo"
              className="w-10 h-10 object-cover"
            />
          </div>
          <span className="font-semibold truncate">GB STUDY</span>
          <GraduationCap className="w-5 h-5 text-[#5a4bda] shrink-0" />
        </div>

        <nav className="p-2 space-y-2 overflow-y-auto h-[calc(100vh-5rem)]">
          {NAV_ITEMS.map((item) => {
            const href =
              item.key === 'telegram' ? tgChannel || 'https://t.me/GBFreestudy' : item.href;
            const active =
              !item.external &&
              (item.exact
                ? pathname === item.href || pathname === `${item.href}/`
                : pathname === item.href ||
                  (item.prefix ? pathname.startsWith(item.prefix) : false));

            const itemClasses = `flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer text-sm transition-colors duration-200 ${
              active
                ? 'bg-foreground/90 !text-background'
                : 'text-foreground hover:bg-foreground/20'
            }`;

            if (item.external) {
              return (
                <a
                  key={item.key}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={itemClasses}
                >
                  <NavIcon name={item.key} active={false} />
                  <span>{item.label}</span>
                </a>
              );
            }

            return (
              <Link
                key={item.key}
                to={href}
                data-active={active ? 'true' : undefined}
                className={itemClasses}
              >
                <NavIcon name={item.key} active={active} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 w-full max-w-full flex-1 flex-col xl:ml-64">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/50 p-2 backdrop-blur divshadow sm:p-4">
          <div className="flex items-center gap-2 rounded-lg bg-background/50 py-1.5 sm:px-2 md:ml-0">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground xl:hidden"
              aria-label="Toggle menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            {showBackButton && (
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
                <span>Back</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <div className="relative" ref={themeRef}>
              <button
                type="button"
                onClick={() => setThemeMenuOpen((prev) => !prev)}
                className="rounded-md p-2 hover:bg-muted transition-colors"
                aria-label="Theme settings"
                aria-expanded={themeMenuOpen}
              >
                {theme === 'LIGHT' ? (
                  <Sun className="h-5 w-5" />
                ) : theme === 'DARK' ? (
                  <Moon className="h-5 w-5" />
                ) : (
                  <Monitor className="h-5 w-5" />
                )}
              </button>

              {themeMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 z-50 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                  <button
                    type="button"
                    onClick={() => selectTheme('LIGHT')}
                    className={`flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground ${
                      theme === 'LIGHT' ? 'bg-accent font-medium' : ''
                    }`}
                  >
                    <Sun className="mr-2 h-4 w-4" />
                    <span>Light</span>
                  </button>
                  <div className="-mx-1 my-1 h-px bg-muted" />
                  <button
                    type="button"
                    onClick={() => selectTheme('DARK')}
                    className={`flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground ${
                      theme === 'DARK' ? 'bg-accent font-medium' : ''
                    }`}
                  >
                    <Moon className="mr-2 h-4 w-4" />
                    <span>Dark</span>
                  </button>
                  <div className="-mx-1 my-1 h-px bg-muted" />
                  <button
                    type="button"
                    onClick={() => selectTheme('SYSTEM')}
                    className={`flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground ${
                      theme === 'SYSTEM' ? 'bg-accent font-medium' : ''
                    }`}
                  >
                    <Monitor className="mr-2 h-4 w-4" />
                    <span>System</span>
                  </button>
                </div>
              )}
            </div>

            {!sharedLogin && (
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Logout"
                aria-label="Logout"
              >
                <LogOut className="h-5 w-5" />
              </button>
            )}
          </div>
        </header>

        <main className="min-w-0 w-full max-w-full flex-1 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
