import { execSync } from 'child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/database';

let cachedUrl: string | null = null;
let cachedKey: string | null = null;

export function getLocalSupabaseConfig(): { url: string; anonKey: string } {
  if (cachedUrl && cachedKey) {
    return { url: cachedUrl, anonKey: cachedKey };
  }

  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    cachedUrl = process.env.SUPABASE_URL;
    cachedKey = process.env.SUPABASE_ANON_KEY;
    return { url: cachedUrl, anonKey: cachedKey };
  }

  try {
    const raw = execSync('supabase status -o json', { encoding: 'utf8' });
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
      cachedUrl = parsed.API_URL;
      cachedKey = parsed.ANON_KEY;
      return { url: cachedUrl!, anonKey: cachedKey! };
    }
  } catch {
    // fallback
  }

  cachedUrl = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
  cachedKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
  return { url: cachedUrl, anonKey: cachedKey };
}

export function createTestClient(): SupabaseClient<Database> {
  const { url, anonKey } = getLocalSupabaseConfig();
  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function createAuthenticatedClient(session: {
  access_token: string;
  refresh_token: string;
}): Promise<SupabaseClient<Database>> {
  const { url, anonKey } = getLocalSupabaseConfig();
  const client = createClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  await client.auth.setSession(session);
  return client;
}
