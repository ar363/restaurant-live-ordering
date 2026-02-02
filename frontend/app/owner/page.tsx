"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";

interface DashboardStats {
  revenue_trends: { time: string; revenue: number }[];
  revenue_by_payment: Record<string, number>;
  revenue_by_hour: { hour: number; revenue: number }[];
  top_items: { name: string; quantity: number; revenue: number }[];
  revenue_by_category: { category: string; revenue: number }[];
  low_performers: { name: string; quantity: number; revenue: number }[];
  avg_items_per_order: number;
  unique_customers: number;
  repeat_customer_rate: number;
  customer_lifetime_value: number;
  period_comparison: {
    current_revenue: number;
    previous_revenue: number;
    revenue_change_percent: number;
    current_orders: number;
    previous_orders: number;
    order_change_percent: number;
  };
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function OwnerDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");
  const [ownerName, setOwnerName] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("owner_token");
    const name = localStorage.getItem("owner_name");
    
    if (!token) {
      router.push("/owner/login");
      return;
    }
    
    setOwnerName(name || "Owner");
    fetchStats(period);
  }, [period]);

  const fetchStats = async (selectedPeriod: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("owner_token");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/owner/analytics?period=${selectedPeriod}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch stats");
      }

      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Error fetching stats:", error);
      // If unauthorized, redirect to login
      localStorage.removeItem("owner_token");
      localStorage.removeItem("owner_name");
      router.push("/owner/login");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("owner_token");
    localStorage.removeItem("owner_name");
    router.push("/owner/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">Loading dashboard...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-red-600">Failed to load dashboard</div>
      </div>
    );
  }

  // Transform payment data for pie chart
  const paymentData = Object.entries(stats.revenue_by_payment).map(([key, value]) => ({
    name: key.toUpperCase(),
    value: value,
  }));

  // Transform revenue by hour to include all 24 hours
  const allHoursData = Array.from({ length: 24 }, (_, i) => {
    const hourData = stats.revenue_by_hour.find((h) => h.hour === i);
    return {
      hour: i,
      revenue: hourData ? hourData.revenue : 0,
    };
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Owner Dashboard</h1>
              <p className="text-sm text-gray-600">Welcome back, {ownerName}</p>
            </div>
            <Button onClick={handleLogout} variant="outline">
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Period Selector */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-2 mb-6">
          <Button
            onClick={() => setPeriod("today")}
            variant={period === "today" ? "default" : "outline"}
          >
            Today
          </Button>
          <Button
            onClick={() => setPeriod("week")}
            variant={period === "week" ? "default" : "outline"}
          >
            This Week
          </Button>
          <Button
            onClick={() => setPeriod("month")}
            variant={period === "month" ? "default" : "outline"}
          >
            This Month
          </Button>
        </div>

        {/* Period Comparison Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Revenue</h3>
            <p className="text-3xl font-bold text-gray-900">
              ₹{stats.period_comparison.current_revenue.toFixed(2)}
            </p>
            <p
              className={`text-sm mt-2 ${
                stats.period_comparison.revenue_change_percent >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {stats.period_comparison.revenue_change_percent >= 0 ? "↑" : "↓"}{" "}
              {Math.abs(stats.period_comparison.revenue_change_percent).toFixed(1)}% vs previous{" "}
              {period}
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Orders</h3>
            <p className="text-3xl font-bold text-gray-900">
              {stats.period_comparison.current_orders}
            </p>
            <p
              className={`text-sm mt-2 ${
                stats.period_comparison.order_change_percent >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {stats.period_comparison.order_change_percent >= 0 ? "↑" : "↓"}{" "}
              {Math.abs(stats.period_comparison.order_change_percent).toFixed(1)}% vs previous{" "}
              {period}
            </p>
          </div>
        </div>

        {/* Revenue Trends */}
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Revenue Trends</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.revenue_trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip formatter={(value: number | undefined) => value ? `₹${value.toFixed(2)}` : '₹0.00'} />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Customer Insights - Full Row Horizontal */}
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Customer Insights</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">Unique Customers</p>
              <p className="text-2xl font-bold text-blue-600">{stats.unique_customers}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600">Repeat Customer Rate</p>
              <p className="text-2xl font-bold text-green-600">
                {stats.repeat_customer_rate.toFixed(1)}%
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600">Customer Lifetime Value</p>
              <p className="text-2xl font-bold text-purple-600">
                ₹{stats.customer_lifetime_value.toFixed(2)}
              </p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-gray-600">Avg Items per Order</p>
              <p className="text-2xl font-bold text-orange-600">
                {stats.avg_items_per_order.toFixed(1)}
              </p>
            </div>
          </div>
        </div>

        {/* Revenue by Hour */}
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Revenue by Hour</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={allHoursData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" tickFormatter={(hour) => `${hour}:00`} />
              <YAxis />
              <Tooltip
                formatter={(value: number | undefined) => value ? `₹${value.toFixed(2)}` : '₹0.00'}
                labelFormatter={(hour) => `${hour}:00`}
              />
              <Bar dataKey="revenue" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Menu Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Top Selling Items */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Top Selling Items</h2>
            <div className="space-y-3">
              {stats.top_items.length > 0 ? (
                stats.top_items.map((item, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-500">{item.quantity} sold</p>
                    </div>
                    <p className="font-semibold text-green-600">₹{item.revenue.toFixed(2)}</p>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">No sales data available</p>
              )}
            </div>
          </div>

          {/* Low Performers */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Low Performers</h2>
            <div className="space-y-3">
              {stats.low_performers.length > 0 ? (
                stats.low_performers.map((item, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-500">{item.quantity} sold</p>
                    </div>
                    <p className="font-semibold text-orange-600">₹{item.revenue.toFixed(2)}</p>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">No data available</p>
              )}
            </div>
          </div>
        </div>

        {/* Revenue by Payment Method & Revenue by Category */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Payment Method Breakdown */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Revenue by Payment Method
            </h2>
            {paymentData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={paymentData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${percent ? (percent * 100).toFixed(0) : 0}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {paymentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number | undefined) => value ? `₹${value.toFixed(2)}` : '₹0.00'} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-12">No payment data available</p>
            )}
          </div>

          {/* Revenue by Category */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Revenue by Category</h2>
            {stats.revenue_by_category.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.revenue_by_category}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip formatter={(value: number | undefined) => value ? `₹${value.toFixed(2)}` : '₹0.00'} />
                  <Bar dataKey="revenue" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-12">No category data available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
