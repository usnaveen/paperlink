import { NextRequest, NextResponse } from 'next/server';
import { getLinkByCode, recordClick, getAllCodes } from '@/lib/db';
import { normalizeCode } from '@/lib/code-generator';
import { findBestMatch } from '@/lib/fuzzy-match';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ code: string }> }
) {
    try {
        const { code } = await params;
        const normalizedCode = normalizeCode(code);

        // Try exact match first
        let link = await getLinkByCode(normalizedCode);
        let matchedCode = normalizedCode;

        // If not found, try fuzzy matching
        if (!link) {
            const allCodes = await getAllCodes();
            const bestMatch = findBestMatch(normalizedCode, allCodes);

            if (bestMatch) {
                link = await getLinkByCode(bestMatch);
                matchedCode = bestMatch;
            }
        }

        if (!link) {
            // Redirect to home with error
            const url = new URL('/', request.url);
            url.searchParams.set('error', 'not_found');
            url.searchParams.set('code', normalizedCode);
            return NextResponse.redirect(url);
        }

        // Record the click
        await recordClick(matchedCode);

        // Redirect to original URL
        return NextResponse.redirect(link.original_url);
    } catch (error) {
        console.error('Error in redirect:', error);
        const url = new URL('/', request.url);
        url.searchParams.set('error', 'server_error');
        return NextResponse.redirect(url);
    }
}
