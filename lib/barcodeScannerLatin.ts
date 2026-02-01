/**
 * Barcode/Serial scanner input: force Latin (English) output
 * regardless of system keyboard language (Arabic/Windows/Mac).
 * ZKB and other HID scanners "type" as keyboard; when OS is Arabic
 * they produce Arabic characters. We use physical key codes (event.code)
 * to always get Latin, and normalize pasted Arabic text to Latin.
 */

/** Special key handling */
export const SCANNER_KEY = {
  ENTER: '\n',
  BACKSPACE: '\b',
} as const;

/**
 * Map physical key (event.code) to Latin character.
 * Use this on keydown to get English output even when keyboard layout is Arabic.
 */
export function getLatinCharFromKeyEvent(e: KeyboardEvent): string | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;

  if (e.key === 'Enter') return SCANNER_KEY.ENTER;
  if (e.key === 'Backspace') return SCANNER_KEY.BACKSPACE;

  const code = e.code;
  if (!code) return null;

  if (code.startsWith('Digit') && code.length === 6) {
    const n = code[5];
    if (n >= '0' && n <= '9') return e.shiftKey ? n : n;
  }
  if (code.startsWith('Numpad') && code.length >= 7) {
    const rest = code.slice(6);
    if (rest === '0' || rest === '1' || rest === '2' || rest === '3' || rest === '4' ||
        rest === '5' || rest === '6' || rest === '7' || rest === '8' || rest === '9') {
      return rest;
    }
    if (rest === 'Add') return '+';
    if (rest === 'Subtract') return '-';
    if (rest === 'Decimal') return '.';
  }
  if (code.startsWith('Key') && code.length === 4) {
    const letter = code[3].toLowerCase();
    if (letter >= 'a' && letter <= 'z') {
      return e.shiftKey ? letter.toUpperCase() : letter;
    }
  }

  if (code === 'Space') return ' ';
  if (code === 'Minus') return e.shiftKey ? '_' : '-';
  if (code === 'Period') return '.';
  if (code === 'Comma') return ',';
  if (code === 'Slash') return '/';
  if (code === 'Backslash') return '\\';
  if (code === 'Quote') return e.shiftKey ? '"' : "'";
  if (code === 'BracketLeft') return e.shiftKey ? '{' : '[';
  if (code === 'BracketRight') return e.shiftKey ? '}' : ']';
  if (code === 'Semicolon') return e.shiftKey ? ':' : ';';
  if (code === 'Equal') return e.shiftKey ? '+' : '=';

  return null;
}

/** Arabic numerals + letters (same key as Latin on Arabic keyboard) → Latin. */
const ARABIC_TO_LATIN: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  'ق': 'q', 'و': 'w', 'ر': 'e', 'ت': 't', 'ي': 'y', 'ى': 'y', 'ء': 'u', 'ؤ': 'u', 'ئ': 'i', 'أ': 'o', 'إ': 'o', 'آ': 'p', 'ة': 'p',
  'ش': 'a', 'ص': 's', 'ض': 'd', 'ط': 'f', 'ظ': 'g', 'ح': 'h', 'خ': 'j', 'ج': 'j', 'م': 'k', 'ل': 'l', 'ز': 'z', 'س': 'x', 'ث': 'c', 'ب': 'b', 'ن': 'n',
};

/**
 * Normalize pasted or already-typed text: Arabic numerals and letters → Latin.
 * Use when pasting into barcode/serial fields or as fallback.
 */
export function normalizeBarcodeInput(str: string): string {
  if (!str || typeof str !== 'string') return str;
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    out += ARABIC_TO_LATIN[c] ?? c;
  }
  return out;
}
