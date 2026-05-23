-- Add unique constraint on external_tx_id to prevent duplicate pending transactions
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_tx_external_id 
  ON wallet_transactions(external_tx_id) 
  WHERE external_tx_id IS NOT NULL;
