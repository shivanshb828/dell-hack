import { recordConsent, updateLeadProfile, upsertLead } from "../db/sessions";
import { broadcastEvent } from "../db/realtime";
import { getRateCardFor } from "./rateCard";
import { validateLeadParams, normalizePhoneE164 } from "./validation";
import { createAppointment } from "../calendar/client";
import { queueIntakeEmail } from "../email/client";
import { transferCallToHuman } from "../twilio/outbound";
import { config } from "../../config";

export interface ActionResult {
  output: object;
}

export async function executeAction(
  name: string,
  params: Record<string, unknown>,
  ctx: { callSid: string }
): Promise<ActionResult> {
  const t0 = Date.now();
  let success = true;
  let output: object = { ok: true };

  try {
    switch (name) {
      case "record_consent": {
        const consentType = params.consent_type as "recording" | "ai_disclosure" | "intake";
        if (!["recording", "ai_disclosure", "intake"].includes(consentType)) {
          success = false;
          output = { ok: false, error: "invalid_consent_type" };
          break;
        }
        await recordConsent(ctx.callSid, consentType);
        void broadcastEvent({ type: "consent_recorded", callSid: ctx.callSid, consents: [consentType] });
        output = { ok: true, consent_type: consentType };
        break;
      }

      case "store_lead_profile": {
        if (params.confirmed !== true) {
          output = { ok: false, stored: false, needs_confirmation: true, reason: "read_fields_back_first" };
          break;
        }
        const v = validateLeadParams(params);
        if (!v.ok) {
          success = false;
          output = { ok: false, stored: false, reason: v.reason };
          break;
        }
        const phone = normalizePhoneE164(params.phone)!;
        const leadProfile = {
          name: params.name as string,
          phone,
          email: params.email as string,
          incident_type: params.incident_type as string,
          incident_date: params.incident_date as string | undefined,
          incident_location: params.incident_location as string | undefined,
          injury_summary: params.injury_summary as string | undefined,
        };
        await updateLeadProfile(ctx.callSid, leadProfile);
        const leadId = await upsertLead(leadProfile);
        void broadcastEvent({
          type: "lead_stored",
          callSid: ctx.callSid,
          lead: {
            name: leadProfile.name,
            phone: leadProfile.phone,
            email: leadProfile.email,
            incident_type: leadProfile.incident_type,
          },
        });
        output = { ok: true, stored: true, lead_id: leadId };
        break;
      }

      case "calm_response": {
        const note = (params.note as string) ?? "";
        void broadcastEvent({ type: "calm_moment", callSid: ctx.callSid, note });
        output = { ok: true, acknowledged: true };
        break;
      }

      case "discuss_rates": {
        const incidentType = (params.incident_type as string) ?? "other";
        const card = getRateCardFor(incidentType);
        void broadcastEvent({
          type: "rates_discussed",
          callSid: ctx.callSid,
          contingency_pct: card.contingency_pct,
          consult_fee: card.consult_fee_usd,
        });
        output = {
          ok: true,
          contingency_pct: card.contingency_pct,
          consult_fee_usd: card.consult_fee_usd,
          retainer_required: card.retainer_required,
          notes: card.notes,
        };
        break;
      }

      case "book_appointment": {
        const datetimeIso = params.datetime_iso as string;
        if (!datetimeIso || isNaN(Date.parse(datetimeIso))) {
          success = false;
          output = { ok: false, reason: "invalid_datetime" };
          break;
        }
        const attorney = (params.attorney as string) ?? config.ATTORNEY_EMAIL;
        const appt = createAppointment({
          call_sid: ctx.callSid,
          datetime_iso: datetimeIso,
          duration_minutes: (params.duration_minutes as number) ?? 30,
          attorney,
          notes: (params.notes as string) ?? "",
        });
        void broadcastEvent({
          type: "appointment_booked",
          callSid: ctx.callSid,
          datetime_iso: datetimeIso,
          attorney,
        });
        output = { ok: true, appointment_id: appt.id, datetime_iso: datetimeIso };
        break;
      }

      case "send_intake_email": {
        const clientName = params.client_name as string;
        const clientEmail = params.client_email as string;
        if (!clientName || !clientEmail) {
          success = false;
          output = { ok: false, reason: "missing_name_or_email" };
          break;
        }
        const r = await queueIntakeEmail({
          call_sid: ctx.callSid,
          client_name: clientName,
          client_email: clientEmail,
          incident_type: (params.incident_type as string) ?? "other",
          incident_summary: (params.incident_summary as string) ?? "",
        });
        void broadcastEvent({ type: "intake_email_queued", callSid: ctx.callSid, to: clientEmail });
        output = { ok: r.ok, draft_path: r.draft_path };
        break;
      }

      case "transfer_to_human": {
        const reason = (params.reason as string) ?? "caller_requested_human";
        void broadcastEvent({ type: "transfer_requested", callSid: ctx.callSid, reason });
        void transferCallToHuman(ctx.callSid).catch((err) => console.error("[transfer] failed:", err));
        output = { ok: true, transferring: true };
        break;
      }

      case "end_call_politely": {
        void broadcastEvent({ type: "call_end_requested", callSid: ctx.callSid });
        output = { ok: true, ending: true };
        break;
      }

      default:
        success = false;
        output = { ok: false, error: `unknown_tool:${name}` };
    }
  } catch (err) {
    success = false;
    output = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  const durationMs = Date.now() - t0;
  void broadcastEvent({
    type: "action_done",
    callSid: ctx.callSid,
    action: name,
    result: JSON.stringify(output).slice(0, 500),
    success,
    durationMs,
  });

  return { output };
}
