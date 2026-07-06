import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Optional Supabase configuration.
 *
 * KitaMo is local-first: the app never requires Supabase to open or work.
 * Credentials come from PUBLIC env vars only; nothing is hardcoded and no
 * secret (service-role key) is ever used in the mobile app. When the env vars
 * are absent, everything here reports "disabled" and no client is created —
 * so the app runs exactly as before with no network calls.
 */

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";

export function isSupabaseConfigured(): boolean {
  return supabaseUrl.length > 0 && supabaseAnonKey.length > 0;
}

let cachedClient: SupabaseClient | null = null;
let creationFailed = false;

/**
 * Returns a memoized Supabase client, or null when Supabase is not configured
 * or the client could not be created. Never throws.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured() || creationFailed) {
    return null;
  }

  if (cachedClient) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // No auth/session persistence yet — this is a connection foundation
        // only. Cloud sync and login arrive in Chapter 3.
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return cachedClient;
  } catch {
    creationFailed = true;
    return null;
  }
}

export function getSupabaseConfigSummary() {
  return {
    configured: isSupabaseConfigured(),
    hasUrl: supabaseUrl.length > 0,
    hasAnonKey: supabaseAnonKey.length > 0,
  };
}
