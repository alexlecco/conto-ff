export interface MenuItemVariant {
  id: string;
  name: string;
  price: number;
  available: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  available: boolean;
  variants: MenuItemVariant[];
}

export interface MenuCategory {
  id: string;
  name: string;
  items: MenuItem[];
}

export interface CartItem {
  product: MenuItem;
  variant: MenuItemVariant | null;
  quantity: number;
}

export interface Cart {
  items: CartItem[];
  tableNumber: number;
  customerName: string;
  customerEmail: string;
}
