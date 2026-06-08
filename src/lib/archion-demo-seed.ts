import type { BuildResult } from '@/components/archionlabs/BuildPanel';

/** Pre-loaded floor plan for portfolio / public demos (no API key required). */
export const ARCHION_PORTFOLIO_DEMO_BUILD: BuildResult = {
  building_name: 'Portfolio Demo Residence',
  building_type: 'residential',
  total_area_sqm: 148,
  floors: 1,
  style: 'modern',
  description:
    'Live demo floor plan — modern three-bedroom layout with open-plan living, used on Chenitha Ranasinghe portfolio.',
  rooms: [
    { id: 'r1', name: 'Living Room', type: 'living', width: 6, height: 5, x: 0, y: 0, area_sqm: 30 },
    { id: 'r2', name: 'Kitchen', type: 'kitchen', width: 4, height: 4, x: 6, y: 0, area_sqm: 16 },
    { id: 'r3', name: 'Dining Room', type: 'dining', width: 4, height: 3, x: 6, y: 4, area_sqm: 12 },
    { id: 'r4', name: 'Corridor', type: 'corridor', width: 2, height: 8, x: 10, y: 0, area_sqm: 16 },
    { id: 'r5', name: 'Master Bedroom', type: 'bedroom', width: 4, height: 4, x: 12, y: 0, area_sqm: 16 },
    { id: 'r6', name: 'Bedroom 2', type: 'bedroom', width: 4, height: 4, x: 12, y: 4, area_sqm: 16 },
    { id: 'r7', name: 'Bedroom 3', type: 'bedroom', width: 3, height: 4, x: 16, y: 0, area_sqm: 12 },
    { id: 'r8', name: 'Bathroom 1', type: 'bathroom', width: 2, height: 3, x: 16, y: 4, area_sqm: 6 },
    { id: 'r9', name: 'Entrance', type: 'entrance', width: 3, height: 2, x: 0, y: 5, area_sqm: 6 },
    { id: 'r10', name: 'Storage', type: 'storage', width: 2, height: 2, x: 0, y: 7, area_sqm: 4 },
  ],
  connections: [
    { from: 'r1', to: 'r2', type: 'opening' },
    { from: 'r1', to: 'r9', type: 'door' },
    { from: 'r1', to: 'r4', type: 'door' },
    { from: 'r2', to: 'r3', type: 'opening' },
    { from: 'r4', to: 'r5', type: 'door' },
    { from: 'r4', to: 'r6', type: 'door' },
    { from: 'r4', to: 'r7', type: 'door' },
    { from: 'r6', to: 'r8', type: 'door' },
  ],
  egress_points: [
    { id: 'exit_1', x: 0, y: 5, type: 'main_entrance' },
    { id: 'exit_2', x: 18, y: 4, type: 'emergency_exit' },
  ],
  accessibility_notes:
    'Corridors ≥1.2 m (UDA). Accessible entrance with ramp provision. ISO 21542 door clearances noted.',
  estimated_cost_usd: 82000,
};
