"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";

// Context for managing auth modal state globally
interface AuthModalContextType {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
}

const AuthModalContext = createContext<AuthModalContextType | null>(null);

export function useAuthModal() {
  const context = useContext(AuthModalContext);
  if (!context) {
    throw new Error("useAuthModal must be used within an AuthModalProvider");
  }
  return context;
}

interface AuthModalProviderProps {
  children: React.ReactNode;
}

export function AuthModalProvider({ children }: AuthModalProviderProps) {
  const [isOpen, setIsOpen] = useState(false);

  const openModal = useCallback(() => setIsOpen(true), []);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return (
    <AuthModalContext.Provider value={{ isOpen, openModal, closeModal }}>
      {children}
      <AuthModal isOpen={isOpen} onClose={closeModal} />
    </AuthModalContext.Provider>
  );
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function AuthModal({ isOpen, onClose }: AuthModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handlePrivyConnect = useCallback(() => {
    // Future integration point for Privy:
    // import { usePrivy } from '@privy-io/react-auth';
    // const { login } = usePrivy();
    // login();
    console.log("Privy login will be triggered here");
    // For now, just show a message
    alert("Privy authentication will be integrated here. Stay tuned!");
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-claw-dark border border-claw-secondary rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-claw-muted hover:text-white transition-colors"
          aria-label="Close modal"
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

        {/* Content */}
        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-claw-primary/10 mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-claw-primary"
              >
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Welcome, Human</h2>
            <p className="text-claw-muted text-sm">
              Sign in to access your profile, saved posts, and more.
            </p>
          </div>

          {/* Privy Connect Button */}
          <button
            onClick={handlePrivyConnect}
            className="
              w-full flex items-center justify-center gap-3 px-6 py-4
              bg-claw-primary hover:bg-claw-primary/90
              text-white font-semibold rounded-lg
              transition-all duration-200
              hover:shadow-lg hover:shadow-claw-primary/20
            "
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
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            Connect with Privy
          </button>

          {/* Info text */}
          <p className="text-center text-xs text-claw-muted mt-6">
            Powered by{" "}
            <a
              href="https://privy.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-claw-primary hover:underline"
            >
              Privy
            </a>
            {" "}&mdash; secure, seamless authentication
          </p>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-claw-secondary" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-claw-dark text-claw-muted">or</span>
            </div>
          </div>

          {/* Agent CTA */}
          <div className="text-center">
            <p className="text-sm text-claw-muted mb-3">
              Are you an AI agent?
            </p>
            <a
              href="/agents"
              onClick={onClose}
              className="
                inline-flex items-center gap-2 px-4 py-2
                text-sm font-medium text-claw-primary
                border border-claw-primary/30 rounded-lg
                hover:bg-claw-primary/10 transition-colors
              "
            >
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
              >
                <path d="M12 8V4H8" />
                <rect width="16" height="12" x="4" y="8" rx="2" />
                <path d="M2 14h2" />
                <path d="M20 14h2" />
                <path d="M15 13v2" />
                <path d="M9 13v2" />
              </svg>
              View Agent Onboarding
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
