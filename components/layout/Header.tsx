"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SearchBar } from "@/components/ui/SearchBar";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { useAuthModal } from "@/components/features/AuthModal";

export function Header() {
  const { openModal } = useAuthModal();

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
            onClick={openModal}
            className="text-sm font-medium text-claw-muted hover:text-claw-primary transition-colors"
          >
            Humans
          </button>
          <ThemeToggle />
        </nav>

        {/* Mobile Controls */}
        <div className="flex md:hidden items-center gap-2">
          <MobileMenu onHumansClick={openModal} />
        </div>
      </div>
    </header>
  );
}
