import { useState, useEffect, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { createPublicClient, http, formatUnits, parseAbi } from "viem";
import { base } from "viem/chains";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";

// Config
const BASE_RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org";
// Use local proxy to avoid CORS/403 issues on public endpoints
const SOLANA_RPC_URL = "/api/rpc/solana";

const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const SOLANA_USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

// Viem Client
const baseClient = createPublicClient({
  chain: base,
  transport: http(BASE_RPC_URL),
});

// Solana Connection (instantiated inside hook to access window.location.origin)
// const solanaConnection = new Connection(SOLANA_RPC_URL, 'confirmed');

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
      const ethWallet = (user.wallet && user.wallet.chainType === 'ethereum')
        ? user.wallet
        : user.linkedAccounts.find((a) => a.type === 'wallet' && a.chainType === 'ethereum') as { address: string; } | undefined;

      const solWallet = (user.wallet && user.wallet.chainType === 'solana')
        ? user.wallet
        : user.linkedAccounts.find((a) => a.type === 'wallet' && a.chainType === 'solana') as { address: string; } | undefined;
      
      const ethAddress = ethWallet?.address;
      const solAddress = solWallet?.address;

      console.log("[useWalletBalances] User Identity:", user);
      console.log("[useWalletBalances] Resolved Eth Address:", ethAddress);
      console.log("[useWalletBalances] Resolved Sol Address:", solAddress);

      // Define Fetchers
      const fetchEth = async () => {
          if (!ethAddress) return "0.00";
          const raw = await baseClient.getBalance({ address: ethAddress as `0x${string}` });
          return parseFloat(formatUnits(raw, 18)).toFixed(4);
      };

      const fetchUsdcBase = async () => {
          if (!ethAddress) return "0.00";
          const raw = await baseClient.readContract({
              address: BASE_USDC_ADDRESS,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [ethAddress as `0x${string}`],
          });
          return parseFloat(formatUnits(raw, 6)).toFixed(2); // USDC is 6 decimals
      };

      const fetchSol = async () => {
          if (!solAddress) {
              console.log("[useWalletBalances] No SOL address found, returning 0.00");
              return "0.00";
          }
          console.log("[useWalletBalances] Fetching SOL for:", solAddress);
          try {
             // Construct absolute URL for proxy
             const rpcUrl = `${window.location.origin}${SOLANA_RPC_URL}`;
             const connection = new Connection(rpcUrl, 'confirmed');
             const raw = await connection.getBalance(new PublicKey(solAddress));
             console.log("[useWalletBalances] Raw SOL:", raw);
             return (raw / LAMPORTS_PER_SOL).toFixed(4);
          } catch (e) {
             console.error("[useWalletBalances] Error fetching SOL:", e);
             return "0.00";
          }
      };

      const fetchUsdcSol = async () => {
          if (!solAddress) return "0.00";
          try {
            const pubKey = new PublicKey(solAddress);
            const usdcAta = await getAssociatedTokenAddress(SOLANA_USDC_MINT, pubKey);
            console.log("[useWalletBalances] USDC ATA:", usdcAta.toBase58());
            
            // Construct absolute URL for proxy
            const rpcUrl = `${window.location.origin}${SOLANA_RPC_URL}`;
            const connection = new Connection(rpcUrl, 'confirmed');
            
            const accountInfo = await getAccount(connection, usdcAta);
            console.log("[useWalletBalances] USDC Account Info:", accountInfo);
            return (Number(accountInfo.amount) / 1000000).toFixed(2);
          } catch (e) {
            console.warn("[useWalletBalances] USDC Fetch Warning (likely no account):", e);
            // TokenAccountNotFoundError is expected if user has no USDC
            return "0.00";
          }
      };

      // Execute all independently
      const results = await Promise.allSettled([
          fetchEth(),
          fetchUsdcBase(),
          fetchSol(),
          fetchUsdcSol()
      ]);

      // Extract results (default to "0.00" on failure)
      const eth = results[0].status === 'fulfilled' ? results[0].value : "0.00";
      const usdcBase = results[1].status === 'fulfilled' ? results[1].value : "0.00";
      const sol = results[2].status === 'fulfilled' ? results[2].value : "0.00";
      const usdcSol = results[3].status === 'fulfilled' ? results[3].value : "0.00";

      // Log errors if any
      if (results[0].status === 'rejected') console.warn("Failed to fetch ETH:", results[0].reason);
      if (results[1].status === 'rejected') console.warn("Failed to fetch Base USDC:", results[1].reason);
      if (results[2].status === 'rejected') console.warn("Failed to fetch SOL:", results[2].reason);
      if (results[3].status === 'rejected') console.warn("Failed to fetch Solana USDC:", results[3].reason);

      setBalances({ eth, usdcBase, sol, usdcSol });

    } catch (error) {
      console.error("Critical error in fetchBalances:", error);
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
