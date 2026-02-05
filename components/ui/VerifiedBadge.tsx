"use client";

import { cn } from "@/lib/utils";

interface VerifiedBadgeProps {
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Show text label */
  showLabel?: boolean;
  /** Optional click handler (e.g., to show details) */
  onClick?: () => void;
  /** Optional link to block explorer */
  explorerUrl?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * VerifiedBadge - Visual indicator for ERC-8004 verified agents
 *
 * Displays a checkmark badge indicating the agent has a verified
 * on-chain ERC-8004 identity linked to their account.
 */
export function VerifiedBadge({
  size = "md",
  showLabel = false,
  onClick,
  explorerUrl,
  className,
}: VerifiedBadgeProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  const labelSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const iconSize = {
    sm: 10,
    md: 12,
    lg: 14,
  };

  const content = (
    <>
      {/* Verified icon - shield with checkmark */}
      <div
        className={cn(
          "inline-flex items-center justify-center rounded-full",
          "bg-emerald-500/20 text-emerald-400",
          sizeClasses[size]
        )}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={iconSize[size]}
          height={iconSize[size]}
          viewBox="0 0 24 24"
          fill="currentColor"
          className="drop-shadow-sm"
        >
          <path
            fillRule="evenodd"
            d="M12.516 2.17a.75.75 0 0 0-1.032 0 11.209 11.209 0 0 1-7.877 3.08.75.75 0 0 0-.722.515A12.74 12.74 0 0 0 2.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 0 0 .374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 0 0-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08Zm3.094 8.016a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      {showLabel && (
        <span
          className={cn(
            "font-medium text-emerald-400",
            labelSizeClasses[size]
          )}
        >
          Verified
        </span>
      )}
    </>
  );

  // Wrapper classes
  const wrapperClasses = cn(
    "inline-flex items-center gap-1.5",
    (onClick || explorerUrl) && "cursor-pointer hover:opacity-80 transition-opacity",
    className
  );

  // If explorerUrl is provided, render as a link
  if (explorerUrl) {
    return (
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={wrapperClasses}
        title="View on-chain identity"
      >
        {content}
      </a>
    );
  }

  // If onClick is provided, render as a button
  if (onClick) {
    return (
      <button onClick={onClick} className={wrapperClasses} title="Verified Agent">
        {content}
      </button>
    );
  }

  // Otherwise, render as a span
  return (
    <span className={wrapperClasses} title="Verified Agent">
      {content}
    </span>
  );
}

/**
 * VerifiedBadgeInline - Inline version for use in text
 *
 * Usage: <span>Agent Name <VerifiedBadgeInline /></span>
 */
export function VerifiedBadgeInline({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-4 h-4 rounded-full",
        "bg-emerald-500/20 text-emerald-400 ml-1",
        className
      )}
      title="Verified Agent"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={10}
        height={10}
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M12.516 2.17a.75.75 0 0 0-1.032 0 11.209 11.209 0 0 1-7.877 3.08.75.75 0 0 0-.722.515A12.74 12.74 0 0 0 2.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 0 0 .374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 0 0-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08Zm3.094 8.016a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}
