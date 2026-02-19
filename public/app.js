/* ── State ── */
const state = {
  products: [],
  quantities: {},
  suppliers: {
    supplier1: { name: 'EastCraft Manufacturing',  quality: 4.0 },
    supplier2: { name: 'PremiumStep Industries',   quality: 4.7 },
    supplier3: { name: 'SwiftMake Footwear Co.',   quality: 4.0 },
  },
  quotes: {},
  running: false,
};

/* ── Boot ── */
async function boot() {
  try {
    const res = await fetch('/api/products');
    state.products = await res.json();
    renderProductGrid();
    renderSupplierCards();
  } catch (err) {
    console.error('Failed to load products:', err);
  }
}

function renderProductGrid() {
  const grid = document.getElementById('products-grid');
  grid.innerHTML = '';

  state.products.forEach(p => {
    state.quantities[p.code] = p.defaultQuantity;

    const row = document.createElement('div');
    row.className = 'product-row';
    row.innerHTML = `
      <div class="info">
        <div class="name">${p.name}</div>
        <div class="fob">${p.code} · Target FOB $${p.targetFob.toFixed(2)}</div>
      </div>
      <input type="number" min="1" value="${p.defaultQuantity}"
        onchange="state.quantities['${p.code}'] = parseInt(this.value) || ${p.defaultQuantity}" />
    `;
    grid.appendChild(row);
  });
}

function renderSupplierCards() {
  const grid = document.getElementById('negotiations-grid');
  grid.innerHTML = '';

  Object.entries(state.suppliers).forEach(([id, s]) => {
    const card = document.createElement('div');
    card.className = 'supplier-card';
    card.id = `card-${id}`;
    card.innerHTML = `
      <div class="supplier-header">
        <div>
          <div class="name">${s.name}</div>
          <div class="quality">Quality ${s.quality.toFixed(1)}/5.0</div>
        </div>
        <span class="tag" id="tag-${id}"></span>
      </div>
      <div class="chat-area" id="chat-${id}">
        <div class="empty-state">Waiting for negotiation to start…</div>
      </div>
      <div id="quote-${id}"></div>
    `;
    grid.appendChild(card);
  });
}

/* ── Negotiation ── */
async function startNegotiation() {
  if (state.running) return;
  state.running = true;

  document.getElementById('start-btn').disabled = true;
  document.getElementById('reflection-card').style.display = 'none';
  document.getElementById('scores-card').style.display = 'none';
  document.getElementById('decision-card').style.display = 'none';
  state.quotes = {};

  Object.keys(state.suppliers).forEach(id => {
    document.getElementById(`chat-${id}`).innerHTML =
      '<div class="empty-state">Waiting…</div>';
    document.getElementById(`quote-${id}`).innerHTML = '';
    document.getElementById(`tag-${id}`).textContent = '';
    document.getElementById(`card-${id}`).classList.remove('winner');
  });

  setStatus('Sending RFQ to all suppliers…', true);

  const params = new URLSearchParams({
    quantities: JSON.stringify(state.quantities),
    note: document.getElementById('note').value,
  });

  const evtSource = new EventSource(`/api/negotiate/stream?${params}`);

  evtSource.onmessage = e => {
    const event = JSON.parse(e.data);
    handleEvent(event);
    if (event.type === 'done' || event.type === 'error') {
      evtSource.close();
      state.running = false;
      document.getElementById('start-btn').disabled = false;
      if (event.type === 'done') setStatus('Negotiation complete.', false);
      else setStatus(`Error: ${event.error}`, false);
    }
  };

  evtSource.onerror = () => {
    evtSource.close();
    state.running = false;
    document.getElementById('start-btn').disabled = false;
    setStatus('Connection lost.', false);
  };
}

function handleEvent(event) {
  switch (event.type) {
    case 'rfq_ready':
      setStatus('RFQ sent — Round 1 negotiations in progress…', true);
      Object.keys(state.suppliers).forEach(id => setTag(id, 'running', 'Round 1'));
      break;

    case 'message':
      appendMessage(event.supplierId, event.message);
      break;

    case 'quote_parsed':
      state.quotes[event.supplierId] = event.quote;
      renderQuote(event.supplierId, event.quote);
      setTag(event.supplierId, 'done', 'Done');
      break;

    case 'reflection':
      renderReflection(event.content);
      setStatus('Round 2 — sending differentiated counter-offers…', true);
      Object.keys(state.suppliers).forEach(id => setTag(id, 'running', 'Round 2'));
      break;

    case 'scores':
      renderScores(event.scores);
      break;

    case 'decision':
      renderDecision(event.winner, event.reasoning);
      break;

    case 'error':
      setStatus(`Error: ${event.error}`, false);
      break;
  }
}

/* ── Rendering helpers ── */
function setStatus(text, running) {
  const bar = document.getElementById('status-bar');
  bar.style.display = 'flex';
  document.getElementById('status-text').textContent = text;
  document.getElementById('spinner').style.display = running ? 'block' : 'none';
}

function setTag(supplierId, type, label) {
  const el = document.getElementById(`tag-${supplierId}`);
  el.className = `tag tag-${type}`;
  el.textContent = label;
}

let lastRound = {};

function appendMessage(supplierId, msg) {
  const chat = document.getElementById(`chat-${supplierId}`);

  if (!lastRound[supplierId]) {
    chat.innerHTML = '';
    lastRound[supplierId] = 0;
  }

  if (msg.round > lastRound[supplierId]) {
    lastRound[supplierId] = msg.round;
    if (msg.round > 1) {
      const divider = document.createElement('div');
      divider.className = 'round-divider';
      divider.textContent = `Round ${msg.round}`;
      chat.appendChild(divider);
    }
  }

  const bubble = document.createElement('div');
  bubble.className = `msg-bubble msg-${msg.from}`;

  const label = document.createElement('div');
  label.className = 'msg-label';
  label.textContent = msg.from === 'brand' ? 'Brand Agent' : state.suppliers[supplierId]?.name ?? supplierId;

  // Strip the ===QUOTE=== block from display (shown separately)
  const content = msg.content.replace(/===QUOTE===[\s\S]*?===END_QUOTE===/g, '').trim();

  const text = document.createElement('div');
  text.textContent = content;

  bubble.appendChild(label);
  bubble.appendChild(text);
  chat.appendChild(bubble);
  chat.scrollTop = chat.scrollHeight;
}

function renderQuote(supplierId, quote) {
  const container = document.getElementById(`quote-${supplierId}`);
  const products = state.products;

  const rows = products.map(p => {
    const price = quote.unitPrices[p.code];
    if (!price) return '';
    const qty = state.quantities[p.code] ?? p.defaultQuantity;
    return `
      <div class="qt-row">
        <span class="label">${p.code}</span>
        <span class="value">$${price.toFixed(2)}/unit · ${(price * qty).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</span>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="quote-box">
      <div class="qt">Final Quote</div>
      ${rows}
      <div class="qt-row"><span class="label">Lead time</span><span class="value">${quote.leadTimeDays} days</span></div>
      <div class="qt-row"><span class="label">Payment</span><span class="value">${quote.paymentTerms}</span></div>
      <div class="qt-total">
        <span>Total</span>
        <span>${quote.totalValue.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</span>
      </div>
    </div>`;
}

function renderScores(scores) {
  const card = document.getElementById('scores-card');
  const table = document.getElementById('scores-table');
  card.style.display = 'block';

  const WEIGHTS = { priceScore: 35, qualityScore: 30, leadTimeScore: 25, paymentScore: 10 };
  const LABELS  = { priceScore: 'Price (35%)', qualityScore: 'Quality (30%)', leadTimeScore: 'Lead Time (25%)', paymentScore: 'Payment (10%)' };

  // Find best total
  const maxTotal = Math.max(...Object.values(scores).map(s => s.total));

  const headers = ['Supplier', ...Object.values(LABELS), 'Overall'];
  table.innerHTML = `
    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>
      ${Object.entries(scores).map(([id, s]) => `
        <tr>
          <td style="font-weight:600">${state.suppliers[id]?.name ?? id}</td>
          ${Object.keys(WEIGHTS).map(k => `
            <td>
              <div class="score-bar-wrap">
                <div class="score-bar">
                  <div class="score-bar-fill ${s[k] === Math.max(...Object.values(scores).map(x => x[k])) ? 'best' : ''}"
                    style="width:${s[k] * 10}%"></div>
                </div>
                <span class="score-num">${s[k]}</span>
              </div>
            </td>`).join('')}
          <td style="font-weight:700; color:${s.total === maxTotal ? 'var(--win-color)' : 'var(--text)'}">
            ${s.total}/10
          </td>
        </tr>`).join('')}
    </tbody>`;
}

function renderReflection(content) {
  const card = document.getElementById('reflection-card');
  card.style.display = 'block';
  document.getElementById('reflection-body').textContent = content;
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderDecision(winner, reasoning) {
  const card = document.getElementById('decision-card');
  card.style.display = 'block';

  const winnerCard = document.getElementById(`card-${winner}`);
  if (winnerCard) winnerCard.classList.add('winner');
  setTag(winner, 'winner', 'Winner');

  document.getElementById('winner-name').textContent =
    state.suppliers[winner]?.name ?? winner;
  document.getElementById('reasoning').textContent = reasoning;

  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Init ── */
boot();
