const WS_BASE_URL = process.env.EXPO_PUBLIC_WS_URL || 'wss://kss-grabit-mobile.vercel.app/delivery/ws';

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private listeners: Map<string, Array<(data: any) => void>> = new Map();
  private isIntentionalClose = false;

  public connect(agentId?: string): void {
    this.isIntentionalClose = false;
    const url = agentId ? `${WS_BASE_URL}?agent_id=${agentId}` : WS_BASE_URL;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected');
        this.reconnectAttempts = 0;
        this.emit('connection', { status: 'connected' });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit('message', data);
          if (data.type) {
            this.emit(data.type, data);
          }
        } catch {
          this.emit('message', event.data);
        }
      };

      this.ws.onerror = (error) => {
        console.warn('[WebSocket] Error:', error);
        this.emit('error', error);
      };

      this.ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        this.emit('connection', { status: 'disconnected' });
        if (!this.isIntentionalClose && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const timeout = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
          setTimeout(() => this.connect(agentId), timeout);
        }
      };
    } catch (e) {
      console.warn('[WebSocket] Connection failed:', e);
    }
  }

  public send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      this.ws.send(message);
    } else {
      console.warn('[WebSocket] Cannot send, connection not OPEN');
    }
  }

  public disconnect(): void {
    this.isIntentionalClose = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public on(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);

    return () => {
      const list = this.listeners.get(event);
      if (list) {
        this.listeners.set(event, list.filter((cb) => cb !== callback));
      }
    };
  }

  private emit(event: string, data: any): void {
    const list = this.listeners.get(event);
    if (list) {
      list.forEach((cb) => cb(data));
    }
  }
}

export const wsClient = new WebSocketClient();
