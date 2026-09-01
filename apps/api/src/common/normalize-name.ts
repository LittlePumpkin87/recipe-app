/** Turns a display name into the value stored in ingredient.name_normalized.
Seed and service must both call this — the unique index compares what it is
given, it does not normalize on its own. */
export function normalizeIngredientName(name: string): string {
  return name
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
