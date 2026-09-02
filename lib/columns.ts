/** Converts a 0-indexed column position to its A1-notation letter (0 -> "A", 26 -> "AA"). */
export function columnLetter(index0: number): string {
  let n = index0 + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Converts an A1-notation column letter to its 0-indexed position ("A" -> 0, "AA" -> 26). */
export function columnIndex(letter: string): number {
  let n = 0;
  for (const ch of letter.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}
