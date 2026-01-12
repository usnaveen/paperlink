import { createClient } from '@supabase/supabase-js';

// Supabase configuration
// You need to set these environment variables:
// NEXT_PUBLIC_SUPABASE_URL - Your Supabase project URL
// SUPABASE_SERVICE_ROLE_KEY - Your Supabase service role key (for server-side)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create Supabase client
const supabase = supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

// Log database status
if (supabase) {
    console.log('✅ Database: Connected to Supabase');
} else {
    console.log('⚠️ Database: Using in-memory storage (data will be lost on restart)');
    console.log('   To persist data, set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
}

// Fallback in-memory storage if Supabase not configured
const memoryLinks = new Map<string, Link>();
let memoryIdCounter = 1;

export interface Link {
    id: number;
    short_code: string;
    original_url: string;
    created_at: string;
    click_count: number;
    last_accessed: string | null;
    user_id?: string;
}

/**
 * Create a new shortened link
 */
export async function createLink(shortCode: string, originalUrl: string, userId?: string): Promise<Link> {
    if (supabase) {
        const payload: any = {
            short_code: shortCode,
            original_url: originalUrl,
        };

        if (userId) {
            payload.user_id = userId;
        }

        const { data, error } = await supabase
            .from('links')
            .insert(payload)
            .select()
            .single();

        if (error) {
            console.error('Supabase insert error:', error);
            throw new Error('Failed to create link');
        }

        return data as Link;
    }

    // Fallback to in-memory
    const link: Link = {
        id: memoryIdCounter++,
        short_code: shortCode,
        original_url: originalUrl,
        created_at: new Date().toISOString(),
        click_count: 0,
        last_accessed: null,
        user_id: userId // Save in memory too
    };
    memoryLinks.set(shortCode, link);
    return link;
}

/**
 * Get a link by its short code
 */
export async function getLinkByCode(shortCode: string): Promise<Link | undefined> {
    if (supabase) {
        const { data, error } = await supabase
            .from('links')
            .select('*')
            .eq('short_code', shortCode)
            .single();

        if (error || !data) {
            return undefined;
        }

        return data as Link;
    }

    // Fallback to in-memory
    return memoryLinks.get(shortCode);
}

/**
 * Check if a code already exists
 */
export async function codeExists(shortCode: string): Promise<boolean> {
    const link = await getLinkByCode(shortCode);
    return link !== undefined;
}

/**
 * Find an existing link for a user and URL to prevent duplicates
 */
export async function getLinkByUserAndUrl(userId: string | undefined, url: string): Promise<Link | undefined> {
    if (supabase) {
        let query = supabase
            .from('links')
            .select('*')
            .eq('original_url', url);

        if (userId) {
            query = query.eq('user_id', userId);
        } else {
            // For anonymous users, arguably we should not return duplicates 
            // OR we check for links with NULL user_id?
            // For now, let's only deduplicate for logged-in users to respect privacy
            return undefined;
        }

        const { data, error } = await query.single();

        if (error || !data) {
            return undefined;
        }

        return data as Link;
    }

    // Fallback to in-memory (simple check)
    if (!userId) return undefined;

    return Array.from(memoryLinks.values()).find(
        link => link.original_url === url && link.user_id === userId
    );
}

/**
 * Increment click count and update last accessed time
 */
export async function recordClick(shortCode: string): Promise<void> {
    if (supabase) {
        // Get current link
        const { data: link } = await supabase
            .from('links')
            .select('click_count')
            .eq('short_code', shortCode)
            .single();

        if (link) {
            await supabase
                .from('links')
                .update({
                    click_count: (link.click_count || 0) + 1,
                    last_accessed: new Date().toISOString(),
                })
                .eq('short_code', shortCode);
        }
        return;
    }

    // Fallback to in-memory
    const link = memoryLinks.get(shortCode);
    if (link) {
        link.click_count++;
        link.last_accessed = new Date().toISOString();
    }
}

/**
 * Get all short codes (for fuzzy matching)
 */
export async function getAllCodes(): Promise<string[]> {
    if (supabase) {
        const { data } = await supabase
            .from('links')
            .select('short_code');

        return (data || []).map((row: { short_code: string }) => row.short_code);
    }

    // Fallback to in-memory
    return Array.from(memoryLinks.keys());
}

/**
 * Get recent links for display
 */
export async function getRecentLinks(limit: number = 10): Promise<Link[]> {
    if (supabase) {
        const { data } = await supabase
            .from('links')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        return (data || []) as Link[];
    }

    // Fallback to in-memory
    return Array.from(memoryLinks.values())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, limit);
}
