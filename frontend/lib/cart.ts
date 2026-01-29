import { components } from "@/types/api";
import { apiClient, auth } from "./api";

export type MenuItem = components["schemas"]["MenuItemSchema"];

export interface CartItem {
  menu_item_id: number;
  menu_item: MenuItem;
  quantity: number;
}

export interface CartData {
  items: CartItem[];
  last_updated: number;
}

const CART_STORAGE_KEY = "restaurant_cart";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

// Local storage functions
export function saveCartToLocalStorage(items: CartItem[]): number {
  if (typeof window === "undefined") return Date.now();
  
  const lastUpdated = Date.now();
  const cartData: CartData = {
    items,
    last_updated: lastUpdated,
  };
  
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartData));
  return lastUpdated;
}

export function loadCartFromLocalStorage(): CartItem[] {
  if (typeof window === "undefined") return [];
  
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (!stored) return [];
    
    const cartData: CartData = JSON.parse(stored);
    return cartData.items || [];
  } catch (error) {
    console.error("Error loading cart from localStorage:", error);
    return [];
  }
}

export function clearCart() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CART_STORAGE_KEY);
}

// Server sync functions
export async function syncCartToServer(
  userId: number,
  items: CartItem[],
  lastUpdated: number
) {
  try {
    await apiClient.POST("/api/v1/cart/sync", {
      body: {
        user_id: userId,
        cart: {
          items,
          last_updated: lastUpdated,
        },
      },
    });
  } catch (error) {
    console.error("Error syncing cart to server:", error);
  }
}

export async function fetchCartFromServer(
  userId: number
): Promise<{ items: CartItem[]; lastUpdated: number } | null> {
  try {
    const { data, error } = await apiClient.GET("/api/v1/cart/sync", {
      params: {
        query: {
          user_id: userId,
        },
      },
    });

    if (error || !data?.cart) return null;

    return {
      items: data.cart.items,
      lastUpdated: data.cart.last_updated,
    };
  } catch (error) {
    console.error("Error fetching cart from server:", error);
    return null;
  }
}

// Cart WebSocket for real-time cross-device sync
export function connectCartWebSocket(
  userId: number,
  onCartUpdate: (items: CartItem[]) => void
) {
  const token = auth.getToken();
  if (!token) {
    console.error("No token available for WebSocket connection");
    return () => {};
  }

  const ws = new WebSocket(`${WS_URL}/ws/cart/?token=${token}`);
  
  ws.onopen = () => {
    console.log("Cart WebSocket connected");
  };
  
  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === "cart_update" && message.data) {
        const { items, last_updated } = message.data;
        
        // Check if this update is newer than our local version
        const localCart = loadCartFromLocalStorage();
        const localData = localStorage.getItem(CART_STORAGE_KEY);
        const localLastUpdated = localData 
          ? JSON.parse(localData).last_updated 
          : 0;
        
        if (last_updated > localLastUpdated) {
          // Update from server
          onCartUpdate(items);
          saveCartToLocalStorage(items);
        }
      }
    } catch (error) {
      console.error("Error processing cart update:", error);
    }
  };
  
  ws.onerror = (error) => {
    console.error("Cart WebSocket error:", error);
  };
  
  ws.onclose = () => {
    console.log("Cart WebSocket disconnected");
  };
  
  // Return cleanup function
  return () => {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  };
}

// Cart polling for cross-device sync (kept as fallback)
export function startCartPolling(
  userId: number,
  onCartUpdate: (items: CartItem[]) => void
) {
  let lastKnownUpdate = Date.now();
  const POLL_INTERVAL = 1000; // 1 second

  const poll = async () => {
    const serverCart = await fetchCartFromServer(userId);
    if (serverCart && serverCart.lastUpdated > lastKnownUpdate) {
      lastKnownUpdate = serverCart.lastUpdated;
      onCartUpdate(serverCart.items);
      // Update localStorage with server data
      saveCartToLocalStorage(serverCart.items);
    }
  };

  const intervalId = setInterval(poll, POLL_INTERVAL);
  return () => clearInterval(intervalId);
}

// Cart calculations
export function getCartTotal(items: CartItem[]): number {
  return items.reduce((total, item) => {
    return total + item.menu_item.price * item.quantity;
  }, 0);
}

export function getCartItemCount(items: CartItem[]): number {
  return items.reduce((count, item) => count + item.quantity, 0);
}

// Cart item helpers
export function addItemToCart(items: CartItem[], menuItem: MenuItem): CartItem[] {
  const existingIndex = items.findIndex(
    (item) => item.menu_item_id === menuItem.id
  );

  if (existingIndex >= 0) {
    const newItems = [...items];
    newItems[existingIndex] = {
      ...newItems[existingIndex],
      quantity: newItems[existingIndex].quantity + 1,
    };
    return newItems;
  }

  return [
    ...items,
    {
      menu_item_id: menuItem.id!,
      menu_item: menuItem,
      quantity: 1,
    },
  ];
}

export function removeItemFromCart(items: CartItem[], menuItemId: number): CartItem[] {
  const existingIndex = items.findIndex(
    (item) => item.menu_item_id === menuItemId
  );

  if (existingIndex >= 0) {
    const newItems = [...items];
    if (newItems[existingIndex].quantity > 1) {
      newItems[existingIndex] = {
        ...newItems[existingIndex],
        quantity: newItems[existingIndex].quantity - 1,
      };
      return newItems;
    } else {
      return newItems.filter((_, index) => index !== existingIndex);
    }
  }

  return items;
}

export function updateItemQuantity(
  items: CartItem[],
  menuItemId: number,
  quantity: number
): CartItem[] {
  if (quantity <= 0) {
    return items.filter((item) => item.menu_item_id !== menuItemId);
  }

  const existingIndex = items.findIndex(
    (item) => item.menu_item_id === menuItemId
  );

  if (existingIndex >= 0) {
    const newItems = [...items];
    newItems[existingIndex] = {
      ...newItems[existingIndex],
      quantity,
    };
    return newItems;
  }

  return items;
}

export function deleteItemFromCart(items: CartItem[], menuItemId: number): CartItem[] {
  return items.filter((item) => item.menu_item_id !== menuItemId);
}

export function getItemQuantity(items: CartItem[], menuItemId: number): number {
  const item = items.find((item) => item.menu_item_id === menuItemId);
  return item?.quantity || 0;
}
