import { Client } from 'pg';

type CandleData = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'gm',
    database: 'fakeprices'
  });
  

async function seedBTC() {
  await client.connect();

  const candles: CandleData[] = [];

  const startTime = Math.floor(Date.now() / 1000) - 60 * 60; // 1h ago
  const interval = 60; // 1-minute candles

  let last: CandleData = {
    time: startTime,
    open: 43000,
    high: 43100,
    low: 42900,
    close: 43050,
    volume: 25
  };

  for (let i = 1; i <= 60; i++) {
    const nextTime = startTime + i * interval;
    last = generateNextCandle(last, nextTime);
    candles.push(last);
  }

  const query = `
    INSERT INTO btc_candles (time, open, high, low, close, volume)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (time) DO NOTHING;
  `;

  for (const c of candles) {
    await client.query(query, [
      c.time,
      c.open,
      c.high,
      c.low,
      c.close,
      c.volume
    ]);
  }

  console.log(`Seeded ${candles.length} BTC candles`);
  await client.end();
}

seedBTC().catch(console.error);

// --- generator ---
function generateNextCandle(
  prev: CandleData,
  time: number
): CandleData {
  const volatility = 0.003;

  const open = prev.close;
  const delta = open * (Math.random() - 0.5) * volatility;
  const close = Math.max(1, open + delta);

  const high = Math.max(open, close) * (1 + Math.random() * 0.002);
  const low = Math.min(open, close) * (1 - Math.random() * 0.002);

  return {
    time,
    open,
    high,
    low,
    close,
    volume: 10 + Math.random() * 50
  };
}
