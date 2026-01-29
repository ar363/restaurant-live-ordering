"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Home() {
  const router = useRouter();
  const [tableNumber, setTableNumber] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tableNumber.trim()) {
      router.push(`/${tableNumber.trim()}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold text-gray-900">
              Welcome to Our Restaurant
            </h1>
            <p className="text-gray-600">
              Order delicious food right from your table
            </p>
          </div>

          {/* Illustration or Icon */}
          <div className="flex justify-center py-6">
            <div className="w-32 h-32 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center">
              <svg
                className="w-16 h-16 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
          </div>

          {/* Table Number Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="table-number" className="text-lg font-medium">
                Enter Your Table Number
              </Label>
              <Input
                id="table-number"
                type="text"
                placeholder="e.g., 5"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className="text-lg h-12"
                required
              />
            </div>
            <Button type="submit" className="w-full h-12 text-lg" size="lg">
              View Menu
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
