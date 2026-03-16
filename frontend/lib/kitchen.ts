export interface KitchenOrder {
  id: number;
  table_number?: number;
  total_amount: number;
  payment_method?: string | null;
  payment_status: boolean;
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'completed' | 'cancelled';
  username?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  items: Array<{
    id?: number;
    menu_item_id: number;
    menu_item_name?: string | null;
    quantity: number;
    price_at_order: number;
  }>;
}

interface KitchenWebSocketCallbacks {
  onNewOrder?: (order: KitchenOrder) => void;
  onOrderUpdate?: (order: KitchenOrder) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

function getWebSocketURL(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }
  
  // Client-side only - build URL from current host
  if (typeof window === 'undefined') {
    return 'ws://localhost:8000'; // Fallback for SSR
  }
  
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}`;
}

const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second

export function connectKitchenWebSocket(token: string, callbacks: KitchenWebSocketCallbacks = {}) {
  let retries = 0;
  let retryTimeout: NodeJS.Timeout | null = null;
  let ws: WebSocket | null = null;

  const connect = () => {
    try {
      ws = new WebSocket(`${getWebSocketURL()}/ws/kitchen/?token=${token}`);

      ws.onopen = () => {
        console.log("Kitchen WebSocket connected");
        retries = 0; // Reset retry count on successful connection
        callbacks.onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case 'new_order':
              callbacks.onNewOrder?.(message.order);
              break;
            case 'order_update':
              callbacks.onOrderUpdate?.(message.order);
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        if (event.code === 1000) {
          console.log('Kitchen WebSocket closed normally');
        } else {
          console.error('Kitchen WebSocket closed unexpectedly:', event.code, event.reason);

          // Attempt to reconnect with exponential backoff
          if (retries < MAX_RETRIES) {
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, retries);
            console.log(`Attempting to reconnect in ${delay}ms (attempt ${retries + 1}/${MAX_RETRIES})`);
            retries++;
            retryTimeout = setTimeout(connect, delay);
          } else {
            console.error('Max reconnection attempts reached');
            callbacks.onDisconnect?.();
          }
        }
      };

      ws.onerror = (error) => {
        console.error('Kitchen WebSocket error:', error);
        // The onclose handler will handle reconnection
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      callbacks.onDisconnect?.();
    }
  };

  // Initial connection
  connect();

  // Return cleanup function
  return () => {
    if (retryTimeout) {
      clearTimeout(retryTimeout);
    }
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      ws.close(1000, 'Client disconnecting');
    }
  };
}
