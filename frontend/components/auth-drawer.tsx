"use client";

import { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiClient, auth } from "@/lib/api";

type AuthMode = "phone" | "existing-pin" | "new-pin";

interface AuthDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AuthDrawer({ open, onClose, onSuccess }: AuthDrawerProps) {
  const [mode, setMode] = useState<AuthMode>("phone");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Check if user exists
      const { data, error: checkError } = await apiClient.POST("/api/v1/auth/check-user", {
        params: {
          query: {
            username: phone,
          },
        },
      });

      if (checkError) {
        setError("An error occurred. Please try again.");
        setLoading(false);
        return;
      }

      if (data?.exists) {
        // User exists, ask for PIN
        setMode("existing-pin");
      } else {
        // New user, show registration
        setMode("new-pin");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleExistingPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data, error: loginError } = await apiClient.POST("/api/v1/auth/login", {
        body: {
          username: phone,
          password: pin,
        },
      });

      if (loginError || !data) {
        setError("Invalid PIN. Please try again.");
        setLoading(false);
        return;
      }

      // Store token
      const token = (data as any).token;
      if (token) {
        auth.setToken(token);
        onSuccess();
        onClose();
      } else {
        setError("Login failed. Please try again.");
      }
    } catch (err) {
      setError("Invalid PIN. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleNewPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (pin !== confirmPin) {
      setError("PINs do not match");
      setLoading(false);
      return;
    }

    if (pin.length < 4) {
      setError("PIN must be at least 4 digits");
      setLoading(false);
      return;
    }

    if (!name.trim()) {
      setError("Please enter your name");
      setLoading(false);
      return;
    }

    try {
      const { data, error: registerError } = await apiClient.POST("/api/v1/auth/register", {
        body: {
          username: phone,
          email: `${phone}@restaurant.local`,
          password: pin,
        },
      });

      if (registerError || !data) {
        setError("Registration failed. Please try again.");
        setLoading(false);
        return;
      }

      // Store token
      const token = (data as any).token;
      if (token) {
        auth.setToken(token);
        onSuccess();
        onClose();
      } else {
        setError("Registration failed. Please try again.");
      }
    } catch (err) {
      setError("Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setMode("phone");
    setPhone("");
    setPin("");
    setName("");
    setConfirmPin("");
    setError("");
  };

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-2xl font-bold">Welcome!</DrawerTitle>
        </DrawerHeader>
        <div className="p-6 pt-0">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          {mode === "phone" && (
            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Enter your phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  disabled={loading}
                  className="mt-1"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Checking..." : "Continue"}
              </Button>
            </form>
          )}

          {mode === "existing-pin" && (
            <form onSubmit={handleExistingPinSubmit} className="space-y-4">
              <div>
                <Label htmlFor="phone-display">Phone Number</Label>
                <Input
                  id="phone-display"
                  type="text"
                  value={phone}
                  disabled
                  className="mt-1 bg-gray-50"
                />
              </div>
              <div>
                <Label htmlFor="pin">Enter PIN</Label>
                <div className="mt-2 flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={pin}
                    onChange={setPin}
                    disabled={loading}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  disabled={loading}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? "Logging in..." : "Login"}
                </Button>
              </div>
            </form>
          )}

          {mode === "new-pin" && (
            <form onSubmit={handleNewPinSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Your Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="new-pin">Create PIN</Label>
                <div className="mt-2 flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={pin}
                    onChange={setPin}
                    disabled={loading}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
              <div>
                <Label htmlFor="confirm-pin">Confirm PIN</Label>
                <div className="mt-2 flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={confirmPin}
                    onChange={setConfirmPin}
                    disabled={loading}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  disabled={loading}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
