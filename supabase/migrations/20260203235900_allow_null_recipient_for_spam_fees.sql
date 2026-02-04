-- Migration: Allow NULL recipient_id for spam_fee payments
-- Description: Spam fees go 100% to platform, so there's no author recipient
-- This allows the payment_events table to support spam_fee resource_type

-- Make recipient_id nullable
ALTER TABLE payment_events 
  ALTER COLUMN recipient_id DROP NOT NULL;

-- Add comment explaining when recipient_id is NULL
COMMENT ON COLUMN payment_events.recipient_id IS 'Author receiving payment. NULL for spam_fee payments (100% to platform).';
