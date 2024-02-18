export const timestamp = () => Date.now();

export const sleep = async (time: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, time));

export const firstOf = <T = any>(items?: T[]) =>
  items ? (items.length < 1 ? undefined : items[0]) : undefined;

export const lastOf = <T = any>(items?: T[]) =>
  items ? (items.length < 1 ? undefined : items[items.length - 1]) : undefined;

export const randomInt = (min: number, max?: number) => {
  if (!max) {
    max = min;
    min = 0;
  }
  return Math.floor(Math.random() * (max - min + 1) + min);
};

export const pickOne = <T = any>(items: T[]) =>
  items.length < 1 ? undefined : items[randomInt(items.length - 1)];

export const range = (start: number, end?: number) => {
  if (!end) {
    end = start;
    start = 0;
  }
  return Array.from({ length: end - start }, (_, index) => start + index);
};

export const toSet = <T = any>(items: T[]) => Array.from(new Set(items));

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(n, max));
}
