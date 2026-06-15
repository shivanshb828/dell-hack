import crypto from "crypto";
import { db } from "../db/client";
import { config } from "../../config";

export interface AppointmentInput {
  lead_id?: string | null;
  call_sid?: string | null;
  datetime_iso: string;
  duration_minutes?: number;
  attorney?: string;
  notes?: string;
}

export function createAppointment(input: AppointmentInput): { id: string } {
  const id = `appt_${crypto.randomUUID()}`;
  db.prepare(`
    INSERT INTO voice_appointments
      (id, lead_id, call_sid, datetime_iso, duration_minutes, attorney, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.lead_id ?? null,
    input.call_sid ?? null,
    input.datetime_iso,
    input.duration_minutes ?? 30,
    input.attorney ?? config.ATTORNEY_EMAIL,
    input.notes ?? null,
    new Date().toISOString()
  );
  return { id };
}
