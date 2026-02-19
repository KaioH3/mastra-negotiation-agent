import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runNegotiation } from './negotiation/engine.js';
import { PRODUCTS } from './data/products.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use(express.static(join(__dirname, '../public')));

app.get('/api/products', (_req, res) => {
  res.json(PRODUCTS);
});

// SSE endpoint — streams negotiation events in real-time
app.get('/api/negotiate/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if ('flush' in res) (res as any).flush();
  };

  let quantities: Record<string, number> = {};
  let note = '';

  try {
    if (req.query.quantities) {
      quantities = JSON.parse(req.query.quantities as string);
    }
    if (req.query.note) {
      note = req.query.note as string;
    }
  } catch {
    // use defaults
  }

  try {
    await runNegotiation(quantities, note, send);
  } catch (err) {
    send({ type: 'error', error: String(err) });
  }

  res.end();
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`\nSupplier Negotiation Agent running at http://localhost:${PORT}\n`);
});
