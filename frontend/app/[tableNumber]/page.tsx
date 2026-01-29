"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AuthDrawer } from "@/components/auth-drawer";
import { CartDrawer } from "@/components/cart-drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { apiClient, auth } from "@/lib/api";
import {
  loadCartFromLocalStorage,
  saveCartToLocalStorage,
  syncCartToServer,
  connectCartWebSocket,
  getCartTotal,
  getCartItemCount,
  addItemToCart,
  removeItemFromCart,
  updateItemQuantity,
  deleteItemFromCart,
  getItemQuantity,
  CartItem,
} from "@/lib/cart";
import type { components } from "@/types/api";

type MenuItem = components["schemas"]["MenuItemSchema"];

export default function MenuPage() {
  const params = useParams();
  const tableNumber = params.tableNumber as string;
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [showAuthDrawer, setShowAuthDrawer] = useState(false);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  useEffect(() => {
    // Check authentication status
    const authenticated = auth.isAuthenticated();
    setIsAuthenticated(authenticated);
    
    if (!authenticated) {
      setShowAuthDrawer(true);
    } else {
      // Extract user ID from token
      const token = auth.getToken();
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          setUserId(payload.user_id || null);
        } catch (e) {
          console.error("Error parsing token:", e);
        }
      }
    }

    // Load cart from localStorage
    const savedCart = loadCartFromLocalStorage();
    setCartItems(savedCart);
  }, []);

  useEffect(() => {
    // Fetch menu items
    fetchMenuItems();
  }, []);

  useEffect(() => {
    // Connect to WebSocket for real-time cart updates if authenticated
    if (userId) {
      const disconnect = connectCartWebSocket(userId, (items) => {
        setCartItems(items);
      });
      return () => disconnect();
    }
  }, [userId]);

  const fetchMenuItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await apiClient.GET("/api/v1/menu");
      
      if (error || !data) {
        console.error("Failed to fetch menu items:", error);
        return;
      }
      
      setMenuItems(data);
    } catch (err) {
      console.error("Error fetching menu:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSuccess = () => {
    setIsAuthenticated(true);
    setShowAuthDrawer(false);
    
    // Get user ID from token
    const token = auth.getToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserId(payload.user_id || null);
      } catch (e) {
        console.error("Error parsing token:", e);
      }
    }
  };

  const updateCart = (newItems: CartItem[]) => {
    setCartItems(newItems);
    const lastUpdated = saveCartToLocalStorage(newItems);
    
    // Sync to server if authenticated
    if (userId) {
      syncCartToServer(userId, newItems, lastUpdated);
    }
  };

  const handleAddToCart = (item: MenuItem) => {
    const newItems = addItemToCart(cartItems, item);
    updateCart(newItems);
  };

  const handleRemoveFromCart = (itemId: number) => {
    const newItems = removeItemFromCart(cartItems, itemId);
    updateCart(newItems);
  };

  const handleUpdateQuantity = (itemId: number, quantity: number) => {
    const newItems = updateItemQuantity(cartItems, itemId, quantity);
    updateCart(newItems);
  };

  const handleDeleteItem = (itemId: number) => {
    const newItems = deleteItemFromCart(cartItems, itemId);
    updateCart(newItems);
  };

  const handleCheckout = () => {
    setShowCartDrawer(false);
    // TODO: Implement checkout flow
    alert("Checkout functionality coming soon!");
  };

  // Group menu items by category
  const groupedMenuItems = menuItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  const totalItems = getCartItemCount(cartItems);
  const totalPrice = getCartTotal(cartItems);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Table {tableNumber}</h1>
              <p className="text-sm text-gray-600">Browse our menu</p>
            </div>
            {isAuthenticated && totalItems > 0 && (
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className="text-sm font-medium">{totalItems} items</div>
                  <div className="text-lg font-bold">${totalPrice.toFixed(2)}</div>
                </div>
                <Button onClick={() => setShowCartDrawer(true)}>View Cart</Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Menu Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-8">
            {/* Skeleton Loading */}
            {[1, 2].map((categoryIndex) => (
              <div key={categoryIndex} className="space-y-4">
                <Skeleton className="h-8 w-32" />
                <div className="grid gap-4 md:grid-cols-2">
                  {[1, 2, 3, 4].map((itemIndex) => (
                    <div
                      key={itemIndex}
                      className="bg-white rounded-lg p-4 border"
                    >
                      <div className="flex gap-4">
                        <Skeleton className="w-24 h-24 rounded-md flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-5 w-3/4" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-2/3" />
                          <div className="flex items-center justify-between mt-2">
                            <Skeleton className="h-6 w-16" />
                            <Skeleton className="h-9 w-20" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedMenuItems).map(([category, items]) => (
              <div key={category} className="space-y-4">
                <h2 className="text-2xl font-bold capitalize">{category}</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {items.map((item) => {
                    const qty = getItemQuantity(cartItems, item.id!);
                    return (
                      <div
                        key={item.id}
                        className="bg-white rounded-lg p-4 border hover:shadow-md transition-shadow"
                      >
                        <div className="flex gap-4">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-24 h-24 object-cover rounded-md flex-shrink-0"
                            />
                          ) : (
                            <div className="w-24 h-24 bg-gray-200 rounded-md flex-shrink-0 flex items-center justify-center">
                              <span className="text-gray-400 text-xs">No image</span>
                            </div>
                          )}
                          <div className="flex-1 flex flex-col">
                            <h3 className="font-semibold text-lg">{item.name}</h3>
                            <p className="text-sm text-gray-600 flex-1 line-clamp-2">
                              {item.description}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="font-bold text-lg">
                                ${item.price.toFixed(2)}
                              </span>
                              {isAuthenticated && (
                                <div className="flex items-center gap-2">
                                  {qty > 0 ? (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleRemoveFromCart(item.id!)}
                                        className="h-8 w-8 p-0"
                                      >
                                        -
                                      </Button>
                                      <span className="font-medium min-w-[20px] text-center">
                                        {qty}
                                      </span>
                                      <Button
                                        size="sm"
                                        onClick={() => handleAddToCart(item)}
                                        className="h-8 w-8 p-0"
                                      >
                                        +
                                      </Button>
                                    </>
                                  ) : (
                                    <Button
                                      size="sm"
                                      onClick={() => handleAddToCart(item)}
                                    >
                                      Add
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && menuItems.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No menu items available at the moment.</p>
          </div>
        )}
      </div>

      {/* Auth Drawer */}
      <AuthDrawer
        open={showAuthDrawer}
        onClose={() => {
          // Don't allow closing without auth
          if (isAuthenticated) {
            setShowAuthDrawer(false);
          }
        }}
        onSuccess={handleAuthSuccess}
      />

      {/* Cart Drawer */}
      <CartDrawer
        open={showCartDrawer}
        onClose={() => setShowCartDrawer(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleDeleteItem}
        onCheckout={handleCheckout}
      />
    </div>
  );
}
