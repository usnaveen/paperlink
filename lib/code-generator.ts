// OCR-friendly character set - 32 characters that are easy to distinguish in handwriting
// Excluded: 0/O (look identical), 1/I/L (hard to distinguish), B/8 (similar curves), S/5 (similar), Z/2 (similar)
const CHARS = '23456789ACDEFGHJKLMNPQRTUVWXY';

/**
 * Generate a unique, OCR-friendly short code in format PL-XXX-XXX
 */
export function generateCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
    if (i === 2) code += '-';
  }
  return `PL-${code}`;
}

/**
 * Validate if a code matches the expected format
 */
export function isValidCode(code: string): boolean {
  const pattern = /^PL-[23456789ACDEFGHJKLMNPQRTUVWXY]{3}-[23456789ACDEFGHJKLMNPQRTUVWXY]{3}$/;
  return pattern.test(code.toUpperCase());
}

/**
 * Normalize a code to uppercase with proper format
 */
export function normalizeCode(code: string): string {
  return code.toUpperCase().trim();
}

/**
 * Extract potential PaperLink codes from OCR text
 */
export function extractCodes(text: string): string[] {
  const pattern = /PL-[23456789ACDEFGHJKLMNPQRTUVWXY]{3}-[23456789ACDEFGHJKLMNPQRTUVWXY]{3}/gi;
  const matches = text.toUpperCase().match(pattern) || [];
  return [...new Set(matches)]; // Remove duplicates
}

export { CHARS };
