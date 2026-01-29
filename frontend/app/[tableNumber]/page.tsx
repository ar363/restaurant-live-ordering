"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AuthDrawer } from "@/components/auth-drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { apiClient, auth } from "@/lib/api";
import type { components } from "@/types/api";

type MenuItem = components["schemas"]["MenuItemSchema"];

export default function MenuPage() {
  const params = useParams();
  const tableNumber = params.tableNumber as string;
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthDrawer, setShowAuthDrawer] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    // Check authentication status
    const authenticated = auth.isAuthenticated();
    setIsAuthenticated(authenticated);
    
    if (!authenticated) {
      setShowAuthDrawer(true);
    }
  }, []);

  useEffect(() => {
    // Fetch menu items
    fetchMenuItems();
  }, []);

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
  };

  const addToCart = (itemId: number) => {
    const newCart = new Map(cart);
    const currentQty = newCart.get(itemId) || 0;
    newCart.set(itemId, currentQty + 1);
    setCart(newCart);
  };

  const removeFromCart = (itemId: number) => {
    const newCart = new Map(cart);
    const currentQty = newCart.get(itemId) || 0;
    if (currentQty > 1) {
      newCart.set(itemId, currentQty - 1);
    } else {
      newCart.delete(itemId);
    }
    setCart(newCart);
  };

  const getCartItemCount = (itemId: number) => {
    return cart.get(itemId) || 0;
  };

  const getTotalItems = () => {
    return Array.from(cart.values()).reduce((sum, qty) => sum + qty, 0);
  };

  const getTotalPrice = () => {
    let total = 0;
    cart.forEach((qty, itemId) => {
      const item = menuItems.find((i) => i.id === itemId);
      if (item) {
        total += item.price * qty;
      }
    });
    return total.toFixed(2);
  };

  // Group menu items by category
  const groupedMenuItems = menuItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

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
            {isAuthenticated && getTotalItems() > 0 && (
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className="text-sm font-medium">{getTotalItems()} items</div>
                  <div className="text-lg font-bold">₹{getTotalPrice()}</div>
                </div>
                <Button>View Cart</Button>
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
                    const qty = getCartItemCount(item.id!);
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
                                ₹{item.price.toFixed(2)}
                              </span>
                              {isAuthenticated && (
                                <div className="flex items-center gap-2">
                                  {qty > 0 ? (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => removeFromCart(item.id!)}
                                        className="h-8 w-8 p-0"
                                      >
                                        -
                                      </Button>
                                      <span className="font-medium min-w-[20px] text-center">
                                        {qty}
                                      </span>
                                      <Button
                                        size="sm"
                                        onClick={() => addToCart(item.id!)}
                                        className="h-8 w-8 p-0"
                                      >
                                        +
                                      </Button>
                                    </>
                                  ) : (
                                    <Button
                                      size="sm"
                                      onClick={() => addToCart(item.id!)}
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
    </div>
  );
}
