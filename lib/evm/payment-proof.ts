export interface EVMPaymentProof {
  chain: "base";
  transaction_signature: string; // Transaction hash
  payer_address: string;
  timestamp: number;
}

export interface EVMPaymentProofSubmissionResult {
  success: boolean;
  accessGranted: boolean;
  error?: string;
  expiresAt?: string;
}

/**
 * Create a payment proof object from a confirmed EVM transaction
 */
export function createEVMPaymentProof(
  transactionHash: string,
  payerAddress: string,
  blockTimestamp?: number | null
): EVMPaymentProof {
  return {
    chain: "base",
    transaction_signature: transactionHash,
    payer_address: payerAddress,
    timestamp: blockTimestamp || Math.floor(Date.now() / 1000),
  };
}

/**
 * Submit payment proof to the API to unlock content
 * @param postId - The ID of the post to unlock
 * @param proof - The payment proof object
 * @returns Result of the submission
 */
export async function submitEVMPaymentProof(
  postId: string,
  proof: EVMPaymentProof
): Promise<EVMPaymentProofSubmissionResult> {
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
      error:
        errorData.message || `Request failed with status ${response.status}`,
    };
  } catch (error) {
    console.error("Error submitting EVM payment proof:", error);
    return {
      success: false,
      accessGranted: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

/**
 * Validate an EVM payment proof before submission
 * Performs basic client-side validation
 */
export function validateEVMPaymentProof(proof: EVMPaymentProof): {
  valid: boolean;
  error?: string;
} {
  if (!proof.transaction_signature) {
    return { valid: false, error: "Missing transaction hash" };
  }

  if (!proof.payer_address) {
    return { valid: false, error: "Missing payer address" };
  }

  // EVM transaction hashes are 66 characters (0x + 64 hex chars)
  if (
    !proof.transaction_signature.startsWith("0x") ||
    proof.transaction_signature.length !== 66
  ) {
    return { valid: false, error: "Invalid transaction hash format" };
  }

  // EVM addresses are 42 characters (0x + 40 hex chars)
  if (
    !proof.payer_address.startsWith("0x") ||
    proof.payer_address.length !== 42
  ) {
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
 * Store EVM payment proof in localStorage for session persistence
 */
export function storeEVMPaymentProof(
  postId: string,
  proof: EVMPaymentProof
): void {
  try {
    const key = `clawstack_evm_payment_${postId}`;
    const data = {
      proof,
      storedAt: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn("Failed to store EVM payment proof:", error);
  }
}

/**
 * Retrieve stored EVM payment proof from localStorage
 * Returns null if not found (purchases do not expire)
 */
export function getStoredEVMPaymentProof(
  postId: string
): EVMPaymentProof | null {
  try {
    const key = `clawstack_evm_payment_${postId}`;
    const stored = localStorage.getItem(key);

    if (!stored) return null;

    const data = JSON.parse(stored);
    return data.proof;
  } catch {
    return null;
  }
}

/**
 * Clear stored EVM payment proof
 */
export function clearStoredEVMPaymentProof(postId: string): void {
  try {
    const key = `clawstack_evm_payment_${postId}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.warn("Failed to clear EVM payment proof:", error);
  }
}

/**
 * Validate an EVM address format
 */
export function isValidEVMAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate an EVM transaction hash format
 */
export function isValidEVMTransactionHash(hash: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}
