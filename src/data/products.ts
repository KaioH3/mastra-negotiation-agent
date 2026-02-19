export interface ProductComponent {
  type: 'material' | 'trim' | 'component';
  name: string;
  composition?: string;
  material?: string;
  function?: string;
}

export interface Product {
  code: string;
  name: string;
  description: string;
  targetFob: number;
  defaultQuantity: number;
  components: ProductComponent[];
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
  {
    code: 'FSH013',
    name: 'Pulse Pro High-Top',
    description: 'Premium materials with elevated padding.',
    targetFob: 14.49,
    defaultQuantity: 10000,
    components: [
      { type: 'material', name: 'Premium Microfiber PU Leather', composition: '100% Polyurethane-coated microfiber' },
      { type: 'material', name: 'Breathable Knit Mesh Lining', composition: '100% Polyester spacer knit' },
      { type: 'trim',     name: 'Gunmetal Metal Eyelets', material: 'Metal' },
      { type: 'trim',     name: 'Nylon Pull Tab', material: 'Nylon' },
      { type: 'component', name: 'Insole Cushioning Foam', function: 'Cushioning and arch support' },
      { type: 'component', name: 'Tongue Lining', function: 'Moisture management and comfort' },
    ],
  },
  {
    code: 'FSH014',
    name: 'Drift Aero High-Top',
    description: 'Breathable mesh paneling with secure fit.',
    targetFob: 20.75,
    defaultQuantity: 5000,
    components: [
      { type: 'material', name: 'Full-Grain Leather Upper', composition: '100% Leather' },
      { type: 'material', name: 'Drift Aero PU Overlay', composition: '100% Polyurethane' },
      { type: 'material', name: 'AirMesh Upper', composition: '85% Polyester, 15% Elastane' },
      { type: 'trim',     name: 'Aluminum Gunmetal Eyelets', material: 'Aluminum' },
      { type: 'trim',     name: 'Polyester Flat Shoelace', material: 'Polyester' },
      { type: 'component', name: 'Tongue Foam Padding', function: 'Tongue cushioning and abrasion protection' },
      { type: 'component', name: 'EVA Insole', function: 'Footbed cushioning and arch support' },
    ],
  },
  {
    code: 'FSH016',
    name: 'Vibe City High-Top',
    description: 'Stylish silhouette with reinforced toe guard.',
    targetFob: 26.13,
    defaultQuantity: 5000,
    components: [
      { type: 'material', name: 'Premium PU Upper', composition: '100% Polyurethane coated fabric' },
      { type: 'material', name: 'Breathable Nylon Mesh', composition: '100% Nylon' },
      { type: 'trim',     name: 'Zinc-coated Metal Eyelets', material: 'Zinc-coated Metal' },
      { type: 'trim',     name: 'Nylon Heel Pull Tab', material: 'Nylon' },
      { type: 'component', name: 'Cushioned Insole', function: 'Cushioning and arch support with antimicrobial top fabric' },
      { type: 'component', name: 'Tongue Foam Liner', function: 'Tongue padding for comfort and moisture management' },
    ],
  },
  {
    code: 'FSH019',
    name: 'Edge Urban High-Top',
    description: 'Durable leather overlays and grippy outsole.',
    targetFob: 51.69,
    defaultQuantity: 5000,
    components: [
      { type: 'material', name: 'Full-Grain Cowhide Leather Upper', composition: '100% Cowhide Leather (Full-Grain)' },
      { type: 'material', name: 'Polyamide Nylon Mesh Lining', composition: '100% Polyamide Nylon' },
      { type: 'trim',     name: 'Antique Brass Metal Eyelets', material: 'Metal' },
      { type: 'trim',     name: 'Round Polyester Shoelace 140cm', material: 'Polyester' },
      { type: 'component', name: 'Insole Cushioning', function: 'Cushioning and moisture management' },
      { type: 'component', name: 'Tongue Foam Pad', function: 'Tongue padding for comfort and fit' },
    ],
  },
  {
    code: 'FSH021',
    name: 'City Rise High-Top',
    description: 'Lightweight city sneaker with padded collar and responsive sole.',
    targetFob: 31.89,
    defaultQuantity: 5000,
    components: [
      { type: 'material', name: 'Knit Upper', composition: '80% Polyester, 20% Elastane' },
      { type: 'material', name: 'PU Overlay', composition: '100% Polyester with PU coating' },
      { type: 'trim',     name: 'Gunmetal Metal Eyelets 6mm', material: 'Metal' },
      { type: 'trim',     name: 'Polyester Flat Shoelaces 120cm', material: 'Polyester' },
      { type: 'component', name: 'Sockliner EVA', function: 'Cushioning and odor control' },
      { type: 'component', name: 'Midsole EVA Core', function: 'Shock absorption and ride' },
    ],
  },
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
