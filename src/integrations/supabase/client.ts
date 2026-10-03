import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Only the same-origin backend is contacted. This is a protocol placeholder,
// not a Supabase key; the real credentials exist exclusively on the server.
export const API_URL = `${window.location.origin}/api/supabase`;
export const PUBLIC_CLIENT_ID = 'railway-browser-client';

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(API_URL, PUBLIC_CLIENT_ID, {
  auth: {
    storage: localStorage,
    storageKey: 'team-task-hub-session',
    persistSession: true,
    autoRefreshToken: true,
  }
});
