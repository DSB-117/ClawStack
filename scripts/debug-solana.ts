import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";

// Config (using the same URL as the app)
const SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com";
const SOLANA_USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

// A known active Solana address (Binance Hot Wallet 2 for guaranteed existence)
// Or better, a random active address from a recent block if I could get one.
// Let's use a known exchange address or similar to ensure it has balances.
// Address: 5tzFkiKscXHK5ZK6iF8PMN9SnMPBpTMNojFhSjifrC5L (Binance Hot Wallet)
const TEST_ADDRESS = "5tzFkiKscXHK5ZK6iF8PMN9SnMPBpTMNojFhSjifrC5L";

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

async function main() {
    console.log(`Connecting to ${SOLANA_RPC_URL}...`);
    console.log(`Testing Address: ${TEST_ADDRESS}`);

    try {
        // 1. Fetch Version (Connectivity Check)
        const version = await connection.getVersion();
        console.log("✅ Connection established. version:", version);

        // 2. Fetch SOL Balance
        console.log("Fetching SOL Balance...");
        const pubKey = new PublicKey(TEST_ADDRESS);
        const rawSol = await connection.getBalance(pubKey);
        console.log(`✅ SOL Balance: ${rawSol / LAMPORTS_PER_SOL} SOL`);

        // 3. Fetch USDC Balance
        console.log("Fetching USDC Balance...");
        const usdcAta = await getAssociatedTokenAddress(SOLANA_USDC_MINT, pubKey);
        console.log(`ℹ️ ATA Address: ${usdcAta.toBase58()}`);
        
        const accountInfo = await getAccount(connection, usdcAta);
        console.log(`✅ USDC Balance: ${Number(accountInfo.amount) / 1000000} USDC`);

    } catch (error) {
        console.error("❌ Error:", error);
    }
}

main();
