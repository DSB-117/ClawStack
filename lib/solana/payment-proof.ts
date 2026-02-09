// import type { PaymentConfirmationResult } from "./usdc";

export interface PaymentProof {
  chain: "solana";
  transaction_signature: string;
  payer_address: string;
  timestamp: number;
}

export interface PaymentProofSubmissionResult {
  success: boolean;
  accessGranted: boolean;
  error?: string;
  expiresAt?: string;
}

/**
 * Create a payment proof object from a confirmed transaction
 */
export function createPaymentProof(
  signature: string,
  payerAddress: string,
  blockTime?: number | null
): PaymentProof {
  return {
    chain: "solana",
    transaction_signature: signature,
    payer_address: payerAddress,
    timestamp: blockTime || Math.floor(Date.now() / 1000),
  };
}

/**
 * Submit payment proof to the API to unlock content
 * @param postId - The ID of the post to unlock
 * @param proof - The payment proof object
 * @returns Result of the submission
 */
export async function submitPaymentProof(
  postId: string,
  proof: PaymentProof
): Promise<PaymentProofSubmissionResult> {
  try {
    const response = await fetch(`/api/v1/post/${postId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Payment-Proof": JSON.stringify(proof),
      },
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        accessGranted: true,
        expiresAt: data.access_expires_at,
      };
    }

    // Handle error responses
    const errorData = await response.json().catch(() => ({}));

    if (response.status === 402) {
      return {
        success: false,
        accessGranted: false,
        error: "Payment verification failed. Please try again.",
      };
    }

    return {
      success: false,
      accessGranted: false,
      error: errorData.message || `Request failed with status ${response.status}`,
    };
  } catch (error) {
    console.error("Error submitting payment proof:", error);
    return {
      success: false,
      accessGranted: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

/**
 * Verify a payment proof is valid before submission
 * Performs basic client-side validation
 */
export function validatePaymentProof(proof: PaymentProof): {
  valid: boolean;
  error?: string;
} {
  if (!proof.transaction_signature) {
    return { valid: false, error: "Missing transaction signature" };
  }

  if (!proof.payer_address) {
    return { valid: false, error: "Missing payer address" };
  }

  // Solana signatures are base58 encoded and ~88 characters
  if (proof.transaction_signature.length < 80) {
    return { valid: false, error: "Invalid transaction signature format" };
  }

  // Basic Solana address validation (base58, 32-44 chars)
  if (proof.payer_address.length < 32 || proof.payer_address.length > 44) {
    return { valid: false, error: "Invalid payer address format" };
  }

  // Check timestamp is reasonable (not more than 5 minutes in the future)
  const now = Math.floor(Date.now() / 1000);
  if (proof.timestamp > now + 300) {
    return { valid: false, error: "Invalid timestamp" };
  }

  return { valid: true };
}

/**
 * Store payment proof in localStorage for session persistence
 */
export function storePaymentProof(postId: string, proof: PaymentProof): void {
  try {
    const key = `clawstack_payment_${postId}`;
    const data = {
      proof,
      storedAt: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn("Failed to store payment proof:", error);
  }
}

/**
 * Retrieve stored payment proof from localStorage
 * Returns null if not found (purchases do not expire)
 */
export function getStoredPaymentProof(postId: string): PaymentProof | null {
  try {
    const key = `clawstack_payment_${postId}`;
    const stored = localStorage.getItem(key);

    if (!stored) return null;

    const data = JSON.parse(stored);
    return data.proof;
  } catch {
    return null;
  }
}

/**
 * Clear stored payment proof
 */
export function clearStoredPaymentProof(postId: string): void {
  try {
    const key = `clawstack_payment_${postId}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.warn("Failed to clear payment proof:", error);
  }
}
