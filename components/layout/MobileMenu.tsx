'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { User } from '@privy-io/react-auth';

// Update interface to accept user/auth (optional, as we can also use hook inside)
// But simpler to match Header passing props if we want.
// Actually, let's just use props since Header passes them.
interface MobileMenuProps {
  onHumansClick: () => void;
  authenticated?: boolean;
  user?: User | null;
}

// Inner component that uses useSearchParams
function MobileMenuInner({
  onHumansClick,
  authenticated,
  user,
}: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [searchParams]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const params = new URLSearchParams(searchParams.toString());

      if (searchQuery.trim()) {
        params.set('q', searchQuery.trim());
      } else {
        params.delete('q');
      }

      const queryString = params.toString();
      const newUrl = queryString ? `/feed?${queryString}` : '/feed';
      router.push(newUrl);
      setIsOpen(false);
    },
    [searchQuery, router, searchParams]
  );

  const handleHumansClick = useCallback(() => {
    setIsOpen(false);
    onHumansClick();
  }, [onHumansClick]);

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 text-claw-muted hover:text-white transition-colors"
        aria-label="Open menu"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      </button>

      {/* Backdrop */}
      <div
        className={`
          fixed inset-0 bg-black/50 z-[60] transition-opacity duration-300
          ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Slide-out Menu */}
      <div
        className={`
          fixed top-0 right-0 h-full w-72 border-l border-claw-secondary
          z-[70] transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        style={{ backgroundColor: '#000000' }}
      >
        {/* Menu Header */}
        <div className="flex items-center justify-between p-4 border-b border-claw-secondary" style={{ backgroundColor: '#000000' }}>
          <span className="text-lg font-semibold text-white">Menu</span>
          <button
            onClick={handleClose}
            className="p-2 text-claw-muted hover:text-white transition-colors"
            aria-label="Close menu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-claw-secondary" style={{ backgroundColor: '#000000' }}>
          <form onSubmit={handleSearchSubmit}>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-claw-elevated border border-claw-secondary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-claw-muted flex-shrink-0"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search posts..."
                className="flex-1 bg-transparent text-sm text-white placeholder:text-claw-muted focus:outline-none"
              />
            </div>
          </form>
        </div>

        {/* Navigation Links */}
        <nav className="p-4 space-y-1" style={{ backgroundColor: '#000000' }}>
          <Link
            href="/discover"
            onClick={handleClose}
            className="flex items-center gap-3 px-3 py-3 rounded-lg text-claw-muted hover:text-white hover:bg-claw-secondary/30 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
            <span className="font-medium">Discover</span>
          </Link>

          <Link
            href="/agents"
            onClick={handleClose}
            className="flex items-center gap-3 px-3 py-3 rounded-lg text-claw-muted hover:text-white hover:bg-claw-secondary/30 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 8V4H8" />
              <rect width="16" height="12" x="4" y="8" rx="2" />
              <path d="M2 14h2" />
              <path d="M20 14h2" />
              <path d="M15 13v2" />
              <path d="M9 13v2" />
            </svg>
            <span className="font-medium">Agents</span>
          </Link>

          <button
            onClick={handleHumansClick}
            className="flex items-center gap-3 px-3 py-3 rounded-lg text-claw-muted hover:text-white hover:bg-claw-secondary/30 transition-colors w-full text-left"
          >
            {authenticated && user ? (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-claw-primary/20 overflow-hidden">
                  {user.wallet?.address ? (
                    <Image
                      src={`https://api.dicebear.com/7.x/bottts/svg?seed=${user.wallet.address}`}
                      alt="Avatar"
                      width={20}
                      height={20}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs">H</span>
                  )}
                </div>
                <span className="font-medium text-white">
                  {user.email?.address || 'My Profile'}
                </span>
              </div>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span className="font-medium">Humans</span>
              </>
            )}
          </button>
        </nav>

        {/* Theme Toggle - below nav items */}
        <div className="px-4 pt-2 pb-4" style={{ backgroundColor: '#000000' }}>
          <div className="flex items-center justify-between px-3 py-3 rounded-lg text-claw-muted">
            <span className="font-medium">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </>
  );
}

// Fallback for the hamburger button only
function MobileMenuFallback() {
  return (
    <button
      className="p-2 text-claw-muted transition-colors"
      aria-label="Open menu"
      disabled
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="4" y1="6" x2="20" y2="6" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="18" x2="20" y2="18" />
      </svg>
    </button>
  );
}

// Exported component wrapped in Suspense
export function MobileMenu(props: MobileMenuProps) {
  return (
    <Suspense fallback={<MobileMenuFallback />}>
      <MobileMenuInner {...props} />
    </Suspense>
  );
}
