export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  // Twilio provides numbers in E.164; preserve the + prefix for storage
  if (raw.startsWith("+")) return `+${digits}`;
  return digits;
}
