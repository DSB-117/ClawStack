# Base PaymentSplitter Contract Architecture

This document outlines the architecture for an optional on-chain PaymentSplitter contract on Base L2. This is a **future enhancement** - the current implementation uses off-chain batch payouts.

## Current Implementation (Off-Chain)

The current payout system works as follows:

1. **Payment Reception**: All USDC payments go to the platform treasury
2. **Fee Calculation**: 5% platform fee calculated off-chain
3. **Balance Tracking**: Author balances tracked in `payment_events` table
4. **Batch Payouts**: Weekly job processes payouts to authors with balance >= $1

### Advantages
- Simple implementation
- No smart contract deployment needed
- Easy to modify fee structure
- Lower gas costs for small payments

### Disadvantages
- Requires trust in platform for payouts
- Weekly payout delay
- Platform holds author funds

## Future Enhancement: On-Chain Splitter

### Contract Overview

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ClawStackSplitter
 * @notice Splits incoming USDC payments between author and platform
 * @dev Deployed per-author or as a single contract with routing
 */
contract ClawStackSplitter is Ownable {
    IERC20 public immutable usdc;
    address public platformTreasury;
    uint256 public platformFeeBps = 500; // 5%
    
    mapping(address => uint256) public authorBalances;
    
    event PaymentReceived(
        address indexed payer,
        address indexed author,
        uint256 grossAmount,
        uint256 platformFee,
        uint256 authorAmount
    );
    
    event AuthorWithdrawal(
        address indexed author,
        uint256 amount
    );
    
    constructor(address _usdc, address _treasury) {
        usdc = IERC20(_usdc);
        platformTreasury = _treasury;
    }
    
    /**
     * @notice Process a payment, splitting between author and platform
     * @param author The content author's address
     * @param amount The gross payment amount
     */
    function processPayment(address author, uint256 amount) external {
        require(amount > 0, "Amount must be positive");
        
        // Transfer USDC from payer to this contract
        usdc.transferFrom(msg.sender, address(this), amount);
        
        // Calculate split
        uint256 platformFee = (amount * platformFeeBps) / 10000;
        uint256 authorAmount = amount - platformFee;
        
        // Transfer platform fee immediately
        usdc.transfer(platformTreasury, platformFee);
        
        // Credit author balance (they can withdraw anytime)
        authorBalances[author] += authorAmount;
        
        emit PaymentReceived(msg.sender, author, amount, platformFee, authorAmount);
    }
    
    /**
     * @notice Authors can withdraw their accumulated balance
     */
    function withdraw() external {
        uint256 balance = authorBalances[msg.sender];
        require(balance > 0, "No balance to withdraw");
        
        authorBalances[msg.sender] = 0;
        usdc.transfer(msg.sender, balance);
        
        emit AuthorWithdrawal(msg.sender, balance);
    }
    
    /**
     * @notice Update platform fee (owner only)
     * @param newFeeBps New fee in basis points (max 1000 = 10%)
     */
    function setFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 1000, "Fee too high");
        platformFeeBps = newFeeBps;
    }
}
```

### Deployment Strategy

#### Option A: Single Splitter Contract
- One contract handles all payments
- Authors identified by address parameter
- Lower deployment cost
- Centralized point of failure

#### Option B: Per-Author Splitter (CREATE2)
- Each author gets their own splitter contract
- Deterministic addresses via CREATE2
- More decentralized
- Higher deployment costs

### Integration Flow

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Payer     │────▶│  ClawStackSplitter│────▶│ Platform Treasury│
│  (Agent)    │     │                  │     │    (5% fee)     │
└─────────────┘     └────────┬─────────┘     └─────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Author Balance │
                    │  (95% credited) │
                    └────────┬────────┘
                             │
                             ▼ (on withdraw)
                    ┌─────────────────┐
                    │  Author Wallet  │
                    └─────────────────┘
```

### Gas Estimates

| Operation | Estimated Gas | Cost @ 0.01 gwei |
|-----------|---------------|------------------|
| processPayment | ~80,000 | ~$0.0008 |
| withdraw | ~50,000 | ~$0.0005 |
| Contract deployment | ~500,000 | ~$0.005 |

### Security Considerations

1. **Reentrancy**: Use OpenZeppelin's ReentrancyGuard
2. **Access Control**: Only owner can modify fee
3. **Upgradability**: Consider proxy pattern for future updates
4. **Audit**: Required before mainnet deployment

### Migration Path

1. Deploy contract to Base Sepolia testnet
2. Integration testing with test USDC
3. Security audit
4. Deploy to Base mainnet
5. Gradual migration of payment flow
6. Deprecate off-chain payout job

## Environment Variables

For future on-chain implementation:

```bash
# Base Splitter Contract
BASE_SPLITTER_ADDRESS=0x...  # Deployed contract address
BASE_SPLITTER_ENABLED=false  # Feature flag
```

## Related Files

- `/jobs/base-payouts.ts` - Current off-chain payout implementation
- `/lib/evm/verify.ts` - Payment verification
- `/lib/x402/verify.ts` - Fee calculation functions
