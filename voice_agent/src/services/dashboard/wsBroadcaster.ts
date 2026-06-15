import WebSocket from "ws";

class WsBroadcaster {
  private clients = new Set<WebSocket>();

  register(ws: WebSocket): void {
    this.clients.add(ws);
    ws.on("close", () => this.clients.delete(ws));
    ws.on("error", () => this.clients.delete(ws));
  }

  broadcast(event: object): void {
    const data = JSON.stringify(event);
    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(data);
        } catch {
          // ignore client send errors; drop on next close
        }
      }
    }
  }

  size(): number {
    return this.clients.size;
  }
}

export const wsBroadcaster = new WsBroadcaster();
