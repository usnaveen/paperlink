import { NextRequest, NextResponse } from 'next/server';
import { getLinkByCode, getAllCodes } from '@/lib/db';
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

        // If not found, try fuzzy matching
        if (!link) {
            const allCodes = await getAllCodes();
            const bestMatch = findBestMatch(normalizedCode, allCodes);

            if (bestMatch) {
                link = await getLinkByCode(bestMatch);
            }
        }

        if (!link) {
            return NextResponse.json(
                { error: 'Code not found', code: normalizedCode },
                { status: 404 }
            );
        }

        return NextResponse.json({
            code: link.short_code,
            url: link.original_url,
            clickCount: link.click_count,
            createdAt: link.created_at,
        });
    } catch (error) {
        console.error('Error resolving code:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
