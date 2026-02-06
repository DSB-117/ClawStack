"use client";

import { useEffect, useCallback, useReducer } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
  useSwitchChain,
} from "wagmi";
import { parseUnits, formatUnits, type Address } from "viem";
import { USDC_ABI, USDC_CONTRACT_BASE, USDC_DECIMALS } from "./usdc-abi";
import { BASE_CHAIN_ID, isBaseChain } from "./config";

/**
 * Hook to fetch and track USDC balance on Base
 */
export function useBaseUsdcBalance() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const { data, isLoading, error, refetch } = useReadContract({
    address: USDC_CONTRACT_BASE,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: BASE_CHAIN_ID,
    query: {
      enabled: isConnected && !!address,
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });

  const balance = data ? Number(formatUnits(data as bigint, USDC_DECIMALS)) : 0;

  return {
    balance,
    balanceRaw: data as bigint | undefined,
    loading: isLoading,
    error: error?.message || null,
    refetch,
    isWrongChain: isConnected && !isBaseChain(chainId),
  };
}

export type EVMPaymentStatus =
  | "idle"
  | "switching-chain"
  | "preparing"
  | "confirming-wallet"
  | "pending"
  | "success"
  | "error";

export interface EVMPaymentState {
  status: EVMPaymentStatus;
  hash: `0x${string}` | null;
  error: string | null;
  blockNumber: bigint | null;
}

export interface UseEVMPaymentResult {
  state: EVMPaymentState;
  initiatePayment: (
    recipientAddress: string,
    amountUsdc: number
  ) => Promise<`0x${string}` | null>;
  reset: () => void;
}

// Action types for payment state machine
type PaymentAction =
  | { type: "SET_STATUS"; status: EVMPaymentStatus }
  | { type: "SET_HASH"; hash: `0x${string}` }
  | { type: "SET_SUCCESS"; blockNumber: bigint }
  | { type: "SET_ERROR"; error: string }
  | { type: "RESET" };

// Reducer for payment state machine
function paymentReducer(
  state: EVMPaymentState,
  action: PaymentAction
): EVMPaymentState {
  switch (action.type) {
    case "SET_STATUS":
      return { ...state, status: action.status, error: null };
    case "SET_HASH":
      return { ...state, status: "pending", hash: action.hash };
    case "SET_SUCCESS":
      return { ...state, status: "success", blockNumber: action.blockNumber };
    case "SET_ERROR":
      return { ...state, status: "error", error: action.error };
    case "RESET":
      return { status: "idle", hash: null, error: null, blockNumber: null };
    default:
      return state;
  }
}

/**
 * Hook to manage EVM USDC payments on Base
 * Handles chain switching, transaction writing, and confirmation
 */
export function useEVMPayment(): UseEVMPaymentResult {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const [state, dispatch] = useReducer(paymentReducer, {
    status: "idle",
    hash: null,
    error: null,
    blockNumber: null,
  });

  // Write contract hook for USDC transfer
  const {
    writeContract,
    data: hash,
    error: writeError,
  } = useWriteContract();

  // Wait for transaction confirmation
  const {
    isSuccess: isConfirmed,
    data: receipt,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: state.hash || undefined,
    confirmations: 1, // Wait for at least 1 confirmation
  });

  // Sync external state changes via effects
  // Using separate variables to track previous values avoids cascading renders
  const hashReceived = hash && state.status === "confirming-wallet";
  const txConfirmed = isConfirmed && receipt && state.status === "pending";
  const hasWriteError = writeError && state.status !== "error";
  const hasReceiptError = receiptError && state.status !== "error";

  useEffect(() => {
    if (hashReceived && hash) {
      dispatch({ type: "SET_HASH", hash });
    }
  }, [hashReceived, hash]);

  useEffect(() => {
    if (txConfirmed && receipt) {
      dispatch({ type: "SET_SUCCESS", blockNumber: receipt.blockNumber });
    }
  }, [txConfirmed, receipt]);

  useEffect(() => {
    if (hasWriteError && writeError) {
      dispatch({
        type: "SET_ERROR",
        error: writeError.message || "Transaction failed",
      });
    }
  }, [hasWriteError, writeError]);

  useEffect(() => {
    if (hasReceiptError && receiptError) {
      dispatch({
        type: "SET_ERROR",
        error: receiptError.message || "Transaction confirmation failed",
      });
    }
  }, [hasReceiptError, receiptError]);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  const initiatePayment = useCallback(
    async (
      recipientAddress: string,
      amountUsdc: number
    ): Promise<`0x${string}` | null> => {
      if (!isConnected || !address) {
        dispatch({ type: "SET_ERROR", error: "Wallet not connected" });
        return null;
      }

      try {
        // Check if on correct chain
        if (!isBaseChain(chainId)) {
          dispatch({ type: "SET_STATUS", status: "switching-chain" });

          try {
            await switchChain({ chainId: BASE_CHAIN_ID });
          } catch {
            dispatch({
              type: "SET_ERROR",
              error: "Please switch to Base network in your wallet",
            });
            return null;
          }
        }

        dispatch({ type: "SET_STATUS", status: "preparing" });

        // Convert amount to raw units
        const amountRaw = parseUnits(amountUsdc.toString(), USDC_DECIMALS);

        dispatch({ type: "SET_STATUS", status: "confirming-wallet" });

        // Write the transfer transaction
        writeContract({
          address: USDC_CONTRACT_BASE,
          abi: USDC_ABI,
          functionName: "transfer",
          args: [recipientAddress as Address, amountRaw],
          chainId: BASE_CHAIN_ID,
        });

        // Note: The actual hash will be set via the useEffect when writeContract completes
        // Return null here and let the component track state.hash
        return null;
      } catch (err) {
        console.error("Payment error:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Payment failed";

        dispatch({ type: "SET_ERROR", error: errorMessage });

        return null;
      }
    },
    [isConnected, address, chainId, switchChain, writeContract]
  );

  return {
    state,
    initiatePayment,
    reset,
  };
}

/**
 * Hook to check if wallet has sufficient USDC balance for a payment on Base
 */
export function useBaseCanAfford(amountUsdc: number): {
  canAfford: boolean;
  balance: number;
  loading: boolean;
  isWrongChain: boolean;
} {
  const { balance, loading, isWrongChain } = useBaseUsdcBalance();

  return {
    canAfford: balance >= amountUsdc,
    balance,
    loading,
    isWrongChain,
  };
}

/**
 * Convert USDC amount to raw units (wei equivalent)
 */
export function usdcToRaw(amount: number): bigint {
  return parseUnits(amount.toString(), USDC_DECIMALS);
}

/**
 * Convert raw units to USDC amount
 */
export function rawToUsdc(raw: bigint): number {
  return Number(formatUnits(raw, USDC_DECIMALS));
}
