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
import { Minus, Plus, Trash2 } from "lucide-react";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (itemId: number, quantity: number) => void;
  onRemoveItem: (itemId: number) => void;
  onCheckout: () => void;
}

export function CartDrawer({
  open,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
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
          {items.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              Your cart is empty
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {items.map((item) => (
                <div
                  key={item.menu_item_id}
                  className="flex gap-4 bg-gray-50 rounded-lg p-4"
                >
                  {item.menu_item.image ? (
                    <img
                      src={item.menu_item.image}
                      alt={item.menu_item.name}
                      className="w-20 h-20 object-cover rounded-md"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gray-200 rounded-md flex items-center justify-center">
                      <span className="text-gray-400 text-xs">No image</span>
                    </div>
                  )}

                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">
                      {item.menu_item.name}
                    </h3>
                    {item.menu_item.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {item.menu_item.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-bold text-lg">
                        ${(item.menu_item.price * item.quantity).toFixed(2)}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            onUpdateQuantity(item.menu_item_id, item.quantity - 1)
                          }
                          className="h-8 w-8 p-0"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="font-medium min-w-[30px] text-center">
                          {item.quantity}
                        </span>
                        <Button
                          size="sm"
                          onClick={() =>
                            onUpdateQuantity(item.menu_item_id, item.quantity + 1)
                          }
                          className="h-8 w-8 p-0"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => onRemoveItem(item.menu_item_id)}
                          className="h-8 w-8 p-0 ml-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
                  <span className="font-bold text-2xl">${total.toFixed(2)}</span>
                </div>
                <Button onClick={onCheckout} className="w-full h-12 text-lg">
                  Proceed to Checkout
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
