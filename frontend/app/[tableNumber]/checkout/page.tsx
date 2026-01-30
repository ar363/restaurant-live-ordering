"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { apiClient, auth } from "@/lib/api";
import { loadCartFromLocalStorage, getCartTotal, CartItem, connectCartWebSocket } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { CreditCard, Smartphone, Banknote, ArrowLeft, Lock } from "lucide-react";

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const tableNumber = params.tableNumber as string;
  
  const [userId, setUserId] = useState<number | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "card" | "cash" | null>(null);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [checkoutOwnerId, setCheckoutOwnerId] = useState<number | null>(null);
  const [myDeviceId, setMyDeviceId] = useState<string>("");
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);

  useEffect(() => {
    // Generate unique device ID for this session
    const deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setMyDeviceId(deviceId);

    // Check authentication
    if (!auth.isAuthenticated()) {
      router.push(`/${tableNumber}`);
      return;
    }

    // Get user ID from token
    const token = auth.getToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const uid = payload.user_id || null;
        setUserId(uid);
        
        // Check checkout status first
        if (uid) {
          checkCheckoutStatus(uid, deviceId);
        }
      } catch (e) {
        console.error("Error parsing token:", e);
      }
    }

    // Load cart
    const cart = loadCartFromLocalStorage();
    if (cart.length === 0) {
      router.push(`/${tableNumber}`);
      return;
    }
    setCartItems(cart);
  }, [tableNumber, router]);

  useEffect(() => {
    if (!userId || !myDeviceId) return;

    if (!isReadOnly) {
      // Start checkout and send heartbeat every 15 seconds
      startCheckout();
      const heartbeatInterval = setInterval(() => {
        sendHeartbeat();
      }, 15000);
      return () => clearInterval(heartbeatInterval);
    } else {
      // Poll checkout status every 3 seconds to check if unlocked
      const statusInterval = setInterval(() => {
        checkCheckoutStatus(userId, myDeviceId);
      }, 3000);
      return () => clearInterval(statusInterval);
    }
  }, [userId, myDeviceId, isReadOnly]);

  useEffect(() => {
    // Connect to WebSocket for checkout status updates
    if (!userId || !myDeviceId) return;

    const disconnect = connectCartWebSocket(
      userId,
      (items) => setCartItems(items),
      (isInProgress, byUserId, deviceId) => {
        setActiveDeviceId(deviceId || null);
        
        if (!isInProgress) {
          // Checkout was cancelled, allow this device to checkout
          setIsReadOnly(false);
          setCheckoutOwnerId(null);
        } else if (deviceId && deviceId !== myDeviceId) {
          // Another device is checking out
          setIsReadOnly(true);
          setCheckoutOwnerId(byUserId);
        } else if (deviceId === myDeviceId) {
          // This device owns the checkout
          setIsReadOnly(false);
        }
      },
      () => {
        // Checkout completed
        router.push(`/${tableNumber}`);
      }
    );

    return () => disconnect();
  }, [userId, myDeviceId, tableNumber, router]);

  const checkCheckoutStatus = async (uid: number, deviceId: string) => {
    try {
      const { data } = await apiClient.GET("/api/v1/checkout/status", {
        params: { query: { user_id: uid } }
      });

      if (data?.is_checkout_in_progress) {
        setActiveDeviceId(data.device_id || null);
        
        if (data.device_id && data.device_id !== deviceId) {
          // Another device is checking out
          setIsReadOnly(true);
          setCheckoutOwnerId(data.checkout_by_user_id || null);
        } else if (data.device_id === deviceId) {
          // This device owns the checkout
          setIsReadOnly(false);
        } else {
          // No device ID match, take over
          setIsReadOnly(false);
        }
      } else {
        // No checkout in progress
        setIsReadOnly(false);
        setCheckoutOwnerId(null);
        setActiveDeviceId(null);
      }
    } catch (error) {
      console.error("Error checking checkout status:", error);
    }
  };

  const sendHeartbeat = async () => {
    if (!userId || !myDeviceId) return;

    try {
      await apiClient.POST("/api/v1/checkout/heartbeat", {
        params: { query: { user_id: userId, device_id: myDeviceId } }
      });
    } catch (error) {
      console.error("Error sending heartbeat:", error);
    }
  };

  const startCheckout = async () => {
    const token = auth.getToken();
    if (!token) return;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const uid = payload.user_id;

      await apiClient.POST("/api/v1/checkout/start", {
        body: { user_id: uid }
      });
    } catch (error) {
      console.error("Error starting checkout:", error);
    }
  };

  const handleCompleteCheckout = async () => {
    if (!paymentMethod || !userId) return;

    setLoading(true);
    try {
      const { data, error } = await apiClient.POST("/api/v1/checkout/complete", {
        body: {
          user_id: userId,
          table_number: parseInt(tableNumber),
          payment_method: paymentMethod,
          special_instructions: specialInstructions,
        },
      });

      if (error) {
        alert("Failed to complete checkout. Please try again.");
        return;
      }

      // Success - redirect to order confirmation
      alert(`Order placed successfully! Order ID: ${data.id}`);
      router.push(`/${tableNumber}`);
    } catch (error) {
      console.error("Error completing checkout:", error);
      alert("Failed to complete checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (userId && !isReadOnly) {
      await apiClient.POST("/api/v1/checkout/cancel", {
        params: { query: { user_id: userId } }
      });
    }
    router.back();
  };

  const handleTakeOver = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      // Force cancel existing checkout
      await apiClient.POST("/api/v1/checkout/cancel", {
        params: { query: { user_id: userId } }
      });
      
      // Wait a moment then start new checkout
      await new Promise(resolve => setTimeout(resolve, 500));
      await startCheckout();
      
      setIsReadOnly(false);
      setCheckoutOwnerId(null);
    } catch (error) {
      console.error("Error taking over checkout:", error);
      alert("Failed to take over checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const total = getCartTotal(cartItems);
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleCancel} disabled={loading}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Checkout</h1>
              <p className="text-sm text-gray-600">Table {tableNumber}</p>
            </div>
            {isReadOnly && (
              <div className="flex items-center gap-2 text-yellow-700 bg-yellow-50 px-3 py-1 rounded-full">
                <Lock className="h-4 w-4" />
                <span className="text-sm font-medium">Read Only</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {isReadOnly && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 font-medium text-center">
              🔒 Checkout in progress on another device
            </p>
            <p className="text-yellow-700 text-sm text-center mt-1">
              You can view the order but cannot make changes. The lock will auto-release in 60 seconds if the other device disconnects.
            </p>
            <div className="mt-3 flex justify-center">
              <Button
                onClick={handleTakeOver}
                disabled={loading}
                variant="outline"
                size="sm"
              >
                {loading ? "Taking Over..." : "Take Over Checkout"}
              </Button>
            </div>
          </div>
        )}
        {/* Order Summary */}
        <div className="bg-white rounded-lg p-6 border">
          <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
          <div className="space-y-3">
            {cartItems.map((item) => (
              <div key={item.menu_item_id} className="flex justify-between text-sm">
                <span className="text-gray-700">
                  {item.menu_item.name} x {item.quantity}
                </span>
                <span className="font-medium">
                  ₹{formatPrice(item.menu_item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>
          <Separator className="my-4" />
          <div className="flex justify-between items-center">
            <span className="font-semibold text-lg">Total ({itemCount} items)</span>
            <span className="font-bold text-2xl">₹{formatPrice(total)}</span>
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-white rounded-lg p-6 border">
          <h2 className="text-lg font-semibold mb-4">Payment Method</h2>
          <div className="grid gap-3">
            <button
              onClick={() => !isReadOnly && setPaymentMethod("upi")}
              disabled={isReadOnly}
              className={`flex items-center gap-4 p-4 border-2 rounded-lg transition-all ${
                paymentMethod === "upi"
                  ? "border-black bg-gray-50"
                  : "border-gray-200 hover:border-gray-300"
              } ${isReadOnly ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <Smartphone className="h-6 w-6" />
              <div className="text-left">
                <div className="font-semibold">UPI Payment</div>
                <div className="text-sm text-gray-600">Pay using UPI apps</div>
              </div>
            </button>

            <button
              onClick={() => !isReadOnly && setPaymentMethod("card")}
              disabled={isReadOnly}
              className={`flex items-center gap-4 p-4 border-2 rounded-lg transition-all ${
                paymentMethod === "card"
                  ? "border-black bg-gray-50"
                  : "border-gray-200 hover:border-gray-300"
              } ${isReadOnly ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <CreditCard className="h-6 w-6" />
              <div className="text-left">
                <div className="font-semibold">Card Payment</div>
                <div className="text-sm text-gray-600">Credit or Debit card</div>
              </div>
            </button>

            <button
              onClick={() => !isReadOnly && setPaymentMethod("cash")}
              disabled={isReadOnly}
              className={`flex items-center gap-4 p-4 border-2 rounded-lg transition-all ${
                paymentMethod === "cash"
                  ? "border-black bg-gray-50"
                  : "border-gray-200 hover:border-gray-300"
              } ${isReadOnly ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <Banknote className="h-6 w-6" />
              <div className="text-left">
                <div className="font-semibold">Pay in Cash</div>
                <div className="text-sm text-gray-600">Pay when order arrives</div>
              </div>
            </button>
          </div>
        </div>

        {/* Special Instructions */}
        <div className="bg-white rounded-lg p-6 border">
          <Label htmlFor="instructions" className="text-lg font-semibold">
            Special Instructions (Optional)
          </Label>
          <Input
            id="instructions"
            placeholder="Any special requests for your order..."
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
            className="mt-2"
            disabled={isReadOnly}
          />
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            onClick={handleCompleteCheckout}
            disabled={!paymentMethod || loading || isReadOnly}
            className="w-full h-12 text-lg"
          >
            {loading ? "Processing..." : isReadOnly ? "Checkout Locked" : `Place Order - ₹${formatPrice(total)}`}
          </Button>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
            className="w-full"
          >
            {isReadOnly ? "Back to Menu" : "Cancel"}
          </Button>
        </div>
      </div>
    </div>
  );
}
