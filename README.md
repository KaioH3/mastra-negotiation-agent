# Supplier Negotiation Agent

Multi-agent procurement negotiation system built with [Mastra.ai](https://mastra.ai).

A brand agent simultaneously negotiates with three supplier agents to source footwear products, selecting the best deal across quality, cost, lead time, and payment terms.

## Architecture

```
User → Brand Agent ──┬─→ EastCraft Manufacturing Agent   (budget, flexible payment)
                     ├─→ PremiumStep Industries Agent    (premium quality)
                     └─→ SwiftMake Footwear Co. Agent   (fastest lead time)
                              ↓ (2-round negotiation each)
                         Scoring Matrix → Winner + Reasoning
```

**Agents:**
- **Brand Agent** — Knows internal quality ratings (confidential). Sends structured RFQs, counter-negotiates, and makes the final supplier selection.
- **Supplier Agent × 3** — Each has a distinct persona and negotiation strategy. Suppliers can suggest material substitutions to reduce cost or justify their premium.

**Negotiation flow:**
1. Brand sends RFQ with quantities and target FOB prices
2. Each supplier responds with an initial quote (round 1)
3. Brand pushes back asking for best final offer (round 2)
4. System scores all final quotes and selects the winner

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
- **Groq API** (Llama 3.3 70B) — LLM inference
- **Express** — HTTP server + SSE streaming
- **Vanilla JS** — Frontend (zero build step)
- **TypeScript** — End-to-end type safety

## Running Locally

```bash
git clone https://github.com/YOUR_USERNAME/supplier-negotiation-agent
cd supplier-negotiation-agent

npm install

cp .env.example .env
# Add your GROQ_API_KEY to .env

npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Design Decisions

**Why run all 3 negotiations in parallel?**
`Promise.all` starts all three simultaneously — realistic, and faster.

**Why 2 rounds?**
One round is too easy to game. Two rounds surface each supplier's real floor price and push them to show their best offer.

**Why stream with SSE?**
The UI updates in real-time as each message arrives, so you can watch the negotiation unfold — not just see a final result.

**Why parse quote data from LLM responses?**
Suppliers include a structured `===QUOTE===` block in their responses. This is extracted and displayed separately from the negotiation dialogue, making data reliable without forcing pure JSON output (which LLMs occasionally malformat).
