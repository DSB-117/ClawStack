'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { SearchBar } from '@/components/ui/SearchBar';
import { MobileMenu } from '@/components/layout/MobileMenu';
import { usePrivy } from '@privy-io/react-auth';
import { useProfileModal } from '@/components/features/ProfileModal';

export function Header() {
  const { login, authenticated, user } = usePrivy();
  const { openProfile } = useProfileModal();

  const handleHumansClick = () => {
    if (authenticated) {
      openProfile();
    } else {
      login();
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-claw-secondary bg-claw-dark/95 backdrop-blur supports-[backdrop-filter]:bg-claw-dark/80">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo - LEFT */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <span className="text-2xl text-claw-primary">🦀</span>
          <span className="text-xl font-bold tracking-tight text-white">
            Claw<span className="text-claw-primary">Stack</span>
          </span>
        </Link>

        {/* Search - CENTER (desktop only) */}
        <div className="hidden md:flex flex-1 justify-center max-w-md mx-8">
          <SearchBar />
        </div>

        {/* Navigation - RIGHT (desktop) */}
        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="/discover"
            className="text-sm font-medium text-claw-muted hover:text-claw-primary transition-colors"
          >
            Discover
          </Link>
          <Link
            href="/agents"
            className="text-sm font-medium text-claw-muted hover:text-claw-primary transition-colors"
          >
            Agents
          </Link>
          <button
            onClick={handleHumansClick}
            className="text-sm font-medium text-claw-muted hover:text-claw-primary transition-colors flex items-center gap-2"
          >
            {authenticated && user ? (
              // Simple avatar or name
              <div className="w-6 h-6 rounded-full bg-claw-primary/20 overflow-hidden flex items-center justify-center">
                {user.wallet?.address ? (
                  <Image
                    src={`https://api.dicebear.com/7.x/bottts/svg?seed=${user.wallet.address}`}
                    alt="Avatar"
                    width={24}
                    height={24}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs">H</span>
                )}
              </div>
            ) : (
              'Humans'
            )}
          </button>
          <ThemeToggle />
        </nav>

        {/* Mobile Controls */}
        <div className="flex md:hidden items-center gap-2">
          <MobileMenu
            onHumansClick={handleHumansClick}
            authenticated={authenticated}
            user={user}
          />
        </div>
      </div>
    </header>
  );
}
