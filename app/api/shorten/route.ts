import { NextRequest, NextResponse } from 'next/server';
import { generateCode } from '@/lib/code-generator';
import { createLink, codeExists, getLinkByUserAndUrl } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { url, userId } = body;

        // Validate URL
        if (!url || typeof url !== 'string') {
            return NextResponse.json(
                { error: 'URL is required' },
                { status: 400 }
            );
        }

        // Basic URL validation
        try {
            new URL(url);
        } catch {
            return NextResponse.json(
                { error: 'Invalid URL format' },
                { status: 400 }
            );
        }

        // Check if link already exists for this user
        // This prevents duplicate entries and keeps the dashboard clean
        if (userId) {
            const existingLink = await getLinkByUserAndUrl(userId, url);
            if (existingLink) {
                const host = request.headers.get('host') || 'localhost:3000';
                const protocol = request.headers.get('x-forwarded-proto') || 'http';
                const shortUrl = `${protocol}://${host}/r/${existingLink.short_code}`;

                return NextResponse.json({
                    code: existingLink.short_code,
                    shortUrl,
                    originalUrl: existingLink.original_url,
                    createdAt: existingLink.created_at,
                    isExisting: true
                });
            }
        }

        // Generate unique code (retry if collision)
        let shortCode = generateCode();
        let attempts = 0;
        const maxAttempts = 10;

        while (await codeExists(shortCode) && attempts < maxAttempts) {
            shortCode = generateCode();
            attempts++;
        }

        if (attempts >= maxAttempts) {
            return NextResponse.json(
                { error: 'Failed to generate unique code' },
                { status: 500 }
            );
        }

        // Create the link
        const link = await createLink(shortCode, url, userId);

        // Build the short URL
        const host = request.headers.get('host') || 'localhost:3000';
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        const shortUrl = `${protocol}://${host}/r/${shortCode}`;

        return NextResponse.json({
            code: shortCode,
            shortUrl,
            originalUrl: link.original_url,
            createdAt: link.created_at,
        });
    } catch (error) {
        console.error('Error creating short link:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
