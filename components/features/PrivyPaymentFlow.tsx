'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePrivy, useSendTransaction } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets, useSignAndSendTransaction } from '@privy-io/react-auth/solana';
import { Button } from '@/components/ui/button';
import {
  createPaymentProof,
  submitPaymentProof,
  storePaymentProof,
} from '@/lib/solana';
import {
  createEVMPaymentProof,
  submitEVMPaymentProof,
  storeEVMPaymentProof,
} from '@/lib/evm/payment-proof';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { parseUnits, encodeFunctionData } from 'viem';

// USDC Constants
const SOLANA_USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_DECIMALS = 6;

// ERC20 Transfer ABI
const ERC20_TRANSFER_ABI = [
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const;

interface PrivyPaymentFlowProps {
  postId: string;
  priceUsdc: number;
  recipientAddress: string;
  chain: 'solana' | 'base';
  onSuccess: () => void;
  onError: (error: string) => void;
}

type FlowStep =
  | 'checking-wallet'
  | 'check-balance'
  | 'ready'
  | 'paying'
  | 'confirming'
  | 'submitting'
  | 'success'
  | 'error';

/**
 * Privy-based payment flow using embedded wallet
 * Supports both Solana and Base (EVM) USDC payments
 */
export function PrivyPaymentFlow({
  postId,
  priceUsdc,
  recipientAddress,
  chain,
  onSuccess,
  onError,
}: PrivyPaymentFlowProps) {
  const { user, authenticated, login } = usePrivy();
  const { sendTransaction } = useSendTransaction();
  const { wallets: solanaWallets } = useSolanaWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();

  const [step, setStep] = useState<FlowStep>('checking-wallet');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  // Get the appropriate wallet address based on chain
  const getWalletAddress = useCallback(() => {
    if (!user) return null;

    if (chain === 'solana') {
      // Check Privy Solana wallets from the hook
      const solWallet = solanaWallets.find((w) => w.address);
      if (solWallet) return solWallet.address;

      // Fallback to linked accounts
      const linkedSol = user.linkedAccounts.find(
        (a) => a.type === 'wallet' && a.chainType === 'solana'
      ) as { address: string } | undefined;
      return linkedSol?.address || null;
    } else {
      // EVM wallet
      const ethWallet =
        user.wallet && user.wallet.chainType === 'ethereum'
          ? user.wallet
          : (user.linkedAccounts.find(
              (a) => a.type === 'wallet' && a.chainType === 'ethereum'
            ) as { address: string } | undefined);
      return ethWallet?.address || null;
    }
  }, [user, chain, solanaWallets]);

  const walletAddress = getWalletAddress();

  // Fetch balance
  useEffect(() => {
    async function fetchBalance() {
      if (!walletAddress) {
        setBalanceLoading(false);
        return;
      }

      setBalanceLoading(true);
      try {
        if (chain === 'solana') {
          const rpcUrl = `${window.location.origin}/api/rpc/solana`;
          const connection = new Connection(rpcUrl, 'confirmed');
          const pubKey = new PublicKey(walletAddress);
          const usdcAta = await getAssociatedTokenAddress(SOLANA_USDC_MINT, pubKey);

          try {
            const accountInfo = await connection.getTokenAccountBalance(usdcAta);
            setBalance(Number(accountInfo.value.uiAmount) || 0);
          } catch {
            // No USDC account
            setBalance(0);
          }
        } else {
          // Base USDC balance
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_call',
                params: [
                  {
                    to: BASE_USDC_ADDRESS,
                    data: `0x70a08231000000000000000000000000${walletAddress.slice(2)}`,
                  },
                  'latest',
                ],
              }),
            }
          );
          const data = await response.json();
          if (data.result) {
            const rawBalance = BigInt(data.result);
            setBalance(Number(rawBalance) / 10 ** USDC_DECIMALS);
          }
        }
      } catch (error) {
        console.error('Error fetching balance:', error);
        setBalance(0);
      } finally {
        setBalanceLoading(false);
      }
    }

    fetchBalance();
  }, [walletAddress, chain]);

  // Update step based on state
  useEffect(() => {
    if (!authenticated) {
      setStep('checking-wallet');
      return;
    }

    if (!walletAddress) {
      setStep('checking-wallet');
      return;
    }

    if (balanceLoading) {
      setStep('check-balance');
      return;
    }

    if (step === 'checking-wallet' || step === 'check-balance') {
      setStep('ready');
    }
  }, [authenticated, walletAddress, balanceLoading, step]);

  // Handle Solana payment
  const handleSolanaPayment = useCallback(async () => {
    if (!walletAddress) return;

    setStep('paying');

    try {
      const rpcUrl = `${window.location.origin}/api/rpc/solana`;
      const connection = new Connection(rpcUrl, 'confirmed');

      // Get a Solana wallet from Privy
      const privyWallet = solanaWallets.find((w) => w.address);
      if (!privyWallet) {
        throw new Error('Solana wallet not found. Please ensure you have a Solana wallet connected.');
      }

      // Create USDC transfer instruction
      const senderPubkey = new PublicKey(walletAddress);
      const recipientPubkey = new PublicKey(recipientAddress);

      const senderAta = await getAssociatedTokenAddress(SOLANA_USDC_MINT, senderPubkey);
      const recipientAta = await getAssociatedTokenAddress(SOLANA_USDC_MINT, recipientPubkey);

      const amount = Math.floor(priceUsdc * 10 ** USDC_DECIMALS);

      const transferIx = createTransferInstruction(
        senderAta,
        recipientAta,
        senderPubkey,
        amount,
        [],
        TOKEN_PROGRAM_ID
      );

      // Add memo for tracking
      const memoIx = {
        keys: [],
        programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
        data: Buffer.from(`clawstack:${postId}:${Math.floor(Date.now() / 1000)}`),
      };

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

      const transaction = new Transaction({
        feePayer: senderPubkey,
        blockhash,
        lastValidBlockHeight,
      }).add(transferIx, memoIx);

      setStep('confirming');

      // Sign and send with Privy
      const serializedTx = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });

      const result = await signAndSendTransaction({
        transaction: serializedTx,
        wallet: privyWallet,
      });

      const signature = Buffer.from(result.signature).toString('base64');
      // Convert to hex for Solana explorer
      const signatureHex = Buffer.from(result.signature).toString('hex');
      setTxSignature(signatureHex);

      setStep('submitting');

      // Create and submit proof
      const proof = createPaymentProof(signatureHex, walletAddress);
      storePaymentProof(postId, proof);
      const submitResult = await submitPaymentProof(postId, proof);

      if (submitResult.success && submitResult.accessGranted) {
        setStep('success');
        onSuccess();
      } else {
        throw new Error(submitResult.error || 'Failed to verify payment');
      }
    } catch (error) {
      console.error('Solana payment error:', error);
      setStep('error');
      setErrorMessage(error instanceof Error ? error.message : 'Payment failed');
      onError(error instanceof Error ? error.message : 'Payment failed');
    }
  }, [walletAddress, recipientAddress, priceUsdc, postId, solanaWallets, signAndSendTransaction, onSuccess, onError]);

  // Handle Base/EVM payment
  const handleEVMPayment = useCallback(async () => {
    if (!walletAddress) return;

    setStep('paying');

    try {
      const amount = parseUnits(priceUsdc.toString(), USDC_DECIMALS);

      // Encode the transfer function call
      const data = encodeFunctionData({
        abi: ERC20_TRANSFER_ABI,
        functionName: 'transfer',
        args: [recipientAddress as `0x${string}`, amount],
      });

      setStep('confirming');

      // Send transaction with Privy
      const result = await sendTransaction({
        to: BASE_USDC_ADDRESS as `0x${string}`,
        data,
        chainId: 8453, // Base mainnet
      });

      const txHash = result.hash;
      setTxSignature(txHash);

      setStep('submitting');

      // Create and submit proof
      const proof = createEVMPaymentProof(txHash, walletAddress);
      storeEVMPaymentProof(postId, proof);
      const submitResult = await submitEVMPaymentProof(postId, proof);

      if (submitResult.success && submitResult.accessGranted) {
        setStep('success');
        onSuccess();
      } else {
        throw new Error(submitResult.error || 'Failed to verify payment');
      }
    } catch (error) {
      console.error('EVM payment error:', error);
      setStep('error');
      setErrorMessage(error instanceof Error ? error.message : 'Payment failed');
      onError(error instanceof Error ? error.message : 'Payment failed');
    }
  }, [walletAddress, recipientAddress, priceUsdc, postId, sendTransaction, onSuccess, onError]);

  const handlePay = useCallback(() => {
    if (balance < priceUsdc) {
      setErrorMessage(`Insufficient balance. You need ${priceUsdc} USDC.`);
      setStep('error');
      return;
    }

    if (chain === 'solana') {
      handleSolanaPayment();
    } else {
      handleEVMPayment();
    }
  }, [balance, priceUsdc, chain, handleSolanaPayment, handleEVMPayment]);

  const handleRetry = useCallback(() => {
    setErrorMessage(null);
    setStep('ready');
  }, []);

  const canAfford = balance >= priceUsdc;
  const chainColor = chain === 'solana' ? '#9945FF' : '#0052FF';
  const chainName = chain === 'solana' ? 'Solana' : 'Base';

  return (
    <div className="space-y-4">
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {['verify', 'pay', 'confirm'].map((s, i) => {
          const isActive =
            (s === 'verify' && ['checking-wallet', 'check-balance'].includes(step)) ||
            (s === 'pay' && ['ready', 'paying'].includes(step)) ||
            (s === 'confirm' && ['confirming', 'submitting', 'success'].includes(step));
          const isComplete =
            (s === 'verify' && !['checking-wallet', 'check-balance'].includes(step)) ||
            (s === 'pay' && ['confirming', 'submitting', 'success'].includes(step)) ||
            (s === 'confirm' && step === 'success');

          return (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className={`w-8 h-0.5 ${isComplete ? 'bg-claw-secondary' : 'bg-muted'}`}
                />
              )}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  isComplete
                    ? 'bg-claw-secondary text-white'
                    : isActive
                      ? 'text-white'
                      : 'bg-muted text-muted-foreground'
                }`}
                style={isActive && !isComplete ? { backgroundColor: chainColor } : {}}
              >
                {isComplete ? '✓' : i + 1}
              </div>
            </div>
          );
        })}
      </div>

      {/* Checking Wallet */}
      {step === 'checking-wallet' && (
        <div className="text-center space-y-4">
          {!authenticated ? (
            <>
              <p className="text-sm text-muted-foreground">
                Sign in to use your account funds
              </p>
              <Button
                onClick={login}
                variant="outline"
                className="w-full"
                style={{ borderColor: `${chainColor}30` }}
              >
                Sign In with Privy
              </Button>
            </>
          ) : !walletAddress ? (
            <>
              <LoadingSpinner color={chainColor} />
              <p className="text-sm text-muted-foreground">
                Setting up your {chainName} wallet...
              </p>
            </>
          ) : null}
        </div>
      )}

      {/* Check Balance */}
      {step === 'check-balance' && (
        <div className="text-center space-y-4">
          <LoadingSpinner color={chainColor} />
          <p className="text-sm text-muted-foreground">Checking your USDC balance...</p>
        </div>
      )}

      {/* Ready */}
      {step === 'ready' && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">Your Balance</span>
              <span className="font-medium">${balance.toFixed(2)} USDC</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Price</span>
              <span className="font-medium" style={{ color: '#FF8533' }}>
                ${priceUsdc.toFixed(2)} USDC
              </span>
            </div>
          </div>

          {!canAfford && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              Insufficient balance. You need ${(priceUsdc - balance).toFixed(2)} more USDC.
            </div>
          )}

          <Button
            onClick={handlePay}
            className="w-full text-white"
            style={{ backgroundColor: chainColor }}
            disabled={!canAfford}
          >
            Pay ${priceUsdc.toFixed(2)} USDC
          </Button>
        </div>
      )}

      {/* Paying */}
      {step === 'paying' && (
        <div className="text-center space-y-4">
          <LoadingSpinner color={chainColor} />
          <p className="text-sm text-muted-foreground">Preparing transaction...</p>
        </div>
      )}

      {/* Confirming */}
      {step === 'confirming' && (
        <div className="text-center space-y-4">
          <LoadingSpinner color={chainColor} />
          <p className="text-sm text-muted-foreground">
            Confirming transaction on {chainName}...
          </p>
          {txSignature && (
            <a
              href={
                chain === 'solana'
                  ? `https://solscan.io/tx/${txSignature}`
                  : `https://basescan.org/tx/${txSignature}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs hover:underline"
              style={{ color: chainColor }}
            >
              View on {chain === 'solana' ? 'Solscan' : 'BaseScan'} →
            </a>
          )}
        </div>
      )}

      {/* Submitting */}
      {step === 'submitting' && (
        <div className="text-center space-y-4">
          <LoadingSpinner color={chainColor} />
          <p className="text-sm text-muted-foreground">
            Verifying payment and unlocking content...
          </p>
        </div>
      )}

      {/* Success */}
      {step === 'success' && (
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
          <p className="text-sm text-muted-foreground">Content is now unlocked.</p>
        </div>
      )}

      {/* Error */}
      {step === 'error' && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm text-center">
            {errorMessage || 'An error occurred'}
          </div>
          <Button onClick={handleRetry} variant="outline" className="w-full">
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}

function LoadingSpinner({ color = '#FF5E1A' }: { color?: string }) {
  return (
    <svg
      className="animate-spin h-8 w-8 mx-auto"
      style={{ color }}
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
