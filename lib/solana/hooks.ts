"use client";

import { useState, useEffect, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  getUsdcBalance,
  createUsdcPaymentTransaction,
  waitForConfirmation,
  type PaymentConfirmationResult,
} from "./usdc";

/**
 * Hook to fetch and track USDC balance
 */
export function useUsdcBalance() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!publicKey || !connected) {
      setBalance(0);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const usdcBalance = await getUsdcBalance(connection, publicKey);
      setBalance(usdcBalance);
    } catch (err) {
      console.error("Error fetching USDC balance:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch balance");
      setBalance(0);
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey, connected]);

  // Fetch balance on mount and when wallet changes
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Refetch balance periodically when connected
  useEffect(() => {
    if (!connected) return;

    const interval = setInterval(fetchBalance, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [connected, fetchBalance]);

  return {
    balance,
    loading,
    error,
    refetch: fetchBalance,
  };
}

export type PaymentStatus =
  | "idle"
  | "creating"
  | "signing"
  | "confirming"
  | "success"
  | "error";

export interface PaymentState {
  status: PaymentStatus;
  signature: string | null;
  error: string | null;
  confirmationResult: PaymentConfirmationResult | null;
}

export interface UsePaymentResult {
  state: PaymentState;
  initiatePayment: (
    recipientAddress: string,
    amountUsdc: number,
    memo: string
  ) => Promise<PaymentConfirmationResult | null>;
  reset: () => void;
}

/**
 * Hook to manage Solana USDC payments
 * Handles transaction creation, signing, sending, and confirmation
 */
export function useSolanaPayment(): UsePaymentResult {
  const { connection } = useConnection();
  const { publicKey, signTransaction, connected } = useWallet();

  const [state, setState] = useState<PaymentState>({
    status: "idle",
    signature: null,
    error: null,
    confirmationResult: null,
  });

  const reset = useCallback(() => {
    setState({
      status: "idle",
      signature: null,
      error: null,
      confirmationResult: null,
    });
  }, []);

  const initiatePayment = useCallback(
    async (
      recipientAddress: string,
      amountUsdc: number,
      memo: string
    ): Promise<PaymentConfirmationResult | null> => {
      if (!publicKey || !signTransaction || !connected) {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: "Wallet not connected",
        }));
        return null;
      }

      try {
        // Step 1: Create transaction
        setState((prev) => ({
          ...prev,
          status: "creating",
          error: null,
        }));

        const { transaction } = await createUsdcPaymentTransaction({
          connection,
          payerPublicKey: publicKey,
          recipientAddress,
          amountUsdc,
          memo,
        });

        // Step 2: Request signature from wallet
        setState((prev) => ({
          ...prev,
          status: "signing",
        }));

        const signedTransaction = await signTransaction(transaction);

        // Step 3: Send transaction
        setState((prev) => ({
          ...prev,
          status: "confirming",
        }));

        const signature = await connection.sendRawTransaction(
          signedTransaction.serialize(),
          {
            skipPreflight: false,
            preflightCommitment: "confirmed",
          }
        );

        setState((prev) => ({
          ...prev,
          signature,
        }));

        // Step 4: Wait for confirmation
        const confirmationResult = await waitForConfirmation(
          connection,
          signature
        );

        if (confirmationResult.confirmed) {
          setState((prev) => ({
            ...prev,
            status: "success",
            confirmationResult,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            status: "error",
            error: confirmationResult.error || "Transaction failed",
            confirmationResult,
          }));
        }

        return confirmationResult;
      } catch (err) {
        console.error("Payment error:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Payment failed";

        setState((prev) => ({
          ...prev,
          status: "error",
          error: errorMessage,
        }));

        return null;
      }
    },
    [connection, publicKey, signTransaction, connected]
  );

  return {
    state,
    initiatePayment,
    reset,
  };
}

/**
 * Hook to check if wallet has sufficient USDC balance for a payment
 */
export function useCanAfford(amountUsdc: number): {
  canAfford: boolean;
  balance: number;
  loading: boolean;
} {
  const { balance, loading } = useUsdcBalance();

  return {
    canAfford: balance >= amountUsdc,
    balance,
    loading,
  };
}
