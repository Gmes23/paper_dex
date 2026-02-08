-- Database schema for persisted websocket data

CREATE TABLE IF NOT EXISTS trades (
  trade_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  side CHAR(1) NOT NULL CHECK (side IN ('B', 'A')),
  price NUMERIC NOT NULL,
  size NUMERIC NOT NULL,
  time_ms BIGINT NOT NULL,
  source TEXT NOT NULL,
  PRIMARY KEY (symbol, trade_id)
);

CREATE INDEX IF NOT EXISTS trades_symbol_time_idx
  ON trades (symbol, time_ms DESC);

CREATE INDEX IF NOT EXISTS trades_time_idx
  ON trades (time_ms DESC);

CREATE TABLE IF NOT EXISTS orderbook_snapshots (
  symbol TEXT NOT NULL,
  time_ms BIGINT NOT NULL,
  bids JSONB NOT NULL,
  asks JSONB NOT NULL,
  source TEXT NOT NULL,
  PRIMARY KEY (symbol, source)
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL UNIQUE,
  mock_usdc_balance NUMERIC(20,6) NOT NULL DEFAULT 100000.000000,
  locked_margin NUMERIC(20,6) NOT NULL DEFAULT 0.000000,
  available_balance NUMERIC(20,6) NOT NULL DEFAULT 100000.000000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS positions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol VARCHAR(10) NOT NULL,
  side VARCHAR(5) NOT NULL CHECK (side IN ('long', 'short')),
  entry_price NUMERIC(20,8) NOT NULL,
  position_size NUMERIC(20,6) NOT NULL,
  margin NUMERIC(20,6) NOT NULL,
  leverage INTEGER NOT NULL CHECK (leverage >= 1 AND leverage <= 10),
  liquidation_price NUMERIC(20,8) NOT NULL,
  unrealized_pnl NUMERIC(20,6) NOT NULL DEFAULT 0.000000,
  opened_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS paper_trades (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol VARCHAR(10) NOT NULL,
  side VARCHAR(5) NOT NULL CHECK (side IN ('long', 'short')),
  entry_price NUMERIC(20,8) NOT NULL,
  exit_price NUMERIC(20,8) NOT NULL,
  position_size NUMERIC(20,6) NOT NULL,
  margin NUMERIC(20,6) NOT NULL,
  leverage INTEGER NOT NULL CHECK (leverage >= 1 AND leverage <= 10),
  realized_pnl NUMERIC(20,6) NOT NULL,
  status VARCHAR(10) NOT NULL CHECK (status IN ('closed', 'liquidated')),
  opened_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS balance_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  change_type VARCHAR(20) NOT NULL CHECK (
    change_type IN ('trade_profit', 'trade_loss', 'liquidation', 'position_opened', 'position_closed')
  ),
  amount NUMERIC(20,6) NOT NULL,
  balance_after NUMERIC(20,6) NOT NULL,
  trade_id INTEGER REFERENCES paper_trades(id) ON DELETE SET NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS candles (
  symbol VARCHAR(10) NOT NULL,
  interval VARCHAR(5) NOT NULL,
  time BIGINT NOT NULL,
  open NUMERIC(20,8) NOT NULL,
  high NUMERIC(20,8) NOT NULL,
  low NUMERIC(20,8) NOT NULL,
  close NUMERIC(20,8) NOT NULL,
  volume NUMERIC(20,8) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (symbol, interval, time)
);

CREATE INDEX IF NOT EXISTS idx_candles_time
  ON candles (time DESC);

CREATE INDEX IF NOT EXISTS idx_candles_symbol_time
  ON candles (symbol, time DESC);
