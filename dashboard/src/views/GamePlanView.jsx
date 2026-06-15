import { useState, useCallback } from 'react'
import { API_URL } from '../lib/constants.js'

const PRIORITY_STYLES = {
  urgent: 'bg-red-50 border-red-300 text-red-800',
  high:   'bg-orange-50 border-orange-200 text-orange-800',
  medium: 'bg-amber-50 border-amber-200 text-amber-700',
  low:    'bg-parchment-50 border-parchment-200 text-ink-600',
}

const PRIORITY_DOT = {
  urgent: 'bg-red-500',
  high:   'bg-orange-400',
  medium: 'bg-amber-400',
  low:    'bg-parchment-300',
}

const RISK_STYLES = {
  red:   { badge: 'bg-red-50 text-red-700 border-red-200',   bar: 'bg-red-400'   },
  amber: { badge: 'bg-amber-50 text-amber-700 border-amber-200', bar: 'bg-amber-400' },
  green: { badge: 'bg-green-50 text-green-700 border-green-200', bar: 'bg-green-400' },
}


function StepCard({ step, idx }) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${PRIORITY_STYLES[step.priority] ?? PRIORITY_STYLES.low}`}>
      <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
        <span className="text-[11px] font-mono text-ink-400 w-4">{idx + 1}</span>
        <div className={`w-2 h-2 rounded-full ${PRIORITY_DOT[step.priority] ?? 'bg-ink-300'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium leading-snug">{step.action}</p>
        <p className="text-[11px] mt-0.5 opacity-70">Owner: {step.owner}</p>
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-60 flex-shrink-0 mt-0.5">
        {step.priority}
      </span>
    </div>
  )
}

function RiskMeter({ risk }) {
  if (!risk) return null
  const st = RISK_STYLES[risk.color] ?? RISK_STYLES.amber
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-ink-400 font-semibold">Risk Score</span>
        <span className={`text-xs font-bold px-2.5 py-1 rounded border ${st.badge}`}>
          {risk.score}/100 — {risk.label}
        </span>
      </div>
      <div className="h-2 bg-parchment-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${st.bar}`}
          style={{ width: `${risk.score}%` }}
        />
      </div>
      {risk.flags?.length > 0 && (
        <ul className="space-y-1">
          {risk.flags.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-[12px] text-ink-600">
              <span className="text-amber-500 flex-shrink-0 mt-0.5">▲</span>
              {f}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function GamePlanView() {
  const [caseId, setCaseId] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const generate = useCallback(async (e) => {
    e?.preventDefault()
    if (!caseId.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(`${API_URL}/api/gameplan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId.trim() }),
      })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      setResult(await res.json())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [caseId])

  const steps = result?.game_plan?.steps ?? []
  const urgent = steps.filter(s => s.priority === 'urgent')
  const high   = steps.filter(s => s.priority === 'high')
  const rest   = steps.filter(s => !['urgent','high'].includes(s.priority))

  return (
    <div className="flex-1 overflow-auto px-6 py-5 space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-ink-900" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Case Strategy
        </h2>
        <p className="text-[12px] text-ink-400 mt-0.5">Risk assessment, action plan, and settlement range for any active case</p>
      </div>

      {/* Input */}
      <form onSubmit={generate} className="flex gap-3">
        <input
          type="text"
          value={caseId}
          onChange={e => setCaseId(e.target.value)}
          placeholder="Enter case ID (e.g. case-2026-001)"
          className="flex-1 px-4 py-2.5 text-sm bg-white border border-parchment-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-legal-navy/20 focus:border-legal-navy/40"
        />
        <button
          type="submit"
          disabled={loading || !caseId.trim()}
          className="px-5 py-2.5 bg-legal-navy text-white text-sm font-semibold rounded-lg hover:bg-legal-navy/90 disabled:opacity-40 transition-all"
        >
          {loading ? 'Generating…' : 'Generate Plan'}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left: Risk + settlement */}
          <div className="space-y-5">
            <div className="bg-white rounded-lg border border-parchment-200 shadow-card p-5">
              <RiskMeter risk={result.risk} />
            </div>

            <div className="bg-white rounded-lg border border-parchment-200 shadow-card p-5 space-y-2">
              <p className="text-[11px] uppercase tracking-wider text-ink-400 font-semibold">Est. Settlement Range</p>
              <p className="text-xl font-bold text-legal-navy" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                {result.game_plan?.settlement_range ?? 'TBD'}
              </p>
              <p className="text-[11px] text-ink-400">Rough estimate — subject to discovery & liability</p>
            </div>

            <div className="bg-white rounded-lg border border-parchment-200 shadow-card p-4 space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-ink-400 font-semibold mb-2">Case Details</p>
              <p className="text-[12px] text-ink-600"><span className="font-medium">Type:</span> {result.game_plan?.case_type?.replace(/_/g,' ')}</p>
              <p className="text-[12px] text-ink-600"><span className="font-medium">Stage:</span> {result.game_plan?.stage}</p>
              <p className="text-[11px] text-ink-400 mt-2">Generated {new Date(result.generated_at).toLocaleTimeString()}</p>
            </div>
          </div>

          {/* Right: Action steps */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-parchment-200 shadow-card p-5 space-y-4">
            <p className="text-[13px] font-semibold text-ink-800">Action Plan ({steps.length} steps)</p>

            {urgent.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-red-500 font-bold">🚨 Urgent</p>
                {urgent.map((s, i) => <StepCard key={i} step={s} idx={i} />)}
              </div>
            )}
            {high.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-orange-500 font-bold">High Priority</p>
                {high.map((s, i) => <StepCard key={i} step={s} idx={urgent.length + i} />)}
              </div>
            )}
            {rest.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-ink-400 font-bold">Other Steps</p>
                {rest.map((s, i) => <StepCard key={i} step={s} idx={urgent.length + high.length + i} />)}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
