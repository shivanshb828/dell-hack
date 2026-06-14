import { useState, useRef, useEffect, useCallback } from 'react'
import { API_URL } from '../lib/constants.js'

// ── icons ─────────────────────────────────────────────────────────────────────

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12zm0 0h7.5" />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09zM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456zM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423z" />
    </svg>
  )
}

// ── suggested prompts ─────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Give me a dashboard summary',
  'Which cases have SOL deadlines in the next 90 days?',
  "What's on the calendar this week?",
  'List all cases in negotiation',
]

// ── message rendering ─────────────────────────────────────────────────────────

function SourceBadge({ source }) {
  if (!source) return null
  const label = source === 'openclaw' ? 'via OpenClaw' : 'via Ollama-direct'
  return (
    <span className="ml-2 text-[10px] font-medium tracking-wide uppercase px-1.5 py-0.5 rounded"
      style={{ color: '#B8860B', backgroundColor: 'rgba(184,134,11,0.08)', border: '1px solid rgba(184,134,11,0.2)' }}>
      {label}
    </span>
  )
}

function Message({ msg }) {
  const isUser = msg.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-white"
          style={{ backgroundColor: '#23283A' }}>
          {msg.text}
        </div>
      </div>
    )
  }

  if (msg.loading) {
    return (
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: 'rgba(184,134,11,0.15)', border: '1px solid rgba(184,134,11,0.3)' }}>
          <SparkleIcon />
        </div>
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl rounded-tl-sm bg-white shadow-sm">
          <span className="inline-flex gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </span>
          <span className="text-xs text-slate-400">Asking Donna…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ backgroundColor: 'rgba(184,134,11,0.15)', border: '1px solid rgba(184,134,11,0.3)' }}>
        <SparkleIcon />
      </div>
      <div className="max-w-[80%]">
        <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white shadow-sm text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
          {msg.text}
        </div>
        <div className="mt-1 flex items-center">
          <SourceBadge source={msg.source} />
        </div>
      </div>
    </div>
  )
}

// ── main view ─────────────────────────────────────────────────────────────────

export default function QueryView() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const submit = useCallback(async (question) => {
    const q = (question ?? input).trim()
    if (!q || loading) return

    setInput('')
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', text: q },
      { id: `d-${Date.now()}`, role: 'donna', loading: true },
    ])
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })

      let answer, source
      if (res.ok) {
        const data = await res.json()
        answer = data.answer
        source = data.source
      } else {
        answer = `Error ${res.status}: ${await res.text()}`
        source = null
      }

      setMessages((prev) => [
        ...prev.slice(0, -1),
        { id: `d-${Date.now()}`, role: 'donna', text: answer, source },
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { id: `d-${Date.now()}`, role: 'donna', text: `Network error: ${err.message}`, source: null },
      ])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [input, loading])

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const empty = messages.length === 0

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#F5F3EF' }}>

      {/* Header */}
      <div className="flex-shrink-0 px-8 pt-8 pb-4 border-b border-black/5 bg-white/40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(184,134,11,0.12)', border: '1px solid rgba(184,134,11,0.25)' }}>
            <SparkleIcon />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Ask Donna
            </h1>
            <p className="text-xs text-slate-500">Query your caseload — powered by the OpenClaw lawyer agent</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">
        {empty && (
          <div className="flex flex-col items-center justify-center h-full gap-6 pb-16">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ backgroundColor: 'rgba(184,134,11,0.10)', border: '1px solid rgba(184,134,11,0.2)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#B8860B" strokeWidth={1.5} className="w-7 h-7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607z" />
                </svg>
              </div>
              <p className="text-slate-700 font-medium text-sm">What do you need to know?</p>
              <p className="text-slate-400 text-xs mt-1">Ask about cases, deadlines, payments, or case law.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => submit(s)}
                  className="text-left px-4 py-3 rounded-xl bg-white shadow-sm border border-black/5 text-xs text-slate-600 hover:border-amber-200 hover:text-amber-800 transition-all duration-150">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <Message key={msg.id} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-8 py-5 border-t border-black/5 bg-white/50">
        <div className="flex gap-3 max-w-3xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask anything about your caseload…"
            rows={1}
            disabled={loading}
            className="flex-1 resize-none rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 shadow-sm outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100 disabled:opacity-50 transition-all"
            style={{ maxHeight: 120 }}
          />
          <button
            onClick={() => submit()}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-150 disabled:opacity-40"
            style={{ backgroundColor: '#B8860B', color: 'white' }}
          >
            <SendIcon />
          </button>
        </div>
        <p className="text-center text-[10px] text-slate-400 mt-2">
          Enter to send · Shift+Enter for new line · All queries stay on this machine
        </p>
      </div>
    </div>
  )
}
