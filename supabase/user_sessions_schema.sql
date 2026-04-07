-- Create the user_sessions table to manage single active sessions
CREATE TABLE IF NOT EXISTS public.user_sessions (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    session_token UUID NOT NULL,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Turn on Row Level Security
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Allow users to manage their own sessions
CREATE POLICY "Users can view own session" 
    ON public.user_sessions FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own session" 
    ON public.user_sessions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own session" 
    ON public.user_sessions FOR UPDATE 
    USING (auth.uid() = user_id);

-- Enable Realtime for user_sessions to instantly end concurrent sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_sessions;
