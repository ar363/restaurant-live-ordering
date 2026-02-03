"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AuthDrawer } from "@/components/auth-drawer";
import { CartDrawer } from "@/components/cart-drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { apiClient, auth, getMediaUrl } from "@/lib/api";
import { History, ShoppingCart } from "lucide-react";
import { formatPrice } from "@/lib/format";
import {
  loadCartFromLocalStorage,
  saveCartToLocalStorage,
  syncCartToServer,
  fetchCartFromServer,
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
  const router = useRouter();
  const tableNumber = params.tableNumber as string;
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [showAuthDrawer, setShowAuthDrawer] = useState(false);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCheckoutInProgress, setIsCheckoutInProgress] = useState(false);

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
      const disconnect = connectCartWebSocket(
        userId,
        (items) => {
          setCartItems(items);
        },
        (isInProgress, byUserId, deviceId) => {
          setIsCheckoutInProgress(isInProgress);
          // Redirect to checkout page when checkout starts
          if (isInProgress) {
            router.push(`/${tableNumber}/checkout`);
          }
        },
        () => {
          // Checkout completed
          setIsCheckoutInProgress(false);
          alert("Order placed successfully!");
        }
      );
      return () => disconnect();
    }
  }, [userId, tableNumber, router]);

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

  const handleAuthSuccess = async () => {
    setIsAuthenticated(true);
    setShowAuthDrawer(false);
    
    // Get user ID from token
    const token = auth.getToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userId = payload.user_id || null;
        setUserId(userId);
        
        // Fetch cart from server and merge with local cart
        if (userId) {
          const serverCart = await fetchCartFromServer(userId);
          if (serverCart && serverCart.items.length > 0) {
            // Server has cart data - use it
            setCartItems(serverCart.items);
            saveCartToLocalStorage(serverCart.items);
          } else {
            // No server cart - sync local cart to server
            const localCart = loadCartFromLocalStorage();
            if (localCart.length > 0) {
              const lastUpdated = saveCartToLocalStorage(localCart);
              await syncCartToServer(userId, localCart, lastUpdated);
            }
          }
        }
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
    router.push(`/${tableNumber}/checkout`);
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
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold truncate">Table {tableNumber}</h1>
              <p className="text-xs sm:text-sm text-gray-600">Browse our menu</p>
            </div>
            {isAuthenticated && totalItems > 0 && (
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-medium">{totalItems} items</div>
                  <div className="text-lg font-bold">₹{formatPrice(totalPrice)}</div>
                </div>
                <Button 
                  onClick={() => setShowCartDrawer(true)}
                  className="relative"
                  size="default"
                >
                  <ShoppingCart className="h-5 w-5 sm:mr-2" />
                  <span className="hidden sm:inline">View Cart</span>
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center sm:hidden">
                    {totalItems}
                  </span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Order History Floating Button */}
      {isAuthenticated && (
        <button
          onClick={() => router.push(`/${tableNumber}/orders`)}
          className="fixed bottom-6 left-6 z-20 bg-white hover:bg-gray-50 text-gray-700 rounded-full shadow-lg border-2 border-gray-200 p-3 sm:p-4 transition-all hover:shadow-xl active:scale-95 flex items-center gap-2 group"
          aria-label="Order History"
        >
          <History className="h-5 w-5 sm:h-6 sm:w-6" />
          <span className="hidden group-hover:inline-block text-sm font-medium pr-1 max-w-0 group-hover:max-w-xs transition-all overflow-hidden whitespace-nowrap">
            Order History
          </span>
        </button>
      )}

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
                    const imageUrl = getMediaUrl(item.image);
                    return (
                      <div
                        key={item.id}
                        className="bg-white rounded-lg p-4 border hover:shadow-md transition-shadow"
                      >
                        <div className="flex gap-4">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
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
                                ₹{formatPrice(item.price)}
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
        isCheckoutInProgress={isCheckoutInProgress}
      />
    </div>
  );
}
