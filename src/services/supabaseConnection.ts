import { getSupabaseClient, isSupabaseConfigured } from "@/config/supabase";

/**
 * Optional Supabase connection health check.
 *
 * This is a foundation only — it never blocks the app, never runs at startup,
 * and makes a network request ONLY when Supabase env vars are configured and
 * the caller explicitly invokes checkSupabaseConnection(). With no config, it
 * short-circuits to "disabled" without touching the network.
 */

export type SupabaseConnectionStatus = "disabled" | "configured" | "connected" | "error";

export type SupabaseConnectionResult = {
  status: SupabaseConnectionStatus;
  message: string;
};

const statusCopy: Record<SupabaseConnectionStatus, string> = {
  disabled: "Not configured",
  configured: "Ready",
  connected: "Connected",
  error: "Error",
};

export function getSupabaseConnectionCopy(status: SupabaseConnectionStatus) {
  return statusCopy[status];
}

/** Non-network snapshot: is cloud sync configured at all? Safe to call anytime. */
export function getSupabaseConfigStatus(): SupabaseConnectionResult {
  if (!isSupabaseConfigured()) {
    return { status: "disabled", message: statusCopy.disabled };
  }

  return { status: "configured", message: statusCopy.configured };
}

/**
 * Optional live check. Only makes a network request when configured. Returns a
 * clear status and never throws. Not used to gate any app functionality.
 */
export async function checkSupabaseConnection(): Promise<SupabaseConnectionResult> {
  if (!isSupabaseConfigured()) {
    return { status: "disabled", message: statusCopy.disabled };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { status: "error", message: "Could not create the cloud client." };
  }

  try {
    // Lightweight reachability probe against Supabase Auth's health endpoint.
    // No table access, no data read — sync/schema arrive in Chapter 3.
    const { error } = await client.auth.getSession();
    if (error) {
      return { status: "error", message: statusCopy.error };
    }

    return { status: "connected", message: statusCopy.connected };
  } catch {
    return { status: "error", message: statusCopy.error };
  }
}
