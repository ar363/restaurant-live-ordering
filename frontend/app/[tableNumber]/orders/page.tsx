"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiClient, auth } from "@/lib/api";
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
  created_at?: string | null;
  items: OrderItem[];
}

export default function OrderHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const tableNumber = params.tableNumber as string;
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const isAuthenticated = auth.isAuthenticated();
    if (!isAuthenticated) {
      router.push(`/${tableNumber}`);
      return;
    }

    fetchOrders();
  }, [tableNumber]);

  const fetchOrders = async () => {
    try {
      const { data, error: apiError } = await apiClient.GET("/api/v1/orders");

      if (apiError || !data) {
        setError("Failed to fetch orders");
        setLoading(false);
        return;
      }

      // Sort by created_at descending (newest first)
      const sortedOrders = (data as Order[]).sort((a, b) => {
        if (!a.created_at || !b.created_at) return 0;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setOrders(sortedOrders);
      setLoading(false);
    } catch (err) {
      setError("An error occurred");
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "preparing":
        return "bg-blue-100 text-blue-800";
      case "ready":
        return "bg-green-100 text-green-800";
      case "delivered":
      case "completed":
        return "bg-gray-100 text-gray-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-red-600 mb-4">{error}</p>
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
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Order History</h1>
          <Button variant="outline" onClick={() => router.push(`/${tableNumber}`)}>
            Back to Menu
          </Button>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-600 text-lg mb-4">No orders yet</p>
            <Button onClick={() => router.push(`/${tableNumber}`)}>
              Browse Menu
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/${tableNumber}/order/${order.id}`)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="font-semibold text-lg">Order #{order.id}</p>
                    <p className="text-sm text-gray-600">Table {order.table_number}</p>
                    {order.created_at && (
                      <p className="text-sm text-gray-600">
                        {new Date(order.created_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                    <span className="font-bold text-lg">₹{formatPrice(order.total_amount)}</span>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="space-y-1">
                    {order.items.map((item, index) => (
                      <div key={index} className="text-sm text-gray-700">
                        <span className="font-medium">{item.quantity}x</span>{" "}
                        {item.menu_item_name || "Item"}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-3 mt-3 flex justify-between text-sm">
                  <span className="text-gray-600 capitalize">
                    {order.payment_method} {order.payment_status ? "(Paid)" : "(Unpaid)"}
                  </span>
                  <span className="text-blue-600 font-medium">View Details →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
