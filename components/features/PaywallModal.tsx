"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface PaywallModalProps {
  postId: string;
  title: string;
  priceUsdc: number;
  previewContent: string;
  authorWalletSolana: string | null;
  authorWalletBase: string | null;
}

type PaymentChain = "solana" | "base";

export function PaywallModal({
  postId,
  title,
  priceUsdc,
  previewContent,
  authorWalletSolana,
  authorWalletBase,
}: PaywallModalProps) {
  const [selectedChain, setSelectedChain] = useState<PaymentChain | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const allChains: { id: PaymentChain; name: string; wallet: string | null; icon: string; color: string }[] = [
    {
      id: "solana",
      name: "Solana",
      wallet: authorWalletSolana,
      icon: "◎",
      color: "#9945FF",
    },
    {
      id: "base",
      name: "Base",
      wallet: authorWalletBase,
      icon: "Ⓑ",
      color: "#0052FF",
    },
  ];

  const availableChains = allChains.filter((chain) => chain.wallet !== null);

  const handlePayment = async () => {
    if (!selectedChain) return;

    setIsConnecting(true);

    // This will be implemented when wallet integration is added (Phase 5.2/5.3)
    // For now, show a placeholder message
    setTimeout(() => {
      setIsConnecting(false);
      alert(
        `Wallet integration coming soon!\n\nSelected: ${selectedChain}\nPost: ${postId}\nPrice: $${priceUsdc} USDC`
      );
    }, 1000);
  };

  return (
    <div className="relative">
      {/* Blurred Preview */}
      <div className="relative overflow-hidden rounded-xl">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <p className="text-lg text-muted-foreground">{previewContent}</p>
        </div>

        {/* Blur Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/95 to-background/50 flex items-end justify-center pb-8">
          <div className="w-full max-w-md">
            {/* Paywall Card */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
              <div className="text-center mb-6">
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
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-2">Premium Content</h3>
                <p className="text-muted-foreground text-sm">
                  Unlock "{title}" for just
                </p>
                <p className="text-3xl font-bold text-claw-secondary mt-2">
                  ${priceUsdc.toFixed(2)} <span className="text-lg font-normal">USDC</span>
                </p>
              </div>

              {/* Chain Selection */}
              {availableChains.length > 0 ? (
                <>
                  <div className="space-y-3 mb-6">
                    <p className="text-sm font-medium text-center">
                      Select payment method:
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {availableChains.map((chain) => (
                        <button
                          key={chain.id}
                          onClick={() => setSelectedChain(chain.id)}
                          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                            selectedChain === chain.id
                              ? "border-claw-primary bg-claw-primary/5"
                              : "border-border hover:border-muted-foreground/50"
                          }`}
                        >
                          <span
                            className="text-lg"
                            style={{ color: chain.color }}
                          >
                            {chain.icon}
                          </span>
                          <span className="font-medium">{chain.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    variant="claw"
                    size="lg"
                    className="w-full"
                    disabled={!selectedChain || isConnecting}
                    onClick={handlePayment}
                  >
                    {isConnecting ? (
                      <span className="flex items-center gap-2">
                        <svg
                          className="animate-spin h-4 w-4"
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
                        Connecting...
                      </span>
                    ) : selectedChain ? (
                      `Pay with ${selectedChain === "solana" ? "Solana" : "Base"}`
                    ) : (
                      "Select a chain to pay"
                    )}
                  </Button>
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">
                    Author has not configured payment wallets yet.
                  </p>
                </div>
              )}

              {/* Trust Indicators */}
              <div className="mt-6 pt-4 border-t border-border">
                <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
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
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                    Secure
                  </span>
                  <span className="flex items-center gap-1">
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
                      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                    Instant
                  </span>
                  <span className="flex items-center gap-1">
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
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                    24h Access
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
