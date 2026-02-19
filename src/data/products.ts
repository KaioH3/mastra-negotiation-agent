export interface Product {
  code: string;
  name: string;
  targetFob: number;
  defaultQuantity: number;
}

export interface SupplierProfile {
  id: string;
  name: string;
  quality: number;
  pricingMultiplier: number;
  leadTimeDays: string;
  leadTimeMin: number;
  paymentTerms: string;
  strength: string;
}

export const PRODUCTS: Product[] = [
  { code: 'FSH013', name: 'Pulse Pro High-Top',   targetFob: 14.49, defaultQuantity: 10000 },
  { code: 'FSH014', name: 'Drift Aero High-Top',  targetFob: 20.75, defaultQuantity: 5000  },
  { code: 'FSH016', name: 'Vibe City High-Top',   targetFob: 26.13, defaultQuantity: 5000  },
  { code: 'FSH019', name: 'Edge Urban High-Top',  targetFob: 51.69, defaultQuantity: 5000  },
  { code: 'FSH021', name: 'City Rise High-Top',   targetFob: 31.89, defaultQuantity: 5000  },
];

export const SUPPLIERS: SupplierProfile[] = [
  {
    id: 'supplier1',
    name: 'EastCraft Manufacturing',
    quality: 4.0,
    pricingMultiplier: 0.87,
    leadTimeDays: '45–55',
    leadTimeMin: 50,
    paymentTerms: '33% deposit / 33% production approval / 33% before shipping',
    strength: 'lowest cost and flexible payment structure',
  },
  {
    id: 'supplier2',
    name: 'PremiumStep Industries',
    quality: 4.7,
    pricingMultiplier: 1.30,
    leadTimeDays: '25–32',
    leadTimeMin: 28,
    paymentTerms: '30% deposit / 70% before shipping',
    strength: 'highest quality rating and lowest defect rate',
  },
  {
    id: 'supplier3',
    name: 'SwiftMake Footwear Co.',
    quality: 4.0,
    pricingMultiplier: 1.21,
    leadTimeDays: '14–20',
    leadTimeMin: 17,
    paymentTerms: '30% deposit / 70% before shipping',
    strength: 'fastest lead time in the market',
  },
];
