"use client";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CartItem, getCartTotal, getCartItemCount } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { getMediaUrl } from "@/lib/api";
import { Minus, Plus, Trash2 } from "lucide-react";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (itemId: number, quantity: number) => void;
  onRemoveItem: (itemId: number) => void;
  onCheckout: () => void;
  isCheckoutInProgress?: boolean;
}

export function CartDrawer({
  open,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  isCheckoutInProgress = false,
}: CartDrawerProps) {
  const total = getCartTotal(items);
  const itemCount = getCartItemCount(items);

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-2xl font-bold">
            Your Cart ({itemCount} {itemCount === 1 ? "item" : "items"})
          </DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-6 max-h-[60vh]">
          {isCheckoutInProgress && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 font-medium text-center">
                🛒 Checkout in progress on another device
              </p>
              <p className="text-yellow-700 text-sm text-center mt-1">
                Cart is temporarily locked
              </p>
            </div>
          )}
          
          {items.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              Your cart is empty
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {items.map((item) => {
                const imageUrl = getMediaUrl(item.menu_item.image);
                return (
                <div
                  key={item.menu_item_id}
                  className="flex gap-3 sm:gap-4 bg-gray-50 rounded-lg p-3 sm:p-4"
                >
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={item.menu_item.name}
                      className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-md flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-200 rounded-md flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-400 text-xs">No image</span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base sm:text-lg">
                      {item.menu_item.name}
                    </h3>
                    {item.menu_item.description && (
                      <p className="text-xs sm:text-sm text-gray-600 line-clamp-1 sm:line-clamp-2">
                        {item.menu_item.description}
                      </p>
                    )}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-2">
                      <span className="font-bold text-base sm:text-lg">
                        ₹{formatPrice(item.menu_item.price * item.quantity)}
                      </span>
                      <div className="flex items-center justify-between sm:justify-end gap-2">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              onUpdateQuantity(item.menu_item_id, item.quantity - 1)
                            }
                            className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                            disabled={isCheckoutInProgress}
                          >
                            <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                          <span className="font-medium min-w-[24px] sm:min-w-[30px] text-center text-sm sm:text-base">
                            {item.quantity}
                          </span>
                          <Button
                            size="sm"
                            onClick={() =>
                              onUpdateQuantity(item.menu_item_id, item.quantity + 1)
                            }
                            className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                            disabled={isCheckoutInProgress}
                          >
                            <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => onRemoveItem(item.menu_item_id)}
                          className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                          disabled={isCheckoutInProgress}
                        >
                          <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );})}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <>
            <Separator />
            <DrawerFooter className="px-6 py-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center text-lg">
                  <span className="font-semibold">Total:</span>
                  <span className="font-bold text-2xl">₹{formatPrice(total)}</span>
                </div>
                <Button 
                  onClick={onCheckout} 
                  className="w-full h-12 text-lg"
                  disabled={isCheckoutInProgress}
                >
                  {isCheckoutInProgress ? "Checkout in Progress..." : "Proceed to Checkout"}
                </Button>
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="w-full h-12"
                >
                  Continue Shopping
                </Button>
              </div>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
