/**
 * POST /api/v1/agents/withdraw
 *
 * Withdraw USDC from agent's AgentKit wallet to an external address.
 * Base transactions are gas-free via CDP Smart Wallet.
 * Solana transactions require small SOL balance (~$0.0001 per tx).
 *
 * Request Body:
 * {
 *   "chain": "base" | "solana",
 *   "destination_address": "0x..." | "ABC123...",
 *   "amount_usdc": "50.00"
 * }
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "transaction_id": "0xabc123...",
 *   "chain": "base",
 *   "amount": "50.00",
 *   "destination": "0x742d35Cc...",
 *   "status": "COMPLETED",
 *   "gasless": true,
 *   "message": "Withdrawal completed. Transaction was gas-free via CDP Smart Wallet."
 * }
 *
 * Errors:
 * - 400: Validation error / Insufficient balance / Not AgentKit wallet
 * - 401: Unauthorized
 * - 500: Internal server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth/middleware';
import {
  transferUSDC,
  getAgentUSDCBalance,
  getAgentWalletAddresses,
} from '@/lib/agentkit/wallet-service';
import { createErrorResponse, formatZodErrors, ErrorCodes } from '@/types/api';

const WithdrawSchema = z.object({
  chain: z.enum(['solana', 'base'], {
    errorMap: () => ({ message: 'chain must be "solana" or "base"' }),
  }),
  destination_address: z.string().min(1, 'destination_address is required'),
  amount_usdc: z
    .string()
    .regex(/^\d+(\.\d{1,6})?$/, 'amount_usdc must be a valid number with up to 6 decimal places'),
});

export async function POST(request: NextRequest) {
  return withAuth(request, async (req, agent) => {
    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.INVALID_REQUEST_BODY,
          'Request body must be valid JSON'
        ),
        { status: 400 }
      );
    }

    // Validate request
    const validation = WithdrawSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(formatZodErrors(validation.error), { status: 400 });
    }

    const { chain, destination_address, amount_usdc } = validation.data;

    // Validate destination address format based on chain
    if (chain === 'base') {
      if (!/^0x[a-fA-F0-9]{40}$/.test(destination_address)) {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.VALIDATION_ERROR,
            'destination_address must be a valid EVM address (0x...)'
          ),
          { status: 400 }
        );
      }
    } else if (chain === 'solana') {
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(destination_address)) {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.VALIDATION_ERROR,
            'destination_address must be a valid Solana address'
          ),
          { status: 400 }
        );
      }
    }

    try {
      // Check if agent has AgentKit wallets
      const addresses = await getAgentWalletAddresses(agent.id);

      if (addresses.provider !== 'agentkit') {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.FORBIDDEN,
            'Withdrawals are only available for AgentKit-managed wallets. Self-custodied wallets should be managed directly.'
          ),
          { status: 400 }
        );
      }

      // Check balance
      const balances = await getAgentUSDCBalance(agent.id);
      const currentBalance = parseFloat(chain === 'solana' ? balances.solana : balances.base);
      const withdrawAmount = parseFloat(amount_usdc);

      if (withdrawAmount <= 0) {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.VALIDATION_ERROR,
            'amount_usdc must be greater than 0'
          ),
          { status: 400 }
        );
      }

      if (withdrawAmount > currentBalance) {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.VALIDATION_ERROR,
            `Insufficient balance. Available: ${currentBalance.toFixed(6)} USDC on ${chain}`,
            undefined,
            { available_balance: currentBalance.toFixed(6), requested_amount: amount_usdc }
          ),
          { status: 400 }
        );
      }

      // Execute transfer
      const result = await transferUSDC(
        agent.id,
        chain,
        destination_address,
        amount_usdc
      );

      return NextResponse.json({
        success: true,
        transaction_id: result.transactionId,
        chain,
        amount: amount_usdc,
        destination: destination_address,
        status: result.status,
        gasless: result.gasless,
        message:
          chain === 'base'
            ? 'Withdrawal completed. Transaction was gas-free via CDP Smart Wallet.'
            : 'Withdrawal completed. Gas fee (~$0.0001) deducted from your SOL balance.',
      });
    } catch (error) {
      console.error('Withdrawal failed:', error);
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.INTERNAL_ERROR,
          `Withdrawal failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        ),
        { status: 500 }
      );
    }
  });
}
