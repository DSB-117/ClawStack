"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Button } from "@/components/ui/button";
import {
  useUsdcBalance,
  useSolanaPayment,
  createPaymentProof,
  submitPaymentProof,
  storePaymentProof,
} from "@/lib/solana";

interface SolanaPaymentFlowProps {
  postId: string;
  priceUsdc: number;
  recipientAddress: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

type FlowStep =
  | "connect"
  | "check-balance"
  | "ready"
  | "paying"
  | "confirming"
  | "submitting"
  | "success"
  | "error";

/**
 * Complete Solana payment flow component
 * Handles wallet connection, balance checking, payment, and proof submission
 */
export function SolanaPaymentFlow({
  postId,
  priceUsdc,
  recipientAddress,
  onSuccess,
  onError,
}: SolanaPaymentFlowProps) {
  const { publicKey, connected, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const { balance, loading: balanceLoading, refetch } = useUsdcBalance();
  const { state: paymentState, initiatePayment, reset } = useSolanaPayment();

  const [step, setStep] = useState<FlowStep>("connect");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Determine current step based on state
  useEffect(() => {
    if (!connected) {
      setStep("connect");
      return;
    }

    if (balanceLoading) {
      setStep("check-balance");
      return;
    }

    if (paymentState.status === "idle") {
      setStep("ready");
      return;
    }

    if (
      paymentState.status === "creating" ||
      paymentState.status === "signing"
    ) {
      setStep("paying");
      return;
    }

    if (paymentState.status === "confirming") {
      setStep("confirming");
      return;
    }

    if (paymentState.status === "success") {
      setStep("submitting");
      return;
    }

    if (paymentState.status === "error") {
      setStep("error");
      setErrorMessage(paymentState.error);
      return;
    }
  }, [connected, balanceLoading, paymentState]);

  // Handle payment proof submission after transaction success
  useEffect(() => {
    async function submitProof() {
      if (
        step !== "submitting" ||
        !paymentState.signature ||
        !publicKey
      ) {
        return;
      }

      const proof = createPaymentProof(
        paymentState.signature,
        publicKey.toBase58(),
        paymentState.confirmationResult?.blockTime
      );

      // Store locally for session persistence
      storePaymentProof(postId, proof);

      // Submit to API
      const result = await submitPaymentProof(postId, proof);

      if (result.success && result.accessGranted) {
        setStep("success");
        onSuccess();
      } else {
        setStep("error");
        setErrorMessage(result.error || "Failed to verify payment");
        onError(result.error || "Failed to verify payment");
      }
    }

    submitProof();
  }, [step, paymentState.signature, paymentState.confirmationResult, publicKey, postId, onSuccess, onError]);

  const handleConnect = useCallback(() => {
    setVisible(true);
  }, [setVisible]);

  const handlePay = useCallback(async () => {
    if (balance < priceUsdc) {
      setErrorMessage(`Insufficient balance. You need ${priceUsdc} USDC.`);
      setStep("error");
      return;
    }

    const memo = `clawstack:${postId}:${Math.floor(Date.now() / 1000)}`;

    const result = await initiatePayment(recipientAddress, priceUsdc, memo);

    if (!result || !result.confirmed) {
      // Error state is handled by the payment hook
      onError(paymentState.error || "Payment failed");
    }
  }, [balance, priceUsdc, postId, recipientAddress, initiatePayment, paymentState.error, onError]);

  const handleRetry = useCallback(() => {
    reset();
    setErrorMessage(null);
    refetch();
  }, [reset, refetch]);

  const canAfford = balance >= priceUsdc;

  return (
    <div className="space-y-4">
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {["connect", "pay", "verify"].map((s, i) => {
          const isActive =
            (s === "connect" && step === "connect") ||
            (s === "pay" && ["check-balance", "ready", "paying", "confirming"].includes(step)) ||
            (s === "verify" && ["submitting", "success"].includes(step));
          const isComplete =
            (s === "connect" && connected) ||
            (s === "pay" && ["submitting", "success"].includes(step)) ||
            (s === "verify" && step === "success");

          return (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className={`w-8 h-0.5 ${
                    isComplete ? "bg-claw-secondary" : "bg-muted"
                  }`}
                />
              )}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  isComplete
                    ? "bg-claw-secondary text-white"
                    : isActive
                    ? "bg-claw-primary text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isComplete ? "✓" : i + 1}
              </div>
            </div>
          );
        })}
      </div>

      {/* Connect Step */}
      {step === "connect" && (
        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Connect your Solana wallet to continue
          </p>
          <Button
            onClick={handleConnect}
            variant="outline"
            className="w-full border-[#9945FF]/30 hover:border-[#9945FF] hover:bg-[#9945FF]/5"
            disabled={connecting}
          >
            {connecting ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner />
                Connecting...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="text-[#9945FF]">◎</span>
                Connect Wallet
              </span>
            )}
          </Button>
        </div>
      )}

      {/* Check Balance Step */}
      {step === "check-balance" && (
        <div className="text-center space-y-4">
          <LoadingSpinner />
          <p className="text-sm text-muted-foreground">
            Checking your USDC balance...
          </p>
        </div>
      )}

      {/* Ready Step */}
      {step === "ready" && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">Your Balance</span>
              <span className="font-medium">${balance.toFixed(2)} USDC</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Price</span>
              <span className="font-medium text-claw-secondary">
                ${priceUsdc.toFixed(2)} USDC
              </span>
            </div>
          </div>

          {!canAfford && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              Insufficient balance. You need ${(priceUsdc - balance).toFixed(2)}{" "}
              more USDC.
            </div>
          )}

          <Button
            onClick={handlePay}
            variant="claw"
            className="w-full"
            disabled={!canAfford}
          >
            Pay ${priceUsdc.toFixed(2)} USDC
          </Button>
        </div>
      )}

      {/* Paying Step */}
      {step === "paying" && (
        <div className="text-center space-y-4">
          <LoadingSpinner />
          <p className="text-sm text-muted-foreground">
            {paymentState.status === "creating"
              ? "Creating transaction..."
              : "Please approve in your wallet..."}
          </p>
        </div>
      )}

      {/* Confirming Step */}
      {step === "confirming" && (
        <div className="text-center space-y-4">
          <LoadingSpinner />
          <p className="text-sm text-muted-foreground">
            Confirming transaction on Solana...
          </p>
          {paymentState.signature && (
            <a
              href={`https://solscan.io/tx/${paymentState.signature}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-claw-primary hover:underline"
            >
              View on Solscan →
            </a>
          )}
        </div>
      )}

      {/* Submitting Step */}
      {step === "submitting" && (
        <div className="text-center space-y-4">
          <LoadingSpinner />
          <p className="text-sm text-muted-foreground">
            Verifying payment and unlocking content...
          </p>
        </div>
      )}

      {/* Success Step */}
      {step === "success" && (
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-claw-secondary/10 text-claw-secondary">
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
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <p className="font-medium">Payment successful!</p>
          <p className="text-sm text-muted-foreground">
            Content is now unlocked.
          </p>
        </div>
      )}

      {/* Error Step */}
      {step === "error" && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm text-center">
            {errorMessage || "An error occurred"}
          </div>
          <Button onClick={handleRetry} variant="outline" className="w-full">
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-8 w-8 mx-auto text-claw-primary"
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
  );
}
