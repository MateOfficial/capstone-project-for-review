import { useState, useEffect, useCallback } from 'react';

export interface CartItem {
  id: number;
  code: string;
  name: string;
  category: string;
  price: number;
  discount: number | null;
  discountedPrice: number | null;
  quantity: number;
}

const CART_KEY = 'platform_cart';

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCart(items: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(loadCart);

  useEffect(() => { saveCart(items); }, [items]);

  // Listen for changes from other tabs/components
  useEffect(() => {
    const handler = () => setItems(loadCart());
    window.addEventListener('storage', handler);
    window.addEventListener('cart-updated', handler);
    return () => { window.removeEventListener('storage', handler); window.removeEventListener('cart-updated', handler); };
  }, []);

  const addItem = useCallback((product: Omit<CartItem, 'quantity'>) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === product.id);
      const next = existing
        ? prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
        : [...prev, { ...product, quantity: 1 }];
      saveCart(next);
      window.dispatchEvent(new Event('cart-updated'));
      return next;
    });
  }, []);

  const updateQuantity = useCallback((id: number, quantity: number) => {
    setItems(prev => {
      const next = quantity <= 0 ? prev.filter(i => i.id !== id) : prev.map(i => i.id === id ? { ...i, quantity } : i);
      saveCart(next);
      window.dispatchEvent(new Event('cart-updated'));
      return next;
    });
  }, []);

  const removeItem = useCallback((id: number) => {
    setItems(prev => {
      const next = prev.filter(i => i.id !== id);
      saveCart(next);
      window.dispatchEvent(new Event('cart-updated'));
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    saveCart([]);
    window.dispatchEvent(new Event('cart-updated'));
  }, []);

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce((s, i) => s + (i.discountedPrice ?? i.price) * i.quantity, 0);

  return { items, addItem, updateQuantity, removeItem, clearCart, totalItems, totalPrice };
}
