import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
        '[Vaulta] Missing Supabase environment variables. ' +
        'Copy .env.example to .env and fill in your Supabase project URL and anon key. ' +
        'The app will run in offline/demo mode until credentials are provided.'
    );
}

// Use placeholder values so the app doesn't crash at module load.
// All Supabase calls will fail gracefully until real credentials are provided.
export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-anon-key'
);
