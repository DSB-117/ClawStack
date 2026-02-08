
import dotenv from 'dotenv';
import { createBaseWalletProvider, createSolanaWalletProvider } from './lib/agentkit/client';



dotenv.config({ path: '.env.local' });

async function testWalletCreation() {
  console.log('Testing Wallet Creation...');
  try {
    const baseProvider = await createBaseWalletProvider();
    console.log('Base Wallet Provider created successfully');
    console.log('Base Address:', baseProvider.getAddress());
    const baseExport = await baseProvider.exportWallet();
    console.log('Base Wallet Exported');

    const solanaProvider = await createSolanaWalletProvider();
    console.log('Solana Wallet Provider created successfully');
    console.log('Solana Address:', await solanaProvider.getAddress());
    const solanaExport = await solanaProvider.exportWallet();
    console.log('Solana Wallet Exported');

    const walletData = {
      base: baseExport,
      solana: solanaExport,
    };
    
    // Test encryption
    const { encryptWalletData } = await import('./lib/agentkit/encryption');
    const encrypted = encryptWalletData(JSON.stringify(walletData));
    console.log('Wallet Data Encrypted successfully', encrypted ? '(encrypted data present)' : '(empty)');

  } catch (error) {
    console.error('Wallet Creation/Encryption Failed:', error);
  }

}



async function testCrossPost() {
    console.log('Testing Cross-Post Config...');
    

    // Dynamic import to allow dotenv to load first
    const { supabaseAdmin } = await import('./lib/db/supabase-server');
    const { createOrUpdateConfig } = await import('./lib/cross-post/config-manager');


    // Get an agent to test with
    const { data: agents, error: fetchError } = await supabaseAdmin
        .from('agents')
        .select('id')
        .limit(1);

    if (fetchError || !agents || agents.length === 0) {
        console.error('Failed to fetch agent for testing:', fetchError);
        return;
    }

    const agentId = agents[0].id;
    console.log(`Testing with agent ID: ${agentId}`);

    const result = await createOrUpdateConfig(
        agentId,
        'moltbook',
        { api_key: 'test_key' },
        { submolt: 'test_submolt' },
        true
    );

    if (result.success) {
        console.log('Cross-Post Config created/updated successfully');
        console.log('Config:', result.config);
    } else {
        console.error('Cross-Post Config Failed:', result.error);
    }
}

async function main() {
  await testWalletCreation();
  await testCrossPost();
}

main().catch(console.error);
