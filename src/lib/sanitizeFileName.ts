/**
 * Sanitize a file name for Supabase Storage:
 * transliterate Cyrillic, replace non-ASCII and special chars with underscores.
 */
export function sanitizeFileName(name: string): string {
  const cyrillic: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh",
    з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
    п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
    ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu",
    я: "ya", і: "i", ї: "yi", є: "ye", ґ: "g",
  };

  let result = "";
  for (const char of name) {
    const lower = char.toLowerCase();
    if (cyrillic[lower] !== undefined) {
      const mapped = cyrillic[lower];
      result += char === lower ? mapped : mapped.charAt(0).toUpperCase() + mapped.slice(1);
    } else {
      result += char;
    }
  }

  // Replace any remaining non-ASCII or problematic chars (keep dots, dashes, underscores)
  return result.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g, "_");
}
