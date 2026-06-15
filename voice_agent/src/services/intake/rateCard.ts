// Firm fee constants. Voice agent reads these — never invents numbers.

export type RateCardEntry = {
  incident_type: string;
  contingency_pct: number;
  consult_fee_usd: number;
  retainer_required: boolean;
  notes: string;
};

const DEFAULT_CARD: RateCardEntry = {
  incident_type: "default",
  contingency_pct: 33,
  consult_fee_usd: 0,
  retainer_required: false,
  notes: "Free initial consult. No fees unless we win. Contingency taken from settlement.",
};

const RATE_CARD: Record<string, RateCardEntry> = {
  auto_accident: {
    incident_type: "auto_accident",
    contingency_pct: 33,
    consult_fee_usd: 0,
    retainer_required: false,
    notes: "Free initial consult. Standard one-third contingency on settlement. No upfront fees.",
  },
  slip_fall: {
    incident_type: "slip_fall",
    contingency_pct: 35,
    consult_fee_usd: 0,
    retainer_required: false,
    notes: "Free consult. 35% contingency. No fees unless we recover.",
  },
  workplace: {
    incident_type: "workplace",
    contingency_pct: 25,
    consult_fee_usd: 0,
    retainer_required: false,
    notes: "Workers' comp claims — statutory cap typically 25% of award. Free consult.",
  },
  medical_malpractice: {
    incident_type: "medical_malpractice",
    contingency_pct: 40,
    consult_fee_usd: 0,
    retainer_required: false,
    notes: "Free consult. 40% contingency due to case complexity and expert costs.",
  },
  other: DEFAULT_CARD,
};

export function getRateCardFor(incidentType: string): RateCardEntry {
  return RATE_CARD[incidentType] ?? DEFAULT_CARD;
}
