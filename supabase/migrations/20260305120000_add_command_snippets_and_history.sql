-- Create command_snippets table for storing reusable bash commands
CREATE TABLE IF NOT EXISTS public.command_snippets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    command TEXT NOT NULL,
    category TEXT DEFAULT 'custom',
    is_builtin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.command_snippets ENABLE ROW LEVEL SECURITY;

-- Users can only see/manage their own snippets + built-in ones
CREATE POLICY "Users can view own snippets and built-ins"
    ON public.command_snippets FOR SELECT
    USING (user_id = auth.uid() OR is_builtin = TRUE);

CREATE POLICY "Users can insert own snippets"
    ON public.command_snippets FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own snippets"
    ON public.command_snippets FOR UPDATE
    USING (user_id = auth.uid() AND is_builtin = FALSE);

CREATE POLICY "Users can delete own snippets"
    ON public.command_snippets FOR DELETE
    USING (user_id = auth.uid() AND is_builtin = FALSE);

-- Create command_history table for audit logging
CREATE TABLE IF NOT EXISTS public.command_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    command TEXT NOT NULL,
    exit_code INTEGER,
    stdout TEXT DEFAULT '',
    stderr TEXT DEFAULT '',
    success BOOLEAN DEFAULT FALSE,
    executed_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.command_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own command history"
    ON public.command_history FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own command history"
    ON public.command_history FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Index for efficient querying
CREATE INDEX idx_command_history_service ON public.command_history(service_id, executed_at DESC);
CREATE INDEX idx_command_snippets_user ON public.command_snippets(user_id);
