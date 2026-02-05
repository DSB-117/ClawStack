import { useState, useEffect, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { createPublicClient, http, formatUnits, parseAbi } from "viem";
import { base } from "viem/chains";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";

// Config
const BASE_RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org";
const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const SOLANA_USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

// Viem Client
const baseClient = createPublicClient({
  chain: base,
  transport: http(BASE_RPC_URL),
});

// Solana Connection
const solanaConnection = new Connection(SOLANA_RPC_URL);

// ERC20 ABI (minimal)
const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

export interface WalletBalances {
  eth: string;
  usdcBase: string;
  sol: string;
  usdcSol: string;
}

export function useWalletBalances() {
  const { user, authenticated } = usePrivy();
  const [balances, setBalances] = useState<WalletBalances>({
    eth: "0.00",
    usdcBase: "0.00",
    sol: "0.00",
    usdcSol: "0.00",
  });
  const [isLoading, setIsLoading] = useState(false);

  const fetchBalances = useCallback(async () => {
    if (!authenticated || !user) return;
    setIsLoading(true);

    try {
      // 1. Identify Addresses
      const ethWallet = user.wallet ? user.wallet : user.linkedAccounts.find(a => a.type === 'wallet' && a.chainType === 'ethereum');
      // @ts-expect-error - Privy types might be strict, but we check specific fields
      const solWallet = user.linkedAccounts.find(a => a.type === 'wallet' && a.chainType === 'solana');
      
      const ethAddress = ethWallet?.address;
      const solAddress = solWallet?.address;

      // 2. Fetch Base Balances (ETH + USDC)
      let ethBal = "0.00";
      let usdcBaseBal = "0.00";

      if (ethAddress) {
        // Native ETH Balance
        const rawEth = await baseClient.getBalance({ address: ethAddress as `0x${string}` });
        ethBal = parseFloat(formatUnits(rawEth, 18)).toFixed(4);

        // USDC Balance
        const rawUsdc = await baseClient.readContract({
          address: BASE_USDC_ADDRESS,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [ethAddress as `0x${string}`],
        });
        usdcBaseBal = parseFloat(formatUnits(rawUsdc, 6)).toFixed(2);
      }

      // 3. Fetch Solana Balances (SOL + USDC)
      let solBal = "0.00";
      let usdcSolBal = "0.00";

      if (solAddress) {
        const pubKey = new PublicKey(solAddress);
        
        // Native SOL Balance
        const rawSol = await solanaConnection.getBalance(pubKey);
        solBal = (rawSol / LAMPORTS_PER_SOL).toFixed(4);

        // USDC Balance
        try {
          const usdcAta = await getAssociatedTokenAddress(SOLANA_USDC_MINT, pubKey);
          const accountInfo = await getAccount(solanaConnection, usdcAta);
          // Amount is BigInt from spl-token, but returns distinct type in newer versions. usage: amount
          // manual calculation: Number(accountInfo.amount) / 10^6
          const rawSolUsdc = Number(accountInfo.amount);
          usdcSolBal = (rawSolUsdc / 1000000).toFixed(2);
        } catch {
          // ATA might not exist if user has no USDC
          usdcSolBal = "0.00";
        }
      }

      setBalances({
        eth: ethBal,
        usdcBase: usdcBaseBal,
        sol: solBal,
        usdcSol: usdcSolBal,
      });

    } catch (error) {
      console.error("Error fetching balances:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, authenticated]);

  // Refetch on auth change or mount
  useEffect(() => {
    if (authenticated) {
      fetchBalances();
    }
  }, [authenticated, fetchBalances]);

  return { balances, isLoading, refetch: fetchBalances };
}
