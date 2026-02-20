# Supplier Negotiation Agent

Multi-agent procurement negotiation system built with [Mastra.ai](https://mastra.ai).

A brand agent simultaneously negotiates with three supplier agents to source footwear products, selecting the best deal across quality, cost, lead time, and payment terms.

## Architecture

```
User → Brand Agent ──┬─→ EastCraft Manufacturing Agent   (budget, flexible payment)
                     ├─→ PremiumStep Industries Agent    (premium quality)
                     └─→ SwiftMake Footwear Co. Agent   (fastest lead time)
                              ↓ Round 1 (sequential)
                         Brand Agent (Reflexion — reviews all R1, plans differentiated R2)
                              ↓ Round 2 (sequential, tailored per supplier)
                         Scoring Matrix
                              ↓
                         Critic Agent (independent audit: APPROVED / FLAGGED)
                              ↓
                         Winner + Reasoning
```

**Agents:**
- **Brand Agent** — Sends structured RFQs with full BOM, runs Reflexion after Round 1, sends differentiated counter-offers, writes final reasoning.
- **Supplier Agent × 3** — Each has a distinct persona and negotiation strategy. Can suggest material substitutions to reduce cost or justify their premium. Outputs a structured `===QUOTE===` block for reliable data extraction.
- **Critic Agent** — Independent procurement auditor. Reviews the scoring math, priority alignment, and risk flags. Issues APPROVED or FLAGGED verdict with confidence %.

**Negotiation flow:**
1. Brand sends RFQ with quantities, target FOB prices, and full Bill of Materials
2. Each supplier responds with an initial quote (Round 1) — runs in parallel
3. **Reflexion**: Brand agent reviews all Round 1 responses, generates a per-supplier strategy memo
4. Brand sends differentiated counter-offers based on each supplier's leverage (Round 2)
5. System scores all final quotes across 4 weighted criteria
6. Critic agent audits the decision for errors and risks
7. Final winner selected with full reasoning

## Scoring Matrix

| Criterion     | Weight |
|---------------|--------|
| Price         | 35%    |
| Quality       | 30%    |
| Lead Time     | 25%    |
| Payment Terms | 10%    |

## Suppliers

| Supplier                  | Quality | Pricing   | Lead Time  | Payment        |
|---------------------------|---------|-----------|------------|----------------|
| EastCraft Manufacturing   | 4.0/5   | ~12% below FOB | 45–55 days | 33/33/33  |
| PremiumStep Industries    | 4.7/5   | ~30% above FOB | 25–32 days | 30/70     |
| SwiftMake Footwear Co.    | 4.0/5   | ~21% above FOB | 14–20 days | 30/70     |

## Tech Stack

- **[Mastra.ai](https://mastra.ai)** — Agent framework and orchestration
- **Express** — HTTP server + SSE streaming
- **Vanilla JS** — Frontend (zero build step)
- **TypeScript** — End-to-end type safety

**LLM (auto-selected by available key):**

| Priority | Env var | Model |
|----------|---------|-------|
| 1st | `ANTHROPIC_API_KEY` | claude-haiku-4-5 |
| 2nd | `GROQ_API_KEY` | llama-3.3-70b-versatile |
| 3rd | `OPENAI_API_KEY` | gpt-4o-mini |

## Running Locally

```bash
git clone https://github.com/KaioH3/mastra-negotiation-agent
cd mastra-negotiation-agent

npm install

cp .env.example .env
# Add ANTHROPIC_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY

npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

> **Groq free tier note:** Each round runs suppliers sequentially, but the pipeline still makes ~6 LLM calls total. On the 12K TPM free tier you may hit rate limits on longer runs. Use Anthropic or OpenAI keys for a smooth experience, or upgrade to Groq Dev Tier.

## Design Decisions

**Why run supplier negotiations sequentially?**
Each supplier call is awaited before the next starts. This respects API rate limits (especially on free tiers) and makes the SSE stream easier to follow — messages appear one supplier at a time rather than interleaved.

**Why 2 rounds?**
One round is too easy to game. Two rounds surface each supplier's real floor price and push them to show their best offer.

**Why stream with SSE?**
The UI updates in real-time as each message arrives, so you can watch the negotiation unfold — not just see a final result.

**Why parse quote data from LLM responses?**
Suppliers include a structured `===QUOTE===` block in their responses. This is extracted and displayed separately from the negotiation dialogue, making data reliable without forcing pure JSON output (which LLMs occasionally malformat).
