export const PHASES = [
  {
    id: 'DISCLOSURE',
    label: 'Consent',
    desc: 'AI disclosure & recording consent',
    color: 'indigo',
  },
  {
    id: 'INTAKE',
    label: 'Intake',
    desc: 'Gathering incident details',
    color: 'blue',
  },
  {
    id: 'QUALIFICATION',
    label: 'Qualify',
    desc: 'Case qualification check',
    color: 'violet',
  },
  {
    id: 'BOOKING',
    label: 'Schedule',
    desc: 'Booking consultation',
    color: 'emerald',
  },
  {
    id: 'CLOSE',
    label: 'Complete',
    desc: 'Summary & next steps',
    color: 'green',
  },
]

export const PHASE_IDS = PHASES.map((p) => p.id)

export const TOOL_TO_PHASE = {
  record_consent: 'DISCLOSURE',
  store_lead_profile: 'INTAKE',
  calm_response: 'INTAKE',
  discuss_rates: 'QUALIFICATION',
  book_appointment: 'BOOKING',
  send_intake_email: 'CLOSE',
  transfer_to_human: 'CLOSE',
  end_call_politely: 'CLOSE',
  // attorney portal tools
  list_recent_leads: 'INTAKE',
  lookup_lead: 'INTAKE',
  list_upcoming_appointments: 'BOOKING',
  summarize_call: 'CLOSE',
}

export const TOOL_LABELS = {
  record_consent: 'Record Consent',
  store_lead_profile: 'Store Lead Profile',
  calm_response: 'Calm Response',
  discuss_rates: 'Discuss Rates',
  book_appointment: 'Book Appointment',
  send_intake_email: 'Send Intake Email',
  transfer_to_human: 'Transfer to Human',
  end_call_politely: 'End Call',
  list_recent_leads: 'List Recent Leads',
  lookup_lead: 'Lookup Lead',
  list_upcoming_appointments: 'List Appointments',
  summarize_call: 'Summarize Call',
}

export const CASE_STAGE_COLORS = {
  intake: 'bg-blue-100 text-blue-700',
  qualification: 'bg-violet-100 text-violet-700',
  booking: 'bg-emerald-100 text-emerald-700',
  active: 'bg-green-100 text-green-700',
  closed: 'bg-slate-100 text-slate-600',
  declined: 'bg-red-100 text-red-600',
}

export const EVENT_TYPE_COLORS = {
  consult: 'bg-blue-100 text-blue-700',
  deposition: 'bg-violet-100 text-violet-700',
  follow_up: 'bg-amber-100 text-amber-700',
  court_date: 'bg-red-100 text-red-700',
  filing_deadline: 'bg-orange-100 text-orange-700',
  other: 'bg-slate-100 text-slate-600',
}

export const WS_URL =
  import.meta.env.VITE_WS_URL ??
  (typeof window !== 'undefined'
    ? `ws://${window.location.hostname}:3001/dashboard`
    : 'ws://localhost:3001/dashboard')
export const API_URL = import.meta.env.VITE_API_URL ?? ''
