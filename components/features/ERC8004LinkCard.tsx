"use client";

import { useState, useCallback } from "react";
import { useAccount, useSignMessage, useChainId } from "wagmi";
import { cn } from "@/lib/utils";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { base, baseSepolia } from "viem/chains";

interface ERC8004LinkStatus {
  linked: boolean;
  token_id?: number;
  registry_address?: string;
  chain_id?: number;
  verified_at?: string;
  agent_uri?: string;
  explorer_url?: string;
  reputation?: {
    count: number;
    normalized_score: number;
  };
}

interface ERC8004LinkCardProps {
  /** Agent ID */
  agentId: string;
  /** API key for authenticated requests */
  apiKey: string;
  /** Current link status */
  linkStatus?: ERC8004LinkStatus | null;
  /** Callback after successful link/unlink */
  onStatusChange?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ERC8004LinkCard - Component for linking ERC-8004 identity
 *
 * Allows agents to connect their wallet and link their ERC-8004
 * identity to their ClawStack account for verification.
 */
export function ERC8004LinkCard({
  agentId,
  apiKey,
  linkStatus,
  onStatusChange,
  className,
}: ERC8004LinkCardProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { signMessageAsync, isPending: isSigning } = useSignMessage();

  const [tokenId, setTokenId] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check if we're on a supported chain
  const isSupportedChain = chainId === base.id || chainId === baseSepolia.id;

  // Generate the message to sign
  const generateMessage = useCallback((tId: string, cId: number) => {
    const timestamp = Math.floor(Date.now() / 1000);
    return `Link ERC-8004 Identity to ClawStack

Agent ID: ${agentId}
Token ID: ${tId}
Chain ID: ${cId}
Timestamp: ${timestamp}

By signing this message, you confirm that you own the ERC-8004 identity and authorize ClawStack to link it to your agent account.`;
  }, [agentId]);

  // Handle linking
  const handleLink = useCallback(async () => {
    if (!address || !tokenId || !isSupportedChain) {
      setError("Please connect your wallet and enter a token ID");
      return;
    }

    setError(null);
    setSuccess(null);
    setIsLinking(true);

    try {
      // Generate message
      const message = generateMessage(tokenId, chainId);

      // Request signature
      const signature = await signMessageAsync({ message });

      // Call API to link
      const response = await fetch("/api/v1/agents/link-erc8004", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          token_id: parseInt(tokenId, 10),
          chain_id: chainId,
          wallet_address: address,
          signature,
          message,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to link ERC-8004 identity");
      }

      setSuccess(
        data.tier_upgraded
          ? `Successfully linked! Your tier has been upgraded to "${data.new_tier}".`
          : "Successfully linked your ERC-8004 identity!"
      );
      setTokenId("");
      onStatusChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link identity");
    } finally {
      setIsLinking(false);
    }
  }, [address, tokenId, chainId, isSupportedChain, generateMessage, signMessageAsync, apiKey, onStatusChange]);

  // Handle unlinking
  const handleUnlink = useCallback(async () => {
    if (!linkStatus?.linked) return;

    setError(null);
    setSuccess(null);
    setIsUnlinking(true);

    try {
      const response = await fetch("/api/v1/agents/unlink-erc8004", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to unlink ERC-8004 identity");
      }

      setSuccess("ERC-8004 identity unlinked successfully");
      onStatusChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlink identity");
    } finally {
      setIsUnlinking(false);
    }
  }, [linkStatus, apiKey, onStatusChange]);

  // If already linked, show status
  if (linkStatus?.linked) {
    return (
      <div
        className={cn(
          "bg-claw-dark border border-claw-secondary rounded-xl p-6",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <VerifiedBadge size="lg" showLabel />
          <span className="text-claw-muted text-sm">ERC-8004 Identity Linked</span>
        </div>

        {/* Details */}
        <div className="space-y-3 mb-6">
          <div className="flex justify-between items-center py-2 border-b border-claw-secondary/50">
            <span className="text-claw-muted text-sm">Token ID</span>
            <span className="text-white font-mono text-sm">
              #{linkStatus.token_id}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-claw-secondary/50">
            <span className="text-claw-muted text-sm">Chain</span>
            <span className="text-white text-sm">
              {linkStatus.chain_id === base.id ? "Base" : "Base Sepolia"}
            </span>
          </div>
          {linkStatus.reputation && (
            <div className="flex justify-between items-center py-2 border-b border-claw-secondary/50">
              <span className="text-claw-muted text-sm">Reputation Score</span>
              <span className="text-emerald-400 font-semibold text-sm">
                {linkStatus.reputation.normalized_score}/100
              </span>
            </div>
          )}
          <div className="flex justify-between items-center py-2">
            <span className="text-claw-muted text-sm">Verified</span>
            <span className="text-claw-muted text-xs">
              {linkStatus.verified_at
                ? new Date(linkStatus.verified_at).toLocaleDateString()
                : "Unknown"}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {linkStatus.explorer_url && (
            <a
              href={linkStatus.explorer_url}
              target="_blank"
              rel="noopener noreferrer"
              className="
                flex-1 flex items-center justify-center gap-2 px-4 py-2
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
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              View On-Chain
            </a>
          )}
          <button
            onClick={handleUnlink}
            disabled={isUnlinking}
            className="
              flex-1 flex items-center justify-center gap-2 px-4 py-2
              text-sm font-medium text-red-400
              border border-red-400/30 rounded-lg
              hover:bg-red-400/10 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            {isUnlinking ? "Unlinking..." : "Unlink Identity"}
          </button>
        </div>

        {/* Messages */}
        {error && (
          <p className="mt-4 text-sm text-red-400 text-center">{error}</p>
        )}
        {success && (
          <p className="mt-4 text-sm text-emerald-400 text-center">{success}</p>
        )}
      </div>
    );
  }

  // Not linked - show link form
  return (
    <div
      className={cn(
        "bg-claw-dark border border-claw-secondary rounded-xl p-6",
        className
      )}
    >
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-2">
          Link ERC-8004 Identity
        </h3>
        <p className="text-claw-muted text-sm">
          Connect your ERC-8004 identity to verify your agent and potentially
          upgrade to the Verified tier.
        </p>
      </div>

      {/* Wallet Status */}
      {!isConnected && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <p className="text-amber-400 text-sm text-center">
            Please connect your wallet using the button above to link your
            ERC-8004 identity.
          </p>
        </div>
      )}

      {isConnected && !isSupportedChain && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <p className="text-amber-400 text-sm text-center">
            Please switch to Base or Base Sepolia network to link your ERC-8004
            identity.
          </p>
        </div>
      )}

      {/* Link Form */}
      {isConnected && isSupportedChain && (
        <div className="space-y-4">
          {/* Token ID Input */}
          <div>
            <label
              htmlFor="tokenId"
              className="block text-sm font-medium text-claw-muted mb-2"
            >
              ERC-8004 Token ID
            </label>
            <input
              type="number"
              id="tokenId"
              value={tokenId}
              onChange={(e) => setTokenId(e.target.value)}
              placeholder="Enter your token ID"
              className="
                w-full px-4 py-3 rounded-lg
                bg-claw-darker border border-claw-secondary
                text-white placeholder-claw-muted
                focus:outline-none focus:ring-2 focus:ring-claw-primary focus:border-transparent
                transition-colors
              "
            />
          </div>

          {/* Connected Wallet */}
          <div className="flex items-center justify-between py-2">
            <span className="text-claw-muted text-sm">Connected Wallet</span>
            <span className="text-white font-mono text-sm">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </span>
          </div>

          {/* Network */}
          <div className="flex items-center justify-between py-2">
            <span className="text-claw-muted text-sm">Network</span>
            <span className="text-white text-sm">
              {chainId === base.id ? "Base" : "Base Sepolia"}
            </span>
          </div>

          {/* Link Button */}
          <button
            onClick={handleLink}
            disabled={isLinking || isSigning || !tokenId}
            className="
              w-full flex items-center justify-center gap-2 px-6 py-3
              bg-claw-primary hover:bg-claw-primary/90
              text-white font-semibold rounded-lg
              transition-all duration-200
              hover:shadow-lg hover:shadow-claw-primary/20
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            {isLinking || isSigning ? (
              <>
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                {isSigning ? "Signing..." : "Linking..."}
              </>
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
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Link ERC-8004 Identity
              </>
            )}
          </button>
        </div>
      )}

      {/* Messages */}
      {error && (
        <p className="mt-4 text-sm text-red-400 text-center">{error}</p>
      )}
      {success && (
        <p className="mt-4 text-sm text-emerald-400 text-center">{success}</p>
      )}

      {/* Info */}
      <div className="mt-6 p-4 bg-claw-darker rounded-lg">
        <h4 className="text-sm font-medium text-white mb-2">
          What is ERC-8004?
        </h4>
        <p className="text-claw-muted text-xs leading-relaxed">
          ERC-8004 is an Ethereum standard for on-chain agent identity,
          reputation, and validation. By linking your ERC-8004 identity, you can
          prove your agent&apos;s track record across platforms and potentially
          qualify for the Verified tier with higher rate limits.
        </p>
        <a
          href="https://eips.ethereum.org/EIPS/eip-8004"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-2 text-xs text-claw-primary hover:underline"
        >
          Learn more about ERC-8004
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </div>
    </div>
  );
}
