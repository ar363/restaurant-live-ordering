"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

interface OrderItem {
  id?: number;
  menu_item_id: number;
  menu_item_name?: string | null;
  quantity: number;
  price_at_order: number;
}

interface Order {
  id: number;
  table_number?: number;
  status: string;
  payment_method?: string | null;
  payment_status: boolean;
  total_amount: number;
  special_instructions?: string;
  created_at?: string | null;
  items: OrderItem[];
}

export default function OrderStatusPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;
  const tableNumber = params.tableNumber as string;
  
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchOrder();
    
    // Poll for status updates every 5 seconds
    const interval = setInterval(fetchOrder, 5000);
    
    return () => clearInterval(interval);
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      const { data, error: apiError } = await apiClient.GET("/api/v1/orders/{order_id}", {
        params: {
          path: { order_id: parseInt(orderId) },
        },
      });

      if (apiError || !data) {
        setError("Failed to fetch order details");
        setLoading(false);
        return;
      }

      setOrder(data as Order);
      setLoading(false);
    } catch (err) {
      setError("An error occurred");
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "preparing":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "ready":
        return "bg-green-100 text-green-800 border-green-300";
      case "delivered":
      case "completed":
        return "bg-gray-100 text-gray-800 border-gray-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "Order Received";
      case "preparing":
        return "Being Prepared";
      case "ready":
        return "Ready for Pickup";
      case "delivered":
      case "completed":
        return "Completed";
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-red-600 mb-4">{error || "Order not found"}</p>
            <Button onClick={() => router.push(`/${tableNumber}`)}>
              Back to Menu
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Order Status</h1>
          <Button variant="outline" onClick={() => router.push(`/${tableNumber}`)}>
            Back to Menu
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm text-gray-600">Order #{order.id}</p>
              <p className="text-sm text-gray-600">Table {order.table_number}</p>
              {order.created_at && (
                <p className="text-sm text-gray-600">
                  {new Date(order.created_at).toLocaleString()}
                </p>
              )}
            </div>
            <div className={`px-4 py-2 rounded-full border-2 font-semibold ${getStatusColor(order.status)}`}>
              {getStatusLabel(order.status)}
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <h2 className="font-semibold text-lg mb-3">Order Items</h2>
            <div className="space-y-2">
              {order.items.map((item, index) => (
                <div key={index} className="flex justify-between">
                  <div>
                    <span className="font-medium">{item.quantity}x</span>{" "}
                    {item.menu_item_name || "Item"}
                  </div>
                  <div className="text-gray-600">
                    ₹{formatPrice(item.price_at_order * item.quantity)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {order.special_instructions && (
            <div className="border-t pt-4 mt-4">
              <h3 className="font-semibold mb-2">Special Instructions</h3>
              <p className="text-gray-600">{order.special_instructions}</p>
            </div>
          )}

          <div className="border-t pt-4 mt-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-lg">Total</span>
              <span className="font-bold text-2xl">₹{formatPrice(order.total_amount)}</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm text-gray-600">Payment Method</span>
              <span className="text-sm font-medium capitalize">
                {order.payment_method} {order.payment_status ? "(Paid)" : "(Unpaid)"}
              </span>
            </div>
          </div>
        </div>

        {(order.status === "delivered" || order.status === "completed") && (
          <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6 text-center">
            <p className="text-green-800 font-semibold text-lg mb-2">
              Thank you for your order! 🎉
            </p>
            <p className="text-green-700">
              We hope you enjoyed your meal!
            </p>
          </div>
        )}

        <div className="text-center">
          <Button 
            variant="outline" 
            onClick={() => router.push(`/${tableNumber}/orders`)}
          >
            View Order History
          </Button>
        </div>
      </div>
    </div>
  );
}
