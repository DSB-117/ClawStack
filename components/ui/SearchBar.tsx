"use client";

import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface SearchBarProps {
  placeholder?: string;
  className?: string;
}

// Inner component that uses useSearchParams
function SearchBarInner({ placeholder = "Search posts...", className = "" }: SearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [isFocused, setIsFocused] = useState(false);

  // Debounced URL update
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());

      if (query.trim()) {
        params.set("q", query.trim());
      } else {
        params.delete("q");
      }

      // Preserve existing params like tag and page
      const queryString = params.toString();
      const newUrl = queryString ? `/feed?${queryString}` : "/feed";

      // Only update if we have a query or we're clearing one
      if (query.trim() || searchParams.has("q")) {
        router.push(newUrl);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, router, searchParams]);

  // Global keyboard shortcut (⌘K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      // Escape to blur
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  }, []);

  const handleClear = useCallback(() => {
    setQuery("");
    inputRef.current?.focus();
  }, []);

  return (
    <div className={`relative w-full max-w-md ${className}`}>
      <div
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg
          bg-claw-elevated border transition-all duration-200
          ${isFocused
            ? "border-claw-primary ring-1 ring-claw-primary/20"
            : "border-claw-secondary hover:border-claw-secondary/80"
          }
        `}
      >
        {/* Search Icon */}
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

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="
            flex-1 bg-transparent text-sm text-white
            placeholder:text-claw-muted
            focus:outline-none
          "
        />

        {/* Clear button or Keyboard shortcut hint */}
        {query ? (
          <button
            onClick={handleClear}
            className="text-claw-muted hover:text-white transition-colors"
            aria-label="Clear search"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
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
        ) : (
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs text-claw-muted bg-claw-dark rounded border border-claw-secondary">
            <span className="text-[10px]">⌘</span>K
          </kbd>
        )}
      </div>
    </div>
  );
}

// Loading placeholder for SearchBar
function SearchBarFallback({ className = "" }: { className?: string }) {
  return (
    <div className={`relative w-full max-w-md ${className}`}>
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
        <span className="flex-1 text-sm text-claw-muted">Search posts...</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs text-claw-muted bg-claw-dark rounded border border-claw-secondary">
          <span className="text-[10px]">⌘</span>K
        </kbd>
      </div>
    </div>
  );
}

// Exported component wrapped in Suspense
export function SearchBar(props: SearchBarProps) {
  return (
    <Suspense fallback={<SearchBarFallback className={props.className} />}>
      <SearchBarInner {...props} />
    </Suspense>
  );
}
