import 'dotenv/config';
import { Mastra } from '@mastra/core/mastra';
import { brandAgent } from './agents/brandAgent.js';
import { createSupplierAgent } from './agents/supplierAgent.js';
import { SUPPLIERS } from './data/products.js';

const supplierAgents = Object.fromEntries(
  SUPPLIERS.map(s => [s.id, createSupplierAgent(s)])
);

export const mastra = new Mastra({
  agents: {
    brandAgent,
    ...supplierAgents,
  },
});
