import { createClient } from '@supabase/supabase-js';

// Client-side Supabase client for auth
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create a browser-safe Supabase client
export const supabase = supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

// Google Sign In
export async function signInWithGoogle() {
    if (!supabase) {
        console.error('Supabase not configured');
        return { error: new Error('Authentication not configured') };
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: typeof window !== 'undefined'
                ? `${window.location.origin}/auth/callback`
                : undefined,
        },
    });

    return { data, error };
}

export async function signOut() {
    if (!supabase) return { error: new Error('Not configured') };
    return await supabase.auth.signOut();
}

export async function getUser() {
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

export async function getSession() {
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

// Subscribe to auth changes
export function onAuthStateChange(callback: (event: string, session: any) => void) {
    if (!supabase) return { data: { subscription: { unsubscribe: () => { } } } };
    return supabase.auth.onAuthStateChange(callback);
}
