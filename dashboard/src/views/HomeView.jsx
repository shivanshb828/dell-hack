import { useMemo } from 'react'
import { DEMO_EVENTS, DEMO_CASES } from '../lib/demo.js'

function StatCard({ value, label, sub, accent }) {
  const accentMap = {
    navy:   'border-l-legal-navy bg-legal-navy-light',
    gold:   'border-l-legal-gold-border bg-legal-gold-light',
    red:    'border-l-red-400 bg-red-50',
    forest: 'border-l-legal-forest bg-legal-forest-light',
  }
  return (
    <div className={`bg-white border border-parchment-200 border-l-4 rounded-lg px-5 py-4 shadow-card ${accentMap[accent] ?? accentMap.navy}`}>
      <p className="text-3xl font-bold text-ink-900" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{value}</p>
      <p className="text-[12px] font-semibold text-ink-700 mt-1">{label}</p>
      {sub && <p className="text-[11px] text-ink-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function SOLAlert({ c }) {
  const days = Math.floor((new Date(c.sol_date) - new Date()) / 86400000)
  const isUrgent = days <= 30
  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded border ${
      isUrgent ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
    }`}>
      <div className="min-w-0">
        <p className={`text-[13px] font-semibold ${isUrgent ? 'text-red-800' : 'text-amber-800'}`}>
          {c.client_name}
        </p>
        <p className={`text-[11px] mt-0.5 ${isUrgent ? 'text-red-600' : 'text-amber-600'}`}>
          {c.case_type?.replace(/_/g, ' ')} · SOL {new Date(c.sol_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </div>
      <span className={`text-[12px] font-bold px-2.5 py-1 rounded flex-shrink-0 ml-4 ${
        isUrgent ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
      }`}>
        {days}d
      </span>
    </div>
  )
}

const EVENT_TYPE_LABEL = {
  consult:    'Consult',
  deposition: 'Deposition',
  follow_up:  'Follow-Up',
  court_date: 'Court Date',
  other:      'Meeting',
}

const EVENT_TYPE_COLOR = {
  consult:    'bg-blue-100 text-blue-700',
  deposition: 'bg-violet-100 text-violet-700',
  follow_up:  'bg-amber-100 text-amber-700',
  court_date: 'bg-red-100 text-red-700',
  other:      'bg-parchment-100 text-ink-600',
}

function CalendarRow({ event }) {
  const time = new Date(event.scheduled_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return (
    <div className="flex items-start gap-3 py-3 border-b border-parchment-100 last:border-0">
      <span className="text-[12px] font-mono text-ink-500 w-16 flex-shrink-0 pt-0.5">{time}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-ink-800 leading-tight truncate">{event.attendee}</p>
        <p className="text-[11px] text-ink-400 mt-0.5">{event.lawyer_name ?? 'Unassigned'}{event.location ? ` · ${event.location}` : ''}</p>
      </div>
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded flex-shrink-0 ${EVENT_TYPE_COLOR[event.event_type] ?? EVENT_TYPE_COLOR.other}`}>
        {EVENT_TYPE_LABEL[event.event_type] ?? event.event_type}
      </span>
    </div>
  )
}

function ActivityItem({ activity }) {
  const icons = {
    tool_call: (
      <div className="w-6 h-6 rounded-full bg-legal-navy-light border border-blue-200 flex items-center justify-center flex-shrink-0">
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-legal-navy">
          <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
        </svg>
      </div>
    ),
    system: (
      <div className="w-6 h-6 rounded-full bg-parchment-100 border border-parchment-200 flex items-center justify-center flex-shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-parchment-300" />
      </div>
    ),
    call_ended: (
      <div className="w-6 h-6 rounded-full bg-legal-forest-light border border-legal-forest-border flex items-center justify-center flex-shrink-0">
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-legal-forest">
          <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
        </svg>
      </div>
    ),
  }

  const TOOL_ACTION = {
    'intake.start':       'Started intake',
    'intake.update':      'Updated intake',
    'case.qualify':       'Qualified case',
    'case.create':        'Created case file',
    'case.decline':       'Declined case',
    'calendar.create_event': 'Booked consultation',
    'schedule_followup':  'Scheduled follow-up',
    'notify.dashboard':   'Notified dashboard',
    record_consent:       'Recorded consent',
  }

  const label = activity.type === 'tool_call'
    ? (TOOL_ACTION[activity.tool] ?? activity.tool)
    : activity.type === 'call_ended'
    ? `Call ended — ${activity.outcome ?? 'complete'}`
    : activity.text ?? activity.type

  const time = new Date(activity.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-parchment-100 last:border-0">
      {icons[activity.type] ?? icons.system}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-ink-700 leading-tight">{label}</p>
      </div>
      <span className="text-[11px] font-mono text-ink-400 flex-shrink-0">{time}</span>
    </div>
  )
}

export default function HomeView({ cases, calendarEvents, activities, stats, activeCall }) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  const solAlerts = useMemo(() =>
    (cases ?? DEMO_CASES)
      .filter(c => c.sol_date && Math.floor((new Date(c.sol_date) - new Date()) / 86400000) <= 90)
      .sort((a, b) => new Date(a.sol_date) - new Date(b.sol_date))
      .slice(0, 4),
    [cases]
  )

  const todayEvents = useMemo(() => {
    const todayStr = new Date().toDateString()
    const events = (calendarEvents ?? DEMO_EVENTS)
      .filter(e => new Date(e.scheduled_at).toDateString() === todayStr)
      .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
    // If no real today events, show next 3 upcoming ones for demo
    if (events.length === 0) {
      return (calendarEvents ?? DEMO_EVENTS)
        .filter(e => new Date(e.scheduled_at) > new Date())
        .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
        .slice(0, 3)
    }
    return events
  }, [calendarEvents])

  const recentActivity = useMemo(() =>
    [...(activities ?? [])].reverse().slice(0, 8),
    [activities]
  )

  return (
    <div className="flex-1 overflow-auto">
      {/* Page header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-parchment-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink-900" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Good morning
            </h2>
            <p className="text-[12px] text-ink-400 mt-0.5">{today}</p>
          </div>
          {activeCall && (
            <div className="flex items-center gap-2 bg-legal-navy rounded px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dot-live" />
              <span className="text-white text-[12px] font-semibold">Donna on call — {activeCall.callerPhone}</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-5 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard value={stats?.callsToday ?? 0} label="Calls Today" sub="via Donna" accent="navy" />
          <StatCard value={stats?.casesCreated ?? 0} label="Cases Opened" sub="this session" accent="forest" />
          <StatCard value={stats?.consultationsBooked ?? 0} label="Consultations Booked" sub="this session" accent="gold" />
          <StatCard value={solAlerts.length} label="SOL Alerts" sub="≤ 90 days" accent={solAlerts.length > 0 ? 'red' : 'forest'} />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-3 gap-5">

          {/* Left col: SOL Alerts */}
          <div className="space-y-5">
            <div className="bg-white rounded-lg border border-parchment-200 shadow-card overflow-hidden">
              <div className="px-5 py-3 border-b border-parchment-200 flex items-center justify-between">
                <h3 className="text-[13px] font-semibold text-ink-800">SOL Alerts</h3>
                {solAlerts.length > 0 && (
                  <span className="text-[10px] bg-red-50 text-red-600 font-semibold border border-red-200 rounded px-2 py-0.5">
                    {solAlerts.length} active
                  </span>
                )}
              </div>
              <div className="px-4 py-3 space-y-2">
                {solAlerts.length === 0 ? (
                  <p className="text-[12px] text-ink-400 py-4 text-center">No SOL warnings</p>
                ) : (
                  solAlerts.map(c => <SOLAlert key={c.case_id} c={c} />)
                )}
              </div>
            </div>

            {/* Donna's summary */}
            <div className="bg-white rounded-lg border border-parchment-200 shadow-card overflow-hidden">
              <div className="px-5 py-3 border-b border-parchment-200">
                <h3 className="text-[13px] font-semibold text-ink-800">Donna — This Session</h3>
              </div>
              <div className="px-5 py-4 space-y-3">
                {[
                  { label: 'Calls handled', value: stats?.callsToday ?? 0 },
                  { label: 'Cases opened', value: stats?.casesCreated ?? 0 },
                  { label: 'Consults booked', value: stats?.consultationsBooked ?? 0 },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[12px] text-ink-600">{label}</span>
                    <span className="text-[13px] font-semibold text-ink-900">{value}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-parchment-100">
                  <p className="text-[11px] text-ink-400 leading-relaxed">
                    Running on Dell GB10 · All data stays on-device
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Center col: Today's calendar */}
          <div className="bg-white rounded-lg border border-parchment-200 shadow-card overflow-hidden">
            <div className="px-5 py-3 border-b border-parchment-200 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-ink-800">
                {todayEvents.length > 0 && new Date(todayEvents[0]?.scheduled_at).toDateString() === new Date().toDateString()
                  ? "Today's Schedule"
                  : "Upcoming"}
              </h3>
              <span className="text-[10px] text-ink-400 font-medium">{todayEvents.length} events</span>
            </div>
            <div className="px-4 py-2">
              {todayEvents.length === 0 ? (
                <p className="text-[12px] text-ink-400 py-6 text-center">Nothing scheduled</p>
              ) : (
                todayEvents.map(e => <CalendarRow key={e.event_id} event={e} />)
              )}
            </div>

            {/* All cases summary */}
            <div className="border-t border-parchment-200 px-5 py-3 bg-parchment-50">
              <p className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold mb-2.5">Active Cases</p>
              <div className="space-y-1.5">
                {(cases ?? DEMO_CASES).filter(c => c.stage === 'active' || c.stage === 'intake').slice(0, 4).map(c => (
                  <div key={c.case_id} className="flex items-center justify-between">
                    <span className="text-[12px] text-ink-700">{c.client_name}</span>
                    <span className="text-[11px] text-ink-400 capitalize">{c.stage?.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right col: Recent activity */}
          <div className="bg-white rounded-lg border border-parchment-200 shadow-card overflow-hidden">
            <div className="px-5 py-3 border-b border-parchment-200">
              <h3 className="text-[13px] font-semibold text-ink-800">Recent Activity</h3>
            </div>
            <div className="px-4 py-2">
              {recentActivity.length === 0 ? (
                <p className="text-[12px] text-ink-400 py-6 text-center">
                  No activity yet — waiting for calls or emails
                </p>
              ) : (
                recentActivity.map(a => <ActivityItem key={a.id} activity={a} />)
              )}
            </div>
            {recentActivity.length === 0 && (
              <div className="px-5 pb-4">
                <p className="text-[11px] text-ink-400 leading-relaxed">
                  Donna monitors inbound calls and emails automatically. Activity appears here in real time.
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
