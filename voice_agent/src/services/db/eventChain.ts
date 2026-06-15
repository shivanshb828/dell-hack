/**
 * Hash-chained, tamper-evident event log helpers.
 * Engineering scaffolding only — not legal-validity grade.
 */
import { createHash } from "node:crypto";
import { db } from "./client";

export interface EventHashLink {
  seq: number;
  prevHash: string | null;
  hash: string;
}

export interface ChainVerification {
  valid: boolean;
  brokenAt?: number;
}

function canonicalJSON(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalJSON).join(",") + "]";
  }
  const keys = Object.keys(obj as object).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + canonicalJSON((obj as Record<string, unknown>)[k]))
      .join(",") +
    "}"
  );
}

export function computeEventHash(prevHash: string | null, payload: object, createdAt: string): string {
  const input = (prevHash ?? "") + canonicalJSON(payload) + createdAt;
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function verifyEventChain(callSid: string): ChainVerification {
  const rows = db
    .prepare(
      `SELECT seq, type, prev_hash, hash, payload, created_at
         FROM voice_call_events
        WHERE call_sid = ?
        ORDER BY seq ASC`
    )
    .all(callSid) as Array<{
    seq: number;
    type: string;
    prev_hash: string | null;
    hash: string | null;
    payload: string;
    created_at: string;
  }>;

  const chainRows = rows.filter((r) => r.hash != null);
  if (chainRows.length === 0) return { valid: true };

  for (const row of chainRows) {
    let payloadObj: object = {};
    try {
      payloadObj = JSON.parse(row.payload);
    } catch {
      return { valid: false, brokenAt: row.seq };
    }
    const expected = computeEventHash(row.prev_hash, { type: row.type, ...payloadObj }, row.created_at);
    if (expected !== row.hash) {
      return { valid: false, brokenAt: row.seq };
    }
  }
  return { valid: true };
}
