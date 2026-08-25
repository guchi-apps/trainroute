import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind のクラスを結合する（後から渡したものが競合を上書きする）。 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
