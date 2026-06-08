/**
 * Curated static payloads for chenitha.net portfolio demos.
 * Works without auth, Groq, or database — instant interviewer-ready experience.
 */
import type { MARLSimResult } from '@/components/archionlabs/SimulationPanel';
import type { ComplianceResult } from '@/components/archionlabs/CompliancePanel';
import type { ViewerResult } from '@/components/archionlabs/ViewerPanel';
import { ARCHION_PORTFOLIO_DEMO_BUILD } from '@/lib/archion-demo-seed';

export const PORTFOLIO_VIEWER_TOKEN = 'PORTFOLIO-LIVE-DEMO';

export const PORTFOLIO_SIM_RESULT: MARLSimResult = {
  success: true,
  powered_by: 'MARL Social Force Engine · Portfolio Demo',
  model_id: 'portfolio_demo_residence',
  simulation_metrics: {
    total_agents: 60,
    simulation_duration_s: 120,
    avg_travel_time_s: 72,
    max_density_m2: 0.405,
    bottleneck_risk: 'LOW',
    egress_score: 91,
    flow_rate_agents_per_min: 30.0,
    evacuation_time_s: 138,
    congestion_zones: ['Entry Vestibule'],
  },
  accessibility: {
    score: 83,
    standards_checked: ['SL_UDA_2023', 'ISO_21542:2011'],
    pass_count: 4,
    fail_count: 0,
    warn_count: 2,
    checks: [
      {
        standard: 'SL_UDA_2023',
        clause: 'Section 7.4.2',
        requirement: 'Minimum corridor width',
        required_value: '1200 mm',
        measured_value: '2000 mm',
        status: 'PASS',
        severity: 'none',
        description: 'Primary corridor meets UDA 1200 mm minimum for accessible circulation.',
        remediation: null,
      },
      {
        standard: 'ISO_21542_2011',
        clause: 'Clause 17.3',
        requirement: 'Accessible door clear width',
        required_value: '900 mm',
        measured_value: '920 mm',
        status: 'PASS',
        severity: 'none',
        description: 'Bedroom and living door clear widths comply with ISO 21542:2011.',
        remediation: null,
      },
      {
        standard: 'SL_UDA_2023',
        clause: 'Section 9.1.1',
        requirement: 'Accessible toilet facility',
        required_value: '2200 mm × 2200 mm min',
        measured_value: '2000 mm × 3000 mm',
        status: 'WARN',
        severity: 'major',
        description: 'Bathroom 1 width is below 2200 mm; length compensates partially for turning circle.',
        remediation: 'Expand bathroom clear width to 2200 mm or provide dedicated accessible WC per UDA 9.1.1.',
      },
      {
        standard: 'ISO_21542_2011',
        clause: 'Clause 9.2',
        requirement: 'Entrance ramp gradient',
        required_value: 'Max 1:12 (8.3%)',
        measured_value: '1:14 (7.1%)',
        status: 'PASS',
        severity: 'none',
        description: 'Main entrance ramp gradient within ISO 21542 limits.',
        remediation: null,
      },
      {
        standard: 'SL_UDA_2023',
        clause: 'Section 12.3',
        requirement: 'Tactile warning surfaces',
        required_value: 'At all level changes',
        measured_value: 'Partially installed',
        status: 'WARN',
        severity: 'minor',
        description: 'Tactile blister tiles recommended at stair heads and ramp transition.',
        remediation: 'Install 300 mm deep tactile warning strips at egress transitions.',
      },
      {
        standard: 'ISO_21542_2011',
        clause: 'Clause 32.1',
        requirement: 'Visual contrast at door frames',
        required_value: 'Min 30pt LRV contrast',
        measured_value: '42pt LRV',
        status: 'PASS',
        severity: 'none',
        description: 'Door frame contrast exceeds minimum for low-vision users.',
        remediation: null,
      },
    ],
  },
  executive_summary:
    'MARL pedestrian simulation for the portfolio demo residence shows LOW bottleneck risk with egress score 91/100. Peak density remains within UDA comfort thresholds; evacuation completes in 138 seconds for 60 agents across the open-plan living and bedroom wing.',
  recommendations: [
    'Maintain 2000 mm corridor clear width through the main circulation spine.',
    'Add tactile warning surfaces at the entrance vestibule transition.',
    'Schedule quarterly egress drill validation against ISO 21542 targets.',
  ],
  evacuation_assessment:
    'Predicted evacuation of 138 s is within the three-minute target for single-storey residential occupancy. Secondary exit at the east wing reduces single-point congestion.',
  report_available: true,
};

export const PORTFOLIO_COMPLIANCE_RESULT: ComplianceResult = {
  overall_compliance_score: 86,
  confidence: 94,
  jurisdictions_checked: ['SL_UDA_2023', 'ISO_21542:2011', 'SLNBC_FIRE'],
  summary:
    'Portfolio demo floor plan achieves strong compliance across UDA 2023 and ISO 21542:2011. Two minor accessibility items and one fire egress advisory are documented with LKR remediation estimates for client review.',
  violations: [
    {
      id: 'uda_corridor_01',
      severity: 'minor',
      jurisdiction: 'SL_UDA_2023',
      clause: '7.4.2',
      description: 'Storage room adjacent to corridor reduces perceived clear width at pinch point.',
      confidence_score: 92,
      estimated_cost_lkr: 185000,
      fix_type: 'Reconfigure storage door swing to maintain 1200 mm clear corridor.',
    },
    {
      id: 'iso_door_02',
      severity: 'major',
      jurisdiction: 'ISO_21542:2011',
      clause: '17.3',
      description: 'Bedroom 3 door clear opening measured at 850 mm — below 900 mm wheelchair threshold.',
      confidence_score: 96,
      estimated_cost_lkr: 420000,
      fix_type: 'Replace with 1000 mm door set and offset hinges.',
    },
    {
      id: 'slnbc_egress_03',
      severity: 'minor',
      jurisdiction: 'SLNBC_FIRE',
      clause: '4.2.1',
      description: 'Emergency exit signage not indicated on submitted plan — assumed during construction phase.',
      confidence_score: 88,
      estimated_cost_lkr: 65000,
      fix_type: 'Add photoluminescent exit signs at both egress points.',
    },
  ],
};

export function buildPortfolioViewerResult(origin?: string): ViewerResult {
  const base = (origin || process.env.NEXT_PUBLIC_APP_URL || 'https://tokenly.chenitha.net').replace(/\/$/, '');
  const sharePath = `/viewer/${PORTFOLIO_VIEWER_TOKEN}`;
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  return {
    success: true,
    powered_by: 'Tokenly Build Secure Viewer · Portfolio Demo',
    share_token: PORTFOLIO_VIEWER_TOKEN,
    share_url: sharePath,
    full_share_url: `${base}${sharePath}`,
    password_protected: false,
    expires_at: expires,
    expiry_hours: 168,
    watermark_enabled: true,
    client_name: 'Portfolio Reviewer',
    security: {
      token_type: 'JWT_HMAC_SHA256',
      encryption: 'AES-256-GCM',
      access_log: true,
      max_views: 50,
      dual_layer_watermark: true,
      watermark_text: `TOKENLY BUILD · CONFIDENTIAL · PORTFOLIO · ${new Date().toLocaleDateString()}`,
    },
    model_id: 'portfolio_demo_residence',
    name: ARCHION_PORTFOLIO_DEMO_BUILD.building_name,
    floors: ARCHION_PORTFOLIO_DEMO_BUILD.floors,
    total_area_sqm: ARCHION_PORTFOLIO_DEMO_BUILD.total_area_sqm,
    compliance_score: 88,
    last_inspection: new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    elements: [
      { type: 'structural', count: 248, status: 'compliant' },
      { type: 'mechanical', count: 86, status: 'compliant' },
      { type: 'electrical', count: 64, status: 'compliant' },
      { type: 'plumbing', count: 42, status: 'review' },
    ],
    render_quality: 'ultra',
  };
}

/** Portfolio share metadata for public viewer API */
export function getPortfolioShareMeta() {
  return {
    success: true,
    token: PORTFOLIO_VIEWER_TOKEN,
    password_required: false,
    watermark: true,
    watermark_text: 'TOKENLY BUILD · PORTFOLIO LIVE DEMO · CHENITHA.NET',
    client_name: 'Portfolio Reviewer',
    building_name: ARCHION_PORTFOLIO_DEMO_BUILD.building_name,
    compliance_score: 88,
    expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    rooms: ARCHION_PORTFOLIO_DEMO_BUILD.rooms,
  };
}

export const PORTFOLIO_DEMO_LINKS = [
  { id: 'wisdom', label: 'Wisdom', href: '/market?portfolio=1' },
  { id: 'compliance_stack', label: 'Trust', href: '/compliance-stack?portfolio=1' },
  { id: 'build', label: 'Build', href: '/archionlabs?tab=build&portfolio=1' },
  { id: 'sim', label: 'Sim', href: '/archionlabs?tab=sim&portfolio=1' },
  { id: 'compliance', label: 'Codes', href: '/archionlabs?tab=compliance&portfolio=1' },
  { id: 'viewer', label: 'Viewer', href: '/archionlabs?tab=viewer&portfolio=1' },
] as const;
