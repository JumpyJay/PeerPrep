// matching.utils.ts
export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export function normalizeDifficulty(input: unknown): Difficulty | null {
  if (typeof input !== "string") return null;
  const s = input.trim();
  // already canonical?
  if (s === "EASY" || s === "MEDIUM" || s === "HARD") return s;
  // friendly → canonical
  const m = { easy: "EASY", medium: "MEDIUM", hard: "HARD" } as const;
  const key = s.toLowerCase() as keyof typeof m;
  return m[key] ?? null;
}

export function assertDifficulty(d: unknown): asserts d is Difficulty {
  const n = normalizeDifficulty(d);
  if (!n) throw new Error(`Invalid difficulty: ${String(d)}`);
}
