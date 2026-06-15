import { Type } from "@google/genai";
import type { FunctionDeclaration } from "@google/genai";

export const INTAKE_TOOLS: FunctionDeclaration[] = [
  {
    name: "record_consent",
    description: "Record explicit caller consent. Call immediately after the caller says yes to a consent question.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        consent_type: {
          type: Type.STRING,
          description: "One of: recording, ai_disclosure, intake",
        },
      },
      required: ["consent_type"],
    },
  },
  {
    name: "store_lead_profile",
    description:
      "Save the caller's intake info to the database. ONLY call with confirmed=true AFTER reading all 4 fields (name, phone, email, incident type) back in one sentence and getting verbal yes.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "Caller's full name" },
        phone: { type: Type.STRING, description: "Phone number in E.164 format" },
        email: { type: Type.STRING, description: "Caller's email address" },
        incident_type: {
          type: Type.STRING,
          description: "One of: auto_accident, slip_fall, workplace, medical_malpractice, other",
        },
        incident_date: { type: Type.STRING, description: "ISO date of the incident, YYYY-MM-DD" },
        incident_location: { type: Type.STRING, description: "City and state where incident happened" },
        injury_summary: { type: Type.STRING, description: "Brief description of what happened and any injuries" },
        confirmed: {
          type: Type.BOOLEAN,
          description: "MUST be true. Set true only after caller verbally confirms all fields are correct.",
        },
      },
      required: ["name", "phone", "email", "incident_type", "confirmed"],
    },
  },
  {
    name: "calm_response",
    description: "Mark a moment where the caller is distressed and you offered calming language. Use after delivering a calming statement.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        note: { type: Type.STRING, description: "Short description of what you said and the caller's state" },
      },
      required: ["note"],
    },
  },
  {
    name: "discuss_rates",
    description: "Get the firm's fee structure for a given incident type. Returns contingency %, consult fee, retainer requirements, and notes. Read these aloud — never invent numbers.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        incident_type: {
          type: Type.STRING,
          description: "One of: auto_accident, slip_fall, workplace, medical_malpractice, other",
        },
      },
      required: ["incident_type"],
    },
  },
  {
    name: "book_appointment",
    description: "Book a free consultation with the attorney. Call AFTER store_lead_profile and after caller verbally confirms the time.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        datetime_iso: { type: Type.STRING, description: "ISO 8601 datetime for the appointment start" },
        duration_minutes: { type: Type.NUMBER, description: "Duration in minutes (default 30)" },
        attorney: { type: Type.STRING, description: "Attorney email or name (optional, falls back to firm default)" },
        notes: { type: Type.STRING, description: "Short note for the attorney about the case" },
      },
      required: ["datetime_iso"],
    },
  },
  {
    name: "send_intake_email",
    description: "Queue a follow-up email to the caller with a place to upload documents (photos, police report, medical, insurance). Call AFTER store_lead_profile succeeds.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        client_name: { type: Type.STRING, description: "Caller's full name" },
        client_email: { type: Type.STRING, description: "Caller's email address (confirmed)" },
        incident_type: { type: Type.STRING, description: "Incident type for email template selection" },
        incident_summary: { type: Type.STRING, description: "Short summary of what happened" },
      },
      required: ["client_name", "client_email", "incident_type"],
    },
  },
  {
    name: "transfer_to_human",
    description: "Hand the call off to a human attorney or staffer. Use when the caller is in crisis, asks for a human, or the situation needs human judgment.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        reason: { type: Type.STRING, description: "Short reason for the transfer" },
      },
      required: ["reason"],
    },
  },
  {
    name: "end_call_politely",
    description: "Signal that the call is wrapping up. Say goodbye first, then call this. The call will close shortly after.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
];
