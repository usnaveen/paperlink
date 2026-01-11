import { CHARS } from './code-generator';

// Common OCR misreadings and their likely intended characters
const OCR_CORRECTIONS: Record<string, string[]> = {
    '0': ['Q', 'D'],
    'O': ['Q', 'D'],
    '1': ['L', 'T'],
    'I': ['L', 'T'],
    'L': ['1', 'I'],
    '8': ['B', 'R'],
    'B': ['8', 'R'],
    '5': ['S', 'F'],
    'S': ['5', 'F'],
    'Z': ['2', '7'],
    '2': ['Z', '7'],
};

/**
 * Generate all possible corrections for a code with OCR errors
 * Returns array of candidate codes sorted by likelihood
 */
export function generateCandidates(rawCode: string): string[] {
    const candidates: Set<string> = new Set();
    const normalized = rawCode.toUpperCase().replace(/[^A-Z0-9-]/g, '');

    // Add the original (normalized) code
    candidates.add(normalized);

    // Generate single-character corrections
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized[i];
        if (char === '-') continue;

        const corrections = OCR_CORRECTIONS[char];
        if (corrections) {
            for (const correction of corrections) {
                if (CHARS.includes(correction)) {
                    const corrected = normalized.slice(0, i) + correction + normalized.slice(i + 1);
                    candidates.add(corrected);
                }
            }
        }
    }

    return Array.from(candidates);
}

/**
 * Calculate edit distance between two strings (Levenshtein distance)
 */
export function editDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (s1[i - 1] === s2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }
    }

    return dp[m][n];
}

/**
 * Find the best matching code from database given OCR result
 */
export function findBestMatch(
    ocrResult: string,
    validCodes: string[],
    maxDistance: number = 2
): string | null {
    const candidates = generateCandidates(ocrResult);

    // First, check for exact matches
    for (const candidate of candidates) {
        if (validCodes.includes(candidate)) {
            return candidate;
        }
    }

    // Then, find closest match within edit distance
    let bestMatch: string | null = null;
    let bestDistance = maxDistance + 1;

    for (const validCode of validCodes) {
        for (const candidate of candidates) {
            const distance = editDistance(candidate, validCode);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestMatch = validCode;
            }
        }
    }

    return bestDistance <= maxDistance ? bestMatch : null;
}
