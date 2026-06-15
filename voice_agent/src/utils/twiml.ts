import { config } from "../config";

function xmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function xmlText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildStreamTwiml(opts: {
  callSid: string;
  streamToken: string;
  mode?: "inbound" | "outbound" | "attorney";
}): string {
  const wsUrl = config.PUBLIC_URL.replace(/^http/, "ws") + "/media-stream";
  const mode = opts.mode ?? "inbound";
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${xmlAttr(wsUrl)}">
      <Parameter name="callSid" value="${xmlAttr(opts.callSid)}" />
      <Parameter name="streamToken" value="${xmlAttr(opts.streamToken)}" />
      <Parameter name="mode" value="${xmlAttr(mode)}" />
    </Stream>
  </Connect>
</Response>`;
}

export function buildOutboundStreamTwiml(opts: {
  callSid: string;
  streamToken: string;
  leadId: string | null;
}): string {
  const wsUrl = config.PUBLIC_URL.replace(/^http/, "ws") + "/media-stream";
  const leadParam = opts.leadId
    ? `\n      <Parameter name="leadId" value="${xmlAttr(opts.leadId)}" />`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${xmlAttr(wsUrl)}">
      <Parameter name="callSid" value="${xmlAttr(opts.callSid)}" />
      <Parameter name="streamToken" value="${xmlAttr(opts.streamToken)}" />
      <Parameter name="mode" value="outbound" />${leadParam}
    </Stream>
  </Connect>
</Response>`;
}

export function buildHangupTwiml(message?: string): string {
  const say = message ? `<Say>${xmlText(message)}</Say>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${say}
  <Hangup/>
</Response>`;
}
