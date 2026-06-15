import express, { Request } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { WebSocketServer } from "ws";
import http from "http";
import { config } from "./config";
import { voiceRouter } from "./routes/voice";
import { voiceOutboundRouter } from "./routes/voiceOutbound";
import { outboundCallsRouter } from "./routes/outboundCalls";
import { healthRouter } from "./routes/health";
import { handleMediaStream } from "./routes/mediaStream";
import { autoRegisterTwilioWebhook } from "./services/twilio/autoWebhook";
import { wsBroadcaster } from "./services/dashboard/wsBroadcaster";
import { runMigrations } from "./services/db/client";

runMigrations();

const app = express();

const allowedOrigins =
  config.CORS_ORIGIN === "*" ? true : config.CORS_ORIGIN.split(",").map((o) => o.trim());
app.use(cors({ origin: allowedOrigins }));

function captureRawBody(req: Request, _res: express.Response, buf: Buffer): void {
  (req as Request & { rawBody?: string }).rawBody = buf.toString("utf8");
}

app.use(bodyParser.urlencoded({ extended: false, verify: captureRawBody }));
app.use(bodyParser.json({ verify: captureRawBody }));

app.use("/voice", voiceRouter);
app.use("/voice/outbound", voiceOutboundRouter);
app.use("/api/calls", outboundCallsRouter);
app.use("/health", healthRouter);

const server = http.createServer(app);

// noServer + manual upgrade routing — two WSServer instances on one HTTP server
// must not register competing 'upgrade' listeners. Route by pathname.
const mediaWss = new WebSocketServer({ noServer: true });
mediaWss.on("connection", handleMediaStream);

const dashboardWss = new WebSocketServer({ noServer: true });
dashboardWss.on("connection", (ws) => {
  wsBroadcaster.register(ws);
  ws.send(JSON.stringify({ type: "hello", timestamp: new Date().toISOString() }));
});

server.on("upgrade", (request, socket, head) => {
  const pathname = new URL(request.url ?? "", "http://localhost").pathname;
  if (pathname === "/media-stream") {
    mediaWss.handleUpgrade(request, socket, head, (ws) => mediaWss.emit("connection", ws, request));
  } else if (pathname === "/dashboard") {
    dashboardWss.handleUpgrade(request, socket, head, (ws) => dashboardWss.emit("connection", ws, request));
  } else {
    socket.destroy();
  }
});

if (!config.GEMINI_API_KEY) {
  console.error("[voice-agent] FATAL: GEMINI_API_KEY not set. Exiting.");
  process.exit(1);
}

server.listen(config.PORT, () => {
  console.log(`[voice-agent] listening on port ${config.PORT}`);
  console.log(`[voice-agent] provider: gemini (${config.GEMINI_MODEL}, voice=${config.GEMINI_VOICE})`);
  console.log(`[voice-agent] firm: ${config.FIRM_NAME}`);
  if (config.TWILIO_WEBHOOK_BASE) {
    console.log(`[voice-agent] inbound webhook:  ${config.TWILIO_WEBHOOK_BASE}/voice`);
    console.log(`[voice-agent] outbound webhook: ${config.TWILIO_WEBHOOK_BASE}/voice/outbound`);
    console.log(`[voice-agent] dashboard ws:     ws://localhost:${config.PORT}/dashboard`);
  }
  if (config.NODE_ENV !== "test") void autoRegisterTwilioWebhook();
});

export { app, server };
