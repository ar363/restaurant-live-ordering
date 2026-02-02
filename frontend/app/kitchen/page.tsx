"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { connectKitchenWebSocket, type KitchenOrder } from "@/lib/kitchen";
import { formatPrice } from "@/lib/format";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function KitchenDashboard() {
  const router = useRouter();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffName, setStaffName] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("kitchen_token");
    const name = localStorage.getItem("kitchen_staff_name");

    if (!token) {
      router.push("/kitchen/login");
      return;
    }

    setStaffName(name || "Staff");

    // Fetch initial orders
    fetchOrders(token);

    // Connect to WebSocket
    const disconnect = connectKitchenWebSocket(token, {
      onNewOrder: (order) => {
        setOrders((prev) => [order, ...prev]);
        // Play notification sound or show toast
        console.log("New order received:", order);
      },
      onOrderUpdate: (order) => {
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? order : o))
        );
      },
      onDisconnect: () => {
        console.log("Disconnected from kitchen WebSocket");
      },
    });

    return disconnect;
  }, [router]);

  const fetchOrders = async (token: string) => {
    try {
      const { data, error } = await apiClient.GET("/api/v1/kitchen/orders", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (error || !data) {
        console.error("Failed to fetch orders:", error);
        if (error) {
          localStorage.removeItem("kitchen_token");
          localStorage.removeItem("kitchen_staff_name");
          router.push("/kitchen/login");
        }
        return;
      }

      setOrders(data as KitchenOrder[]);
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (
    orderId: number,
    newStatus: string
  ) => {
    const token = localStorage.getItem("kitchen_token");
    if (!token) return;

    try {
      const { data, error } = await apiClient.PUT(
        "/api/v1/kitchen/orders/{order_id}/status",
        {
          params: {
            path: { order_id: orderId },
          },
          body: {
            status: newStatus,
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (error) {
        console.error("Failed to update order status:", error);
        return;
      }

      // Update will come via WebSocket
    } catch (err) {
      console.error("Error updating order status:", err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("kitchen_token");
    localStorage.removeItem("kitchen_staff_name");
    router.push("/kitchen/login");
  };

  const getOrdersByStatus = (status: string) => {
    return orders.filter((order) => order.status === status);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 border-yellow-300";
      case "preparing":
        return "bg-blue-100 border-blue-300";
      case "ready":
        return "bg-green-100 border-green-300";
      case "delivered":
      case "completed":
        return "bg-gray-100 border-gray-300";
      default:
        return "bg-gray-100 border-gray-300";
    }
  };

  const getNextStatus = (currentStatus: string) => {
    switch (currentStatus) {
      case "pending":
        return "preparing";
      case "preparing":
        return "ready";
      case "ready":
        return "delivered";
      default:
        return null;
    }
  };

  const getNextStatusLabel = (currentStatus: string) => {
    switch (currentStatus) {
      case "pending":
        return "Start Preparing";
      case "preparing":
        return "Mark as Ready";
      case "ready":
        return "Complete Order";
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading kitchen dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Kitchen Dashboard
            </h1>
            <p className="text-gray-600">Welcome, {staffName}</p>
          </div>
          <Button onClick={handleLogout} variant="outline">
            Logout
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Pending Orders */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-yellow-700 flex items-center">
              Pending
              <span className="ml-2 bg-yellow-200 text-yellow-800 text-sm font-medium px-2.5 py-0.5 rounded">
                {getOrdersByStatus("pending").length}
              </span>
            </h2>
            {getOrdersByStatus("pending").map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onUpdateStatus={updateOrderStatus}
                getStatusColor={getStatusColor}
                getNextStatus={getNextStatus}
                getNextStatusLabel={getNextStatusLabel}
              />
            ))}
          </div>

          {/* Preparing Orders */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-blue-700 flex items-center">
              Preparing
              <span className="ml-2 bg-blue-200 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded">
                {getOrdersByStatus("preparing").length}
              </span>
            </h2>
            {getOrdersByStatus("preparing").map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onUpdateStatus={updateOrderStatus}
                getStatusColor={getStatusColor}
                getNextStatus={getNextStatus}
                getNextStatusLabel={getNextStatusLabel}
              />
            ))}
          </div>

          {/* Ready Orders */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-green-700 flex items-center">
              Ready
              <span className="ml-2 bg-green-200 text-green-800 text-sm font-medium px-2.5 py-0.5 rounded">
                {getOrdersByStatus("ready").length}
              </span>
            </h2>
            {getOrdersByStatus("ready").map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onUpdateStatus={updateOrderStatus}
                getStatusColor={getStatusColor}
                getNextStatus={getNextStatus}
                getNextStatusLabel={getNextStatusLabel}
              />
            ))}
          </div>

          {/* Completed/Delivered Orders */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-700 flex items-center">
              Completed
              <span className="ml-2 bg-gray-200 text-gray-800 text-sm font-medium px-2.5 py-0.5 rounded">
                {[...getOrdersByStatus("delivered"), ...getOrdersByStatus("completed")].length}
              </span>
            </h2>
            {[...getOrdersByStatus("delivered"), ...getOrdersByStatus("completed")].map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onUpdateStatus={updateOrderStatus}
                getStatusColor={getStatusColor}
                getNextStatus={getNextStatus}
                getNextStatusLabel={getNextStatusLabel}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface OrderCardProps {
  order: KitchenOrder;
  onUpdateStatus: (orderId: number, newStatus: string) => void;
  getStatusColor: (status: string) => string;
  getNextStatus: (currentStatus: string) => string | null;
  getNextStatusLabel: (currentStatus: string) => string | null;
}

function OrderCard({
  order,
  onUpdateStatus,
  getStatusColor,
  getNextStatus,
  getNextStatusLabel,
}: OrderCardProps) {
  const nextStatus = getNextStatus(order.status);
  const nextLabel = getNextStatusLabel(order.status);

  return (
    <div
      className={`border-2 rounded-lg p-4 ${getStatusColor(
        order.status
      )} space-y-3`}
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="text-lg font-bold">Order #{order.id}</div>
          <div className="text-sm text-gray-600">Table {order.table_number}</div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              ⋮
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={() => onUpdateStatus(order.id, "cancelled")}
              className="text-red-600"
            >
              Cancel Order
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-1">
        {order.items.map((item) => (
          <div key={item.id} className="text-sm">
            <span className="font-medium">{item.quantity}x</span>{" "}
            {item.menu_item_name || "Unknown Item"}
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center pt-2 border-t border-gray-300">
        <div className="text-sm">
          <div className="font-semibold">₹{formatPrice(order.total_amount)}</div>
          <div className="text-gray-600 capitalize">
            {order.payment_method}
            {order.payment_status ? " (Paid)" : " (Unpaid)"}
          </div>
        </div>
        {nextStatus && nextLabel && (
          <Button
            size="sm"
            onClick={() => onUpdateStatus(order.id, nextStatus)}
          >
            {nextLabel}
          </Button>
        )}
      </div>

      <div className="text-xs text-gray-500">
        {order.created_at ? new Date(order.created_at).toLocaleTimeString() : ""}
      </div>
    </div>
  );
}
