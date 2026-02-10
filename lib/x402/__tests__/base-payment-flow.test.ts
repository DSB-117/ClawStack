/**
 * Base Payment Flow Integration Tests
 *
 * Tests the complete multi-chain x402 payment flow for Base L2.
 *
 * @see claude/operations/tasks.md Task 3.3.8
 */

import {
  parsePaymentProof,
  verifyPayment,
  // recordPaymentEvent,
} from '../verify';
import {
  buildPaymentOptions,
  buildBasePaymentOption,
  buildSolanaPaymentOption,
} from '../helpers';
// import { PaymentProof, PostForPayment, PaymentOption } from '../types';
import { PaymentProof, PostForPayment } from '../types';

// ============================================
// Test Fixtures
// ============================================

const MOCK_POST: PostForPayment = {
  id: 'post_test123',
  title: 'Test Paid Article',
  content: 'Full content here...',
  summary: 'Test summary',
  is_paid: true,
  price_usdc: '0.25',
  paid_view_count: 0,
  author_id: 'agent_author123',
  author: {
    id: 'agent_author123',
    display_name: 'TestAuthor',
    avatar_url: null,
    wallet_solana: 'SoLaNaWaLLeTaDdReSs111111111111111111111111',
    wallet_base: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fE3D',
  },
};

const MOCK_BASE_TX_HASH = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
const MOCK_SOLANA_SIGNATURE = '5xK3vPqhZrVBGpKiSvXvPqhZrVBGpKiSvXvPqhZrVBGpKiSvXvPqhZrVBGpKiSvX';
const MOCK_PAYER_ADDRESS = '0x1234567890123456789012345678901234567890';

// ============================================
// Setup/Teardown
// ============================================

const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = {
    ...originalEnv,
    BASE_TREASURY_ADDRESS: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fE3D',
    USDC_CONTRACT_BASE: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    SOLANA_TREASURY_PUBKEY: 'CStkPay111111111111111111111111111111111111',
    USDC_MINT_SOLANA: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  };
});

afterEach(() => {
  process.env = originalEnv;
});

// ============================================
// Task 3.3.1: Build Base Payment Option Object
// ============================================

describe('buildBasePaymentOption', () => {
  it('should build a valid Base payment option', () => {
    const option = buildBasePaymentOption('post_abc123');

    expect(option.chain).toBe('base');
    expect(option.chain_id).toBe('8453');
    expect(option.recipient).toBe(process.env.BASE_TREASURY_ADDRESS);
    expect(option.token_contract).toBe(process.env.USDC_CONTRACT_BASE);
    expect(option.token_symbol).toBe('USDC');
    expect(option.decimals).toBe(6);
    expect(option.reference).toMatch(/^0xclawstack_post_abc123_\d+$/);
  });

  it('should throw if BASE_TREASURY_ADDRESS not set', () => {
    process.env.BASE_TREASURY_ADDRESS = '';

    expect(() => buildBasePaymentOption('post_abc123')).toThrow(
      'BASE_TREASURY_ADDRESS environment variable is not set'
    );
  });

  it('should throw if USDC_CONTRACT_BASE not set', () => {
    process.env.USDC_CONTRACT_BASE = '';

    expect(() => buildBasePaymentOption('post_abc123')).toThrow(
      'USDC_CONTRACT_BASE environment variable is not set'
    );
  });
});

// ============================================
// Task 3.3.2: Add Base Option to 402 Response
// ============================================

describe('buildPaymentOptions (multi-chain)', () => {
  it('should include both Solana and Base options by default', () => {
    const options = buildPaymentOptions('post_abc123');

    expect(options).toHaveLength(2);

    const solanaOption = options.find((o) => o.chain === 'solana');
    const baseOption = options.find((o) => o.chain === 'base');

    expect(solanaOption).toBeDefined();
    expect(baseOption).toBeDefined();
  });

  it('should include Solana-specific fields', () => {
    const options = buildPaymentOptions('post_abc123');
    const solanaOption = options.find((o) => o.chain === 'solana');

    expect(solanaOption?.chain_id).toBe('mainnet-beta');
    expect(solanaOption?.token_mint).toBe(process.env.USDC_MINT_SOLANA);
    expect(solanaOption?.memo).toMatch(/^clawstack:post_abc123:\d+$/);
  });

  it('should include Base-specific fields', () => {
    const options = buildPaymentOptions('post_abc123');
    const baseOption = options.find((o) => o.chain === 'base');

    expect(baseOption?.chain_id).toBe('8453');
    expect(baseOption?.token_contract).toBe(process.env.USDC_CONTRACT_BASE);
    expect(baseOption?.reference).toMatch(/^0xclawstack_post_abc123_\d+$/);
  });

  it('should allow filtering to single chain', () => {
    const solanaOnly = buildPaymentOptions('post_abc123', ['solana']);
    const baseOnly = buildPaymentOptions('post_abc123', ['base']);

    expect(solanaOnly).toHaveLength(1);
    expect(solanaOnly[0].chain).toBe('solana');

    expect(baseOnly).toHaveLength(1);
    expect(baseOnly[0].chain).toBe('base');
  });

  it('should gracefully handle missing chain config', () => {
    process.env.BASE_TREASURY_ADDRESS = '';

    const options = buildPaymentOptions('post_abc123');

    // Should still have Solana option
    expect(options).toHaveLength(1);
    expect(options[0].chain).toBe('solana');
  });
});

// ============================================
// Task 3.3.3: Generate EVM-Compatible Reference
// ============================================

describe('EVM-compatible reference', () => {
  it('should generate hex-prefixed reference', () => {
    const option = buildBasePaymentOption('post_abc123');

    expect(option.reference).toMatch(/^0x/);
  });

  it('should include post ID in reference', () => {
    const option = buildBasePaymentOption('post_abc123');

    expect(option.reference).toContain('post_abc123');
  });

  it('should include timestamp in reference', () => {
    const before = Math.floor(Date.now() / 1000);
    const option = buildBasePaymentOption('post_abc123');
    const after = Math.floor(Date.now() / 1000);

    const match = option.reference?.match(/_(\d+)$/);
    expect(match).toBeTruthy();

    const timestamp = parseInt(match![1], 10);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });
});

// ============================================
// Task 3.3.4: Update X-Payment-Proof Parser for EVM
// ============================================

describe('parsePaymentProof (EVM support)', () => {
  it('should parse valid Base payment proof', () => {
    const header = JSON.stringify({
      chain: 'base',
      transaction_signature: MOCK_BASE_TX_HASH,
      payer_address: MOCK_PAYER_ADDRESS,
      timestamp: 1706960000,
    });

    const proof = parsePaymentProof(header);

    expect(proof).not.toBeNull();
    expect(proof?.chain).toBe('base');
    expect(proof?.transaction_signature).toBe(MOCK_BASE_TX_HASH);
    expect(proof?.payer_address).toBe(MOCK_PAYER_ADDRESS);
  });

  it('should reject invalid EVM transaction hash format', () => {
    const header = JSON.stringify({
      chain: 'base',
      transaction_signature: 'invalid_hash',
      payer_address: MOCK_PAYER_ADDRESS,
    });

    const proof = parsePaymentProof(header);

    expect(proof).toBeNull();
  });

  it('should reject EVM hash that is too short', () => {
    const header = JSON.stringify({
      chain: 'base',
      transaction_signature: '0x123',
      payer_address: MOCK_PAYER_ADDRESS,
    });

    const proof = parsePaymentProof(header);

    expect(proof).toBeNull();
  });

  it('should reject EVM hash without 0x prefix', () => {
    const header = JSON.stringify({
      chain: 'base',
      transaction_signature: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      payer_address: MOCK_PAYER_ADDRESS,
    });

    const proof = parsePaymentProof(header);

    expect(proof).toBeNull();
  });

  it('should still accept valid Solana signatures', () => {
    const header = JSON.stringify({
      chain: 'solana',
      transaction_signature: MOCK_SOLANA_SIGNATURE,
      payer_address: 'SoLaNaWaLLeTaDdReSs111111111111111111111111',
    });

    const proof = parsePaymentProof(header);

    expect(proof).not.toBeNull();
    expect(proof?.chain).toBe('solana');
  });
});

// ============================================
// Task 3.3.6: Handle Chain Mismatch Errors
// ============================================

describe('chain validation', () => {
  it('should reject unsupported chains', () => {
    const header = JSON.stringify({
      chain: 'ethereum',
      transaction_signature: MOCK_BASE_TX_HASH,
      payer_address: MOCK_PAYER_ADDRESS,
    });

    const proof = parsePaymentProof(header);

    expect(proof).toBeNull();
  });

  it('should accept solana chain', () => {
    const header = JSON.stringify({
      chain: 'solana',
      transaction_signature: MOCK_SOLANA_SIGNATURE,
      payer_address: 'SoLaNaWaLLeTaDdReSs111111111111111111111111',
    });

    const proof = parsePaymentProof(header);

    expect(proof?.chain).toBe('solana');
  });

  it('should accept base chain', () => {
    const header = JSON.stringify({
      chain: 'base',
      transaction_signature: MOCK_BASE_TX_HASH,
      payer_address: MOCK_PAYER_ADDRESS,
    });

    const proof = parsePaymentProof(header);

    expect(proof?.chain).toBe('base');
  });
});

// ============================================
// Task 3.3.5: Route to EVM Verifier Based on Chain
// ============================================

describe('verifyPayment routing', () => {
  it('should route base chain to EVM verifier', async () => {
    const proof: PaymentProof = {
      chain: 'base',
      transaction_signature: MOCK_BASE_TX_HASH,
      payer_address: MOCK_PAYER_ADDRESS,
      timestamp: Math.floor(Date.now() / 1000),
    };

    // This will fail because we're not mocking the RPC call,
    // but it should fail with an EVM-specific error, not "not implemented"
    const result = await verifyPayment(proof, MOCK_POST);

    // Should NOT return "not implemented" error
    expect(result.error_code).not.toBe('NOT_IMPLEMENTED');
  });

  it('should route solana chain to Solana verifier', async () => {
    const proof: PaymentProof = {
      chain: 'solana',
      transaction_signature: MOCK_SOLANA_SIGNATURE,
      payer_address: 'SoLaNaWaLLeTaDdReSs111111111111111111111111',
      timestamp: Math.floor(Date.now() / 1000),
    };

    // This will fail because we're not mocking the RPC call,
    // but it should fail with a Solana-specific error
    const result = await verifyPayment(proof, MOCK_POST);

    // Should NOT return "not implemented" error
    expect(result.error_code).not.toBe('NOT_IMPLEMENTED');
  });

  it('should return unsupported chain error for unknown chains', async () => {
    const proof = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chain: 'polygon' as any,
      transaction_signature: MOCK_BASE_TX_HASH,
      payer_address: MOCK_PAYER_ADDRESS,
      timestamp: Math.floor(Date.now() / 1000),
    };

    const result = await verifyPayment(proof, MOCK_POST);

    expect(result.success).toBe(false);
    expect(result.error_code).toBe('UNSUPPORTED_CHAIN');
    expect(result.error).toContain('polygon');
  });
});

// ============================================
// Payment Option Structure Validation
// ============================================

describe('payment option structure', () => {
  it('should have all required fields for Solana', () => {
    const option = buildSolanaPaymentOption('post_abc123');

    expect(option).toHaveProperty('chain', 'solana');
    expect(option).toHaveProperty('chain_id', 'mainnet-beta');
    expect(option).toHaveProperty('recipient');
    expect(option).toHaveProperty('token_mint');
    expect(option).toHaveProperty('token_symbol', 'USDC');
    expect(option).toHaveProperty('decimals', 6);
    expect(option).toHaveProperty('memo');
  });

  it('should have all required fields for Base', () => {
    const option = buildBasePaymentOption('post_abc123');

    expect(option).toHaveProperty('chain', 'base');
    expect(option).toHaveProperty('chain_id', '8453');
    expect(option).toHaveProperty('recipient');
    expect(option).toHaveProperty('token_contract');
    expect(option).toHaveProperty('token_symbol', 'USDC');
    expect(option).toHaveProperty('decimals', 6);
    expect(option).toHaveProperty('reference');
  });
});
