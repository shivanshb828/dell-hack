import { Type } from "@google/genai";
import type { FunctionDeclaration } from "@google/genai";

export const ATTORNEY_TOOLS: FunctionDeclaration[] = [
  {
    name: "list_recent_leads",
    description: "List leads captured in the last N days. Use when the attorney asks 'what's new', 'who called', or about recent intake.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        days: { type: Type.NUMBER, description: "How many days back to look (default 7)" },
        limit: { type: Type.NUMBER, description: "Max number of leads to return (default 10)" },
      },
    },
  },
  {
    name: "lookup_lead",
    description: "Look up a specific lead by name or phone. Returns intake details, incident type, and status.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: "Name or phone number to search by" },
      },
      required: ["query"],
    },
  },
  {
    name: "list_upcoming_appointments",
    description: "List upcoming consultations on the calendar. Use when attorney asks about their week or today's schedule.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        days_ahead: { type: Type.NUMBER, description: "How many days ahead to look (default 7)" },
      },
    },
  },
  {
    name: "summarize_call",
    description: "Summarize a recent call transcript by callSid. Use when attorney asks about a specific case or caller.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        call_sid: { type: Type.STRING, description: "Twilio CallSid of the call to summarize" },
      },
      required: ["call_sid"],
    },
  },
  {
    name: "end_call_politely",
    description: "End the portal session gracefully.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
];
