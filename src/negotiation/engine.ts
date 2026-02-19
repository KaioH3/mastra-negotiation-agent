import { PRODUCTS, SUPPLIERS, type Product, type SupplierProfile } from '../data/products.js';
import { brandAgent } from '../agents/brandAgent.js';
import { createSupplierAgent } from '../agents/supplierAgent.js';

// ─── Types ───────────────────────────────────────────────────────────────────

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
  reflection: string;
  scores: Record<string, NegotiationScore>;
  winner: string;
  reasoning: string;
}

export type NegotiationEvent =
  | { type: 'rfq_ready'; rfq: NegotiationResult['rfq'] }
  | { type: 'message'; supplierId: string; message: NegotiationMessage }
  | { type: 'quote_parsed'; supplierId: string; quote: ParsedQuote }
  | { type: 'reflection'; content: string }
  | { type: 'scores'; scores: Record<string, NegotiationScore> }
  | { type: 'decision'; winner: string; reasoning: string }
  | { type: 'done' }
  | { type: 'error'; error: string };

// ─── Parsing ─────────────────────────────────────────────────────────────────

function parseQuote(text: string): ParsedQuote | null {
  const block = text.match(/===QUOTE===([\s\S]*?)===END_QUOTE===/);
  if (!block) return null;

  const raw = block[1];
  const unitPrices: Record<string, number> = {};

  for (const m of raw.matchAll(/([A-Z]{3}\d{3}):\s*\$([0-9.]+)/g)) {
    unitPrices[m[1]] = parseFloat(m[2]);
  }

  const leadMatch   = raw.match(/LEAD_TIME:\s*(\d+)/);
  const paymentMatch = raw.match(/PAYMENT:\s*([^\n]+)/);
  const totalMatch  = raw.match(/TOTAL_VALUE:\s*\$([0-9,]+)/);

  if (Object.keys(unitPrices).length === 0) return null;

  return {
    unitPrices,
    leadTimeDays: leadMatch ? parseInt(leadMatch[1]) : 30,
    paymentTerms: paymentMatch ? paymentMatch[1].trim() : '',
    totalValue: totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) : 0,
  };
}

// ─── Message builders ────────────────────────────────────────────────────────

function buildBOM(products: Product[]): string {
  return products.map(p => {
    const materials = p.components
      .filter(c => c.type === 'material')
      .map(c => `      · ${c.name}${c.composition ? ` (${c.composition})` : ''}`)
      .join('\n');
    const components = p.components
      .filter(c => c.type !== 'material')
      .map(c => `      · ${c.name}`)
      .join('\n');
    return `  ${p.name} (${p.code}) — Target FOB $${p.targetFob.toFixed(2)}/unit
    Materials:\n${materials}
    Components/Trims:\n${components}`;
  }).join('\n\n');
}

function buildRFQ(
  rfq: NegotiationResult['rfq'],
  products: Product[],
  supplierName: string
): string {
  const qtyLines = rfq.products
    .map(p => `  • ${p.name} (${p.code}): ${p.quantity.toLocaleString()} units`)
    .join('\n');

  const estimatedStr = rfq.estimatedValue.toLocaleString('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  });

  const bom = buildBOM(products);

  return `Dear ${supplierName} team,

We are requesting a formal quotation for the following footwear products:

QUANTITIES REQUIRED:
${qtyLines}

Total estimated value at target FOB: ${estimatedStr}
${rfq.note ? `\nSourcing note: ${rfq.note}\n` : ''}
BILL OF MATERIALS (per SKU):
${bom}

Please provide:
1. Unit pricing per SKU
2. Total order value
3. Lead time (calendar days from PO confirmation to ex-factory)
4. Payment terms
5. Any material substitution proposals — reference the exact component names above

We are evaluating multiple suppliers simultaneously.

Best regards,
Brand Sourcing Team`;
}

function buildDifferentiatedCounter(
  supplierName: string,
  supplierId: string,
  reflectionText: string
): string {
  // Extract the supplier-specific section from the reflection memo
  const supplierSectionMatch = reflectionText.match(
    new RegExp(`=== ${supplierName} ===[\\s\\S]*?(?===== |$)`)
  );
  const supplierInsight = supplierSectionMatch
    ? supplierSectionMatch[0].replace(`=== ${supplierName} ===`, '').trim()
    : '';

  return `Dear ${supplierName} team,

Thank you for your initial proposal. We have reviewed it alongside our other supplier evaluations.

${supplierInsight
  ? `Based on our analysis:\n${supplierInsight}\n\n`
  : ''}We need you to address the following for your final offer:

1. **Pricing** — Can you sharpen your unit costs? Even a 3–5% improvement would be decisive.
2. **Payment terms** — Any flexibility here to ease our cash flow?
3. **Lead time** — Please reconfirm your committed timeline.

This is your best and final offer opportunity. We are making our selection decision shortly.

Best regards,
Brand Sourcing Team`;
}

// ─── Round execution ─────────────────────────────────────────────────────────

interface Round1Result {
  profile: SupplierProfile;
  brandMsg: NegotiationMessage;
  supplierMsg: NegotiationMessage;
  quote: ParsedQuote | null;
}

async function executeRound1(
  profile: SupplierProfile,
  agent: ReturnType<typeof createSupplierAgent>,
  rfq: NegotiationResult['rfq'],
  products: Product[],
  emit: (e: NegotiationEvent) => void
): Promise<Round1Result> {
  const rfqText = buildRFQ(rfq, products, profile.name);

  const brandMsg: NegotiationMessage = {
    id: `${profile.id}-brand-r1-${Date.now()}`,
    from: 'brand',
    content: rfqText,
    round: 1,
    timestamp: new Date().toISOString(),
  };
  emit({ type: 'message', supplierId: profile.id, message: brandMsg });

  const res = await agent.generate(rfqText);

  const supplierMsg: NegotiationMessage = {
    id: `${profile.id}-supplier-r1-${Date.now()}`,
    from: 'supplier',
    content: res.text,
    round: 1,
    timestamp: new Date().toISOString(),
  };
  emit({ type: 'message', supplierId: profile.id, message: supplierMsg });

  return {
    profile,
    brandMsg,
    supplierMsg,
    quote: parseQuote(res.text),
  };
}

interface Round2Result {
  brandMsg: NegotiationMessage;
  supplierMsg: NegotiationMessage;
  quote: ParsedQuote | null;
}

async function executeRound2(
  round1: Round1Result,
  agent: ReturnType<typeof createSupplierAgent>,
  reflectionText: string,
  emit: (e: NegotiationEvent) => void
): Promise<Round2Result> {
  const counterText = buildDifferentiatedCounter(
    round1.profile.name,
    round1.profile.id,
    reflectionText
  );

  const brandMsg: NegotiationMessage = {
    id: `${round1.profile.id}-brand-r2-${Date.now()}`,
    from: 'brand',
    content: counterText,
    round: 2,
    timestamp: new Date().toISOString(),
  };
  emit({ type: 'message', supplierId: round1.profile.id, message: brandMsg });

  const res = await agent.generate([
    { role: 'user'      as const, content: round1.brandMsg.content },
    { role: 'assistant' as const, content: round1.supplierMsg.content },
    { role: 'user'      as const, content: counterText },
  ]);

  const supplierMsg: NegotiationMessage = {
    id: `${round1.profile.id}-supplier-r2-${Date.now()}`,
    from: 'supplier',
    content: res.text,
    round: 2,
    timestamp: new Date().toISOString(),
  };
  emit({ type: 'message', supplierId: round1.profile.id, message: supplierMsg });

  const quote = parseQuote(res.text);
  if (quote) {
    emit({ type: 'quote_parsed', supplierId: round1.profile.id, quote });
  }

  return { brandMsg, supplierMsg, quote };
}

// ─── Reflexion ───────────────────────────────────────────────────────────────

async function generateReflection(
  round1Results: Round1Result[],
  rfq: NegotiationResult['rfq'],
  emit: (e: NegotiationEvent) => void
): Promise<string> {
  const estimatedStr = rfq.estimatedValue.toLocaleString('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  });

  const supplierSummaries = round1Results.map(r => {
    const quoteBlock = r.quote
      ? `Total quoted: $${r.quote.totalValue.toLocaleString()}
  Lead time: ${r.quote.leadTimeDays} days
  Payment: ${r.quote.paymentTerms}
  Unit prices: ${Object.entries(r.quote.unitPrices).map(([k, v]) => `${k}=$${v}`).join(', ')}`
      : 'Quote format not parsed — see full response.';

    return `=== ${r.profile.name} ===
${r.supplierMsg.content.replace(/===QUOTE===[\s\S]*?===END_QUOTE===/g, '').trim()}

Extracted quote data:
${quoteBlock}`;
  }).join('\n\n');

  const prompt = `You are the brand sourcing manager. You have just received Round 1 proposals from three suppliers.

RFQ total estimated value at target FOB: ${estimatedStr}

${supplierSummaries}

---

Generate a STRATEGIC MEMO for Round 2. For each supplier, output in this exact structure:

=== [Supplier Name] ===
Round 1 summary: [1-2 sentences on their offer and key highlights]
Material alternatives offered: [specific component names they proposed to substitute, or "None proposed"]
Negotiation leverage: [what advantage you can use against them in round 2]
Round 2 strategy: [exactly what to push for — be specific, not generic]

Be analytical, reference actual numbers and component names from the proposals.`;

  const response = await brandAgent.generate(prompt);
  const reflectionText = response.text;

  emit({ type: 'reflection', content: reflectionText });
  return reflectionText;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

function scoreSuppliers(
  negotiations: Record<string, SupplierNegotiation>
): Record<string, NegotiationScore> {
  const entries = Object.values(negotiations);

  const totals  = entries.map(n => n.finalQuote?.totalValue ?? Infinity);
  const minTotal = Math.min(...totals);
  const maxTotal = Math.max(...totals);

  const leads   = entries.map(n => n.finalQuote?.leadTimeDays ?? 60);
  const minLead = Math.min(...leads);
  const maxLead = Math.max(...leads);

  const scores: Record<string, NegotiationScore> = {};

  for (const neg of entries) {
    const id    = neg.profile.id;
    const quote = neg.finalQuote;

    const totalValue = quote?.totalValue ?? Infinity;
    const priceScore = maxTotal === minTotal ? 8
      : 10 - ((totalValue - minTotal) / (maxTotal - minTotal)) * 6;

    const qualityScore = neg.profile.quality * 2;

    const leadDays = quote?.leadTimeDays ?? 60;
    const leadTimeScore = maxLead === minLead ? 8
      : 10 - ((leadDays - minLead) / (maxLead - minLead)) * 6;

    const paymentScore = id === 'supplier1' ? 9 : 6;

    const total =
      priceScore    * 0.35 +
      qualityScore  * 0.30 +
      leadTimeScore * 0.25 +
      paymentScore  * 0.10;

    scores[id] = {
      priceScore:    Math.round(priceScore    * 10) / 10,
      qualityScore:  Math.round(qualityScore  * 10) / 10,
      leadTimeScore: Math.round(leadTimeScore * 10) / 10,
      paymentScore:  Math.round(paymentScore  * 10) / 10,
      total:         Math.round(total         * 10) / 10,
    };
  }

  return scores;
}

async function buildReasoning(
  negotiations: Record<string, SupplierNegotiation>,
  scores: Record<string, NegotiationScore>,
  winner: string
): Promise<string> {
  const summaries = Object.values(negotiations).map(n => {
    const s = scores[n.profile.id];
    const q = n.finalQuote;
    const total = q?.totalValue
      ? `$${q.totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
      : 'N/A';
    return `${n.profile.name}: Quality ${n.profile.quality}/5.0 | Lead time ${q?.leadTimeDays ?? '?'} days | Total ${total}
  Scores → Price: ${s.priceScore} | Quality: ${s.qualityScore} | Lead time: ${s.leadTimeScore} | Payment: ${s.paymentScore} | Overall: ${s.total}/10`;
  }).join('\n\n');

  const winnerName = negotiations[winner].profile.name;

  const prompt = `You are the sourcing manager writing the final supplier selection report.

${summaries}

SELECTED SUPPLIER: ${winnerName} — Overall score: ${scores[winner].total}/10

Write a concise 3-paragraph rationale:
Paragraph 1: Why ${winnerName} was selected — their strongest differentiator.
Paragraph 2: Trade-offs acknowledged vs the other suppliers.
Paragraph 3: Recommended next steps for the partnership.

Be direct. Reference actual scores and numbers.`;

  const response = await brandAgent.generate(prompt);
  return response.text;
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

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

  // Create all supplier agents once
  const supplierAgents = SUPPLIERS.map(s => ({
    profile: s,
    agent: createSupplierAgent(s),
  }));

  // ── Round 1: all suppliers in parallel ────────────────────────────────────
  const round1Results = await Promise.all(
    supplierAgents.map(({ profile, agent }) =>
      executeRound1(profile, agent, rfq, products, emit)
    )
  );

  // ── Reflexion: brand reviews all round-1 responses, plans round-2 ─────────
  const reflectionText = await generateReflection(round1Results, rfq, emit);

  // ── Round 2: differentiated counters per supplier, in parallel ────────────
  const round2Results = await Promise.all(
    round1Results.map((r1, i) =>
      executeRound2(r1, supplierAgents[i].agent, reflectionText, emit)
    )
  );

  // Assemble final negotiations with all 4 messages per supplier
  const finalNegotiations: Record<string, SupplierNegotiation> = {};
  round1Results.forEach((r1, i) => {
    const r2 = round2Results[i];
    finalNegotiations[r1.profile.id] = {
      profile: r1.profile,
      messages: [r1.brandMsg, r1.supplierMsg, r2.brandMsg, r2.supplierMsg],
      finalQuote: r2.quote ?? r1.quote,
    };
  });

  // ── Scoring & decision ────────────────────────────────────────────────────
  const scores = scoreSuppliers(finalNegotiations);
  emit({ type: 'scores', scores });

  const winner = Object.entries(scores)
    .sort(([, a], [, b]) => b.total - a.total)[0][0];

  const reasoning = await buildReasoning(finalNegotiations, scores, winner);
  emit({ type: 'decision', winner, reasoning });
  emit({ type: 'done' });

  return { rfq, suppliers: finalNegotiations, reflection: reflectionText, scores, winner, reasoning };
}
