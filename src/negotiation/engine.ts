import { PRODUCTS, SUPPLIERS, type SupplierProfile } from '../data/products.js';
import { brandAgent } from '../agents/brandAgent.js';
import { createSupplierAgent } from '../agents/supplierAgent.js';

export interface NegotiationMessage {
  id: string;
  from: 'brand' | 'supplier';
  content: string;
  round: number;
  timestamp: string;
}

export interface ParsedQuote {
  unitPrices: Record<string, number>;
  leadTimeDays: number;
  paymentTerms: string;
  totalValue: number;
}

export interface SupplierNegotiation {
  profile: SupplierProfile;
  messages: NegotiationMessage[];
  finalQuote: ParsedQuote | null;
}

export interface NegotiationScore {
  priceScore: number;
  qualityScore: number;
  leadTimeScore: number;
  paymentScore: number;
  total: number;
}

export interface NegotiationResult {
  rfq: {
    products: Array<{ code: string; name: string; quantity: number; targetFob: number }>;
    note: string;
    estimatedValue: number;
  };
  suppliers: Record<string, SupplierNegotiation>;
  scores: Record<string, NegotiationScore>;
  winner: string;
  reasoning: string;
}

export type NegotiationEvent =
  | { type: 'rfq_ready'; rfq: NegotiationResult['rfq'] }
  | { type: 'message'; supplierId: string; message: NegotiationMessage }
  | { type: 'quote_parsed'; supplierId: string; quote: ParsedQuote }
  | { type: 'scores'; scores: Record<string, NegotiationScore> }
  | { type: 'decision'; winner: string; reasoning: string }
  | { type: 'done' }
  | { type: 'error'; error: string };

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseQuote(text: string): ParsedQuote | null {
  const block = text.match(/===QUOTE===([\s\S]*?)===END_QUOTE===/);
  if (!block) return null;

  const raw = block[1];
  const unitPrices: Record<string, number> = {};

  for (const m of raw.matchAll(/([A-Z]{3}\d{3}):\s*\$([0-9.]+)/g)) {
    unitPrices[m[1]] = parseFloat(m[2]);
  }

  const leadMatch = raw.match(/LEAD_TIME:\s*(\d+)/);
  const paymentMatch = raw.match(/PAYMENT:\s*([^\n]+)/);
  const totalMatch = raw.match(/TOTAL_VALUE:\s*\$([0-9,]+)/);

  if (Object.keys(unitPrices).length === 0) return null;

  return {
    unitPrices,
    leadTimeDays: leadMatch ? parseInt(leadMatch[1]) : 30,
    paymentTerms: paymentMatch ? paymentMatch[1].trim() : '',
    totalValue: totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) : 0,
  };
}

function buildRFQ(
  rfq: NegotiationResult['rfq'],
  supplierName: string
): string {
  const lines = rfq.products
    .map(p => `  • ${p.name} (${p.code}): ${p.quantity.toLocaleString()} units — Target FOB $${p.targetFob.toFixed(2)}/unit`)
    .join('\n');

  const estimatedStr = rfq.estimatedValue.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

  return `Dear ${supplierName} team,

We are requesting a formal quotation for the following footwear products:

${lines}

Total estimated value at target FOB: ${estimatedStr}
${rfq.note ? `\nSourcing note: ${rfq.note}\n` : ''}
Please provide:
1. Unit pricing per SKU
2. Total order value
3. Lead time (days from PO confirmation to ex-factory)
4. Payment terms
5. Any material alternative suggestions that could reduce cost while maintaining quality standards

We are evaluating multiple suppliers simultaneously. Your best offer from the start will be appreciated.

Best regards,
Brand Sourcing Team`;
}

function buildCounter(supplierResponse: string, supplierName: string): string {
  return `Thank you for your proposal, ${supplierName}.

We have reviewed your quote carefully. To remain competitive in our evaluation, we need you to address the following:

1. **Pricing** — We are receiving quotes close to our target FOB from other suppliers. Can you sharpen your unit costs? Even a 3–5% improvement would significantly influence our decision.

2. **Lead time** — Please confirm your commitment to the timeline stated, or advise if you can improve it.

3. **Payment terms** — Is there any flexibility here to improve cash flow on our end?

Please provide your best and final offer. We are making our supplier selection shortly.

Best regards,
Brand Sourcing Team`;
}

function scoreSuppliers(
  negotiations: Record<string, SupplierNegotiation>
): Record<string, NegotiationScore> {
  const entries = Object.values(negotiations);

  const totals = entries.map(n => n.finalQuote?.totalValue ?? Infinity);
  const minTotal = Math.min(...totals);
  const maxTotal = Math.max(...totals);

  const leads = entries.map(n => n.finalQuote?.leadTimeDays ?? 60);
  const minLead = Math.min(...leads);
  const maxLead = Math.max(...leads);

  const scores: Record<string, NegotiationScore> = {};

  for (const neg of entries) {
    const id = neg.profile.id;
    const quote = neg.finalQuote;

    const totalValue = quote?.totalValue ?? Infinity;
    const priceScore =
      maxTotal === minTotal
        ? 8
        : 10 - ((totalValue - minTotal) / (maxTotal - minTotal)) * 6;

    const qualityScore = neg.profile.quality * 2;

    const leadDays = quote?.leadTimeDays ?? 60;
    const leadTimeScore =
      maxLead === minLead
        ? 8
        : 10 - ((leadDays - minLead) / (maxLead - minLead)) * 6;

    // 33/33/33 structure scores higher for cash flow
    const paymentScore = id === 'supplier1' ? 9 : 6;

    const total =
      priceScore * 0.35 +
      qualityScore * 0.30 +
      leadTimeScore * 0.25 +
      paymentScore * 0.10;

    scores[id] = {
      priceScore: Math.round(priceScore * 10) / 10,
      qualityScore: Math.round(qualityScore * 10) / 10,
      leadTimeScore: Math.round(leadTimeScore * 10) / 10,
      paymentScore: Math.round(paymentScore * 10) / 10,
      total: Math.round(total * 10) / 10,
    };
  }

  return scores;
}

async function buildReasoning(
  negotiations: Record<string, SupplierNegotiation>,
  scores: Record<string, NegotiationScore>,
  winner: string
): Promise<string> {
  const summaries = Object.values(negotiations)
    .map(n => {
      const s = scores[n.profile.id];
      const q = n.finalQuote;
      const total = q?.totalValue
        ? `$${q.totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
        : 'N/A';
      return `${n.profile.name} (${n.profile.id}):
  Quality: ${n.profile.quality}/5.0 | Lead time: ${q?.leadTimeDays ?? '?'} days | Total: ${total}
  Scores → Price: ${s.priceScore} | Quality: ${s.qualityScore} | Lead time: ${s.leadTimeScore} | Payment: ${s.paymentScore} | Overall: ${s.total}/10`;
    })
    .join('\n\n');

  const winnerName = negotiations[winner].profile.name;

  const prompt = `You are the sourcing manager writing the final supplier selection report.

Negotiation summary:
${summaries}

SELECTED SUPPLIER: ${winnerName} — Overall score: ${scores[winner].total}/10

Write a concise 3-paragraph decision rationale:
Paragraph 1: Why ${winnerName} was selected (their strongest advantage).
Paragraph 2: Trade-offs acknowledged (what we're giving up vs other suppliers).
Paragraph 3: Recommended next steps for the partnership.

Be direct, analytical, and specific. Reference actual scores and numbers.`;

  const response = await brandAgent.generate(prompt);
  return response.text;
}

// ─── Core negotiation per supplier ──────────────────────────────────────────

async function negotiateWithSupplier(
  profile: SupplierProfile,
  rfq: NegotiationResult['rfq'],
  emit: (e: NegotiationEvent) => void
): Promise<SupplierNegotiation> {
  const agent = createSupplierAgent(profile);
  const messages: NegotiationMessage[] = [];

  const addMsg = (from: 'brand' | 'supplier', content: string, round: number) => {
    const msg: NegotiationMessage = {
      id: `${profile.id}-${from}-r${round}-${Date.now()}`,
      from,
      content,
      round,
      timestamp: new Date().toISOString(),
    };
    messages.push(msg);
    emit({ type: 'message', supplierId: profile.id, message: msg });
    return msg;
  };

  // Round 1
  const rfqText = buildRFQ(rfq, profile.name);
  addMsg('brand', rfqText, 1);

  const res1 = await agent.generate(rfqText);
  addMsg('supplier', res1.text, 1);
  const quote1 = parseQuote(res1.text);

  // Round 2
  const counterText = buildCounter(res1.text, profile.name);
  addMsg('brand', counterText, 2);

  const res2 = await agent.generate([
    { role: 'user' as const, content: rfqText },
    { role: 'assistant' as const, content: res1.text },
    { role: 'user' as const, content: counterText },
  ]);
  addMsg('supplier', res2.text, 2);
  const quote2 = parseQuote(res2.text);

  const finalQuote = quote2 ?? quote1;
  if (finalQuote) {
    emit({ type: 'quote_parsed', supplierId: profile.id, quote: finalQuote });
  }

  return { profile, messages, finalQuote };
}

// ─── Main entry ─────────────────────────────────────────────────────────────

export async function runNegotiation(
  quantities: Record<string, number>,
  note: string,
  emit: (e: NegotiationEvent) => void
): Promise<NegotiationResult> {
  const products = PRODUCTS.map(p => ({
    ...p,
    quantity: quantities[p.code] ?? p.defaultQuantity,
  }));

  const estimatedValue = products.reduce((sum, p) => sum + p.targetFob * p.quantity, 0);
  const rfq = { products, note, estimatedValue };
  emit({ type: 'rfq_ready', rfq });

  // All 3 supplier negotiations run in parallel
  const results = await Promise.all(
    SUPPLIERS.map(s => negotiateWithSupplier(s, rfq, emit))
  );

  const suppliers: Record<string, SupplierNegotiation> = {};
  results.forEach(r => { suppliers[r.profile.id] = r; });

  const scores = scoreSuppliers(suppliers);
  emit({ type: 'scores', scores });

  const winner = Object.entries(scores).sort(([, a], [, b]) => b.total - a.total)[0][0];
  const reasoning = await buildReasoning(suppliers, scores, winner);

  emit({ type: 'decision', winner, reasoning });
  emit({ type: 'done' });

  return { rfq, suppliers, scores, winner, reasoning };
}
