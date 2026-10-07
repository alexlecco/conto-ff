import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(price);
}

// Default thumbnail for half-and-half pizzas (stored order items lose the
// reference to the original products, so they can't resolve their own image).
export const HALF_PIZZA_IMAGE = "/images/pizza-mitad-mitad.png";

// Half-and-half pizza pricing: each half costs half the full pizza price + extra.
export const HALF_PIZZA_EXTRA = 1000;

export function halfPizzaHalfPrice(fullPrice: number): number {
  return Math.round(fullPrice / 2 + HALF_PIZZA_EXTRA);
}

export function halfPizzaTotalPrice(priceA: number, priceB: number): number {
  return halfPizzaHalfPrice(priceA) + halfPizzaHalfPrice(priceB);
}
