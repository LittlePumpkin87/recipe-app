/** Turns a display name into the value stored in `ingredient.name_normalized`. */
export function normalizeIngredientName(name: string): string {
    return name.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
}
