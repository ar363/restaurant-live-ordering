"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { apiClient, auth } from "@/lib/api";
import { loadCartFromLocalStorage, getCartTotal, CartItem, connectCartWebSocket } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { CreditCard, Smartphone, Banknote, ArrowLeft } from "lucide-react";

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const tableNumber = params.tableNumber as string;
  
  const [userId, setUserId] = useState<number | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "card" | "cash" | null>(null);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
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
        
        // Load existing checkout state if any
        if (uid) {
          loadCheckoutState(uid);
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
    if (!userId) return;

    // Start checkout when entering page
    startCheckout();
  }, [userId]);

  useEffect(() => {
    // Connect to WebSocket for real-time sync across devices
    if (!userId) return;

    const disconnect = connectCartWebSocket(
      userId,
      (items) => setCartItems(items),
      (isInProgress, paymentMethodFromWS, specialInstructionsFromWS) => {
        // Sync checkout state from other devices
        if (isInProgress) {
          if (paymentMethodFromWS) {
            setPaymentMethod(paymentMethodFromWS as "upi" | "card" | "cash");
          }
          if (specialInstructionsFromWS) {
            setSpecialInstructions(specialInstructionsFromWS);
          }
        }
      },
      (orderId) => {
        // Checkout completed - redirect to order status page
        router.push(`/${tableNumber}/order/${orderId}`);
      }
    );

    return () => disconnect();
  }, [userId, tableNumber, router]);

  const loadCheckoutState = async (uid: number) => {
    try {
      const { data } = await apiClient.GET("/api/v1/checkout/status", {
        params: { query: { user_id: uid } }
      });

      if (data?.is_checkout_in_progress) {
        if (data.payment_method) {
          setPaymentMethod(data.payment_method as "upi" | "card" | "cash");
        }
        if (data.special_instructions) {
          setSpecialInstructions(data.special_instructions);
        }
      }
    } catch (error) {
      console.error("Error loading checkout state:", error);
    }
  };

  const startCheckout = async () => {
    if (!userId) return;

    try {
      await apiClient.POST("/api/v1/checkout/start", {
        body: { 
          user_id: userId,
          payment_method: paymentMethod,
          special_instructions: specialInstructions
        }
      });
    } catch (error) {
      console.error("Error starting checkout:", error);
    }
  };

  const updateCheckout = async (newPaymentMethod?: string, newInstructions?: string) => {
    if (!userId) return;

    try {
      await apiClient.POST("/api/v1/checkout/update", {
        body: {
          user_id: userId,
          payment_method: newPaymentMethod || paymentMethod,
          special_instructions: newInstructions !== undefined ? newInstructions : specialInstructions
        }
      });
    } catch (error) {
      console.error("Error updating checkout:", error);
    }
  };

  const handlePaymentMethodChange = (method: "upi" | "card" | "cash") => {
    setPaymentMethod(method);
    updateCheckout(method, specialInstructions);
  };

  const handleInstructionsChange = (instructions: string) => {
    setSpecialInstructions(instructions);
    // Debounce the update to avoid too many API calls
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    updateTimeoutRef.current = setTimeout(() => {
      updateCheckout(paymentMethod || undefined, instructions);
    }, 500);
  };

  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

      // Success - redirect to order status page
      router.push(`/${tableNumber}/order/${data.id}`);
    } catch (error) {
      console.error("Error completing checkout:", error);
      alert("Failed to complete checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (userId) {
      await apiClient.POST("/api/v1/checkout/cancel", {
        params: { query: { user_id: userId } }
      });
    }
    router.back();
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
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">{/* Order Summary */}
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
              onClick={() => handlePaymentMethodChange("upi")}
              className={`flex items-center gap-4 p-4 border-2 rounded-lg transition-all ${
                paymentMethod === "upi"
                  ? "border-black bg-gray-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <Smartphone className="h-6 w-6" />
              <div className="text-left">
                <div className="font-semibold">UPI Payment</div>
                <div className="text-sm text-gray-600">Pay using UPI apps</div>
              </div>
            </button>

            <button
              onClick={() => handlePaymentMethodChange("card")}
              className={`flex items-center gap-4 p-4 border-2 rounded-lg transition-all ${
                paymentMethod === "card"
                  ? "border-black bg-gray-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <CreditCard className="h-6 w-6" />
              <div className="text-left">
                <div className="font-semibold">Card Payment</div>
                <div className="text-sm text-gray-600">Credit or Debit card</div>
              </div>
            </button>

            <button
              onClick={() => handlePaymentMethodChange("cash")}
              className={`flex items-center gap-4 p-4 border-2 rounded-lg transition-all ${
                paymentMethod === "cash"
                  ? "border-black bg-gray-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
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
            onChange={(e) => handleInstructionsChange(e.target.value)}
            className="mt-2"
          />
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            onClick={handleCompleteCheckout}
            disabled={!paymentMethod || loading}
            className="w-full h-12 text-lg"
          >
            {loading ? "Processing..." : `Place Order - ₹${formatPrice(total)}`}
          </Button>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
