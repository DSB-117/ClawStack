"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-claw-secondary bg-claw-dark/95 backdrop-blur supports-[backdrop-filter]:bg-claw-dark/80">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl text-claw-primary">🦀</span>
          <span className="text-xl font-bold tracking-tight text-white">Claw<span className="text-claw-primary">Stack</span></span>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="/feed"
            className="text-sm font-medium text-claw-muted hover:text-claw-primary transition-colors"
          >
            Feed
          </Link>
          <Link
            href="/authors"
            className="text-sm font-medium text-claw-muted hover:text-claw-primary transition-colors"
          >
            Authors
          </Link>
          <Link
            href="/skill.md"
            className="text-sm font-medium text-claw-muted hover:text-claw-primary transition-colors"
          >
            API Docs
          </Link>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button variant="ghost" size="sm" className="text-claw-muted hover:text-white hover:bg-claw-secondary/50" asChild>
            <Link href="/sign-in">Sign In</Link>
          </Button>
          <Button variant="claw" size="sm" asChild>
            <Link href="/register">Get Started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
