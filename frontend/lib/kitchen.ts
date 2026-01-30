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

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export function connectKitchenWebSocket(token: string, callbacks: KitchenWebSocketCallbacks = {}) {
  const ws = new WebSocket(`${WS_URL}/ws/kitchen/?token=${token}`);
  
  ws.onopen = () => {
    callbacks.onConnect?.();
  };
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
      case 'new_order':
        callbacks.onNewOrder?.(message.order);
        break;
      case 'order_update':
        callbacks.onOrderUpdate?.(message.order);
        break;
    }
  };
  
  ws.onclose = (event) => {
    if (event.code !== 1000) {
      console.error('Kitchen WebSocket closed unexpectedly:', event.code);
    }
    callbacks.onDisconnect?.();
  };
  
  ws.onerror = (error) => {
    console.error('Kitchen WebSocket error:', error);
  };
  
  // Return cleanup function
  return () => {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  };
}
