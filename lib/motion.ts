import type { CSSProperties } from "react";

// Delays an item's entrance by a few steps: stagger(0) starts first, stagger(3) a little later.
// Use it as style={stagger(i)} next to className="enter".
export function stagger(index: number, cap = 8): CSSProperties {
  return { "--i": Math.max(0, Math.min(index, cap)) } as CSSProperties;
}