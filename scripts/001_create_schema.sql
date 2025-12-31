
-- 1. Update calculations table with social features
ALTER TABLE public.calculations 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS replies_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 2. Drop and recreate likes table with better structure
DROP TABLE IF EXISTS public.likes CASCADE;

CREATE TABLE public.likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calculation_id UUID NOT NULL REFERENCES public.calculations(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  reaction_type TEXT CHECK (reaction_type IN ('like', 'love', 'insightful', 'curious', 'fire', 'star')) DEFAULT 'like',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Unique constraint to prevent duplicate reactions on same node
  CONSTRAINT unique_user_calculation_node UNIQUE (user_id, calculation_id, node_id)
);

-- 3. Drop and recreate user_sessions table with better structure
DROP TABLE IF EXISTS public.user_sessions CASCADE;

CREATE TABLE public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  user_agent TEXT,
  ip_address INET,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '30 days')
);

-- 4. Create comments table for storing individual replies
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calculation_id UUID NOT NULL REFERENCES public.calculations(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  content TEXT NOT NULL,
  operation TEXT CHECK (operation IN ('+', '-', '*', '/', '^', 'mod')),
  user_number NUMERIC,
  result_number NUMERIC,
  likes_count INTEGER DEFAULT 0,
  depth INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Enable RLS on all tables
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- 6. Update RLS policies for calculations (drop existing ones first)
DROP POLICY IF EXISTS "Users can view their own calculations" ON public.calculations;
DROP POLICY IF EXISTS "Users can insert their own calculations" ON public.calculations;
DROP POLICY IF EXISTS "Users can update their own calculations" ON public.calculations;
DROP POLICY IF EXISTS "Users can delete their own calculations" ON public.calculations;

-- New comprehensive policies for calculations
-- Anyone can view public calculations
CREATE POLICY "Anyone can view public calculations" ON public.calculations
  FOR SELECT USING (is_public = true OR auth.uid() = user_id);

-- Authenticated users can create calculations
CREATE POLICY "Authenticated users can create calculations" ON public.calculations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update their own calculations
CREATE POLICY "Users can update their own calculations" ON public.calculations
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own calculations
CREATE POLICY "Users can delete their own calculations" ON public.calculations
  FOR DELETE USING (auth.uid() = user_id);

-- 7. Policies for likes table
-- Anyone can view likes
CREATE POLICY "Anyone can view likes" ON public.likes
  FOR SELECT USING (true);
  
-- Users can insert their own likes
CREATE POLICY "Users can insert their own likes" ON public.likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
-- Users can delete their own likes
CREATE POLICY "Users can delete their own likes" ON public.likes
  FOR DELETE USING (auth.uid() = user_id);

-- 8. Policies for user_sessions table
-- Users can manage their own sessions
CREATE POLICY "Users can manage their own sessions" ON public.user_sessions
  FOR ALL USING (
    auth.uid() = user_id OR 
    session_token = current_setting('request.headers')::json->>'x-session-token'
  );

-- 9. Policies for comments table
-- Anyone can view comments
CREATE POLICY "Anyone can view comments" ON public.comments
  FOR SELECT USING (true);
  
-- Authenticated users or anonymous users with name can create comments
CREATE POLICY "Anyone can create comments" ON public.comments
  FOR INSERT WITH CHECK (true);

-- Users can update their own comments
CREATE POLICY "Users can update their own comments" ON public.comments
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete their own comments" ON public.comments
  FOR DELETE USING (auth.uid() = user_id);

-- 10. Create indexes for better performance
-- Indexes for calculations table
CREATE INDEX IF NOT EXISTS idx_calculations_user_id ON public.calculations(user_id);
CREATE INDEX IF NOT EXISTS idx_calculations_public ON public.calculations(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_calculations_updated_at ON public.calculations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_calculations_last_activity ON public.calculations(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_calculations_likes_count ON public.calculations(likes_count DESC);
CREATE INDEX IF NOT EXISTS idx_calculations_tags ON public.calculations USING GIN(tags);

-- Indexes for likes table
CREATE INDEX IF NOT EXISTS idx_likes_user_calculation_node ON public.likes(user_id, calculation_id, node_id);
CREATE INDEX IF NOT EXISTS idx_likes_calculation_id ON public.likes(calculation_id);
CREATE INDEX IF NOT EXISTS idx_likes_created_at ON public.likes(created_at DESC);

-- Indexes for user_sessions table
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON public.user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON public.user_sessions(expires_at) WHERE is_active = true;

-- Indexes for comments table
CREATE INDEX IF NOT EXISTS idx_comments_calculation_id ON public.comments(calculation_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_depth ON public.comments(depth);

-- 11. Create trigger functions
-- Function to update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update likes count
CREATE OR REPLACE FUNCTION public.update_calculation_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.calculations 
    SET likes_count = likes_count + 1,
        last_activity_at = now()
    WHERE id = NEW.calculation_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.calculations 
    SET likes_count = likes_count - 1,
        last_activity_at = now()
    WHERE id = OLD.calculation_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to update replies count (using comments table)
CREATE OR REPLACE FUNCTION public.update_calculation_replies_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.calculations 
    SET replies_count = replies_count + 1,
        last_activity_at = now(),
        updated_at = now()
    WHERE id = NEW.calculation_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.calculations 
    SET replies_count = replies_count - 1,
        last_activity_at = now(),
        updated_at = now()
    WHERE id = OLD.calculation_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to update calculation's last activity
CREATE OR REPLACE FUNCTION public.update_calculation_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.calculations 
  SET last_activity_at = now()
  WHERE id = NEW.calculation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update view count
CREATE OR REPLACE FUNCTION public.increment_view_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.calculations 
  SET view_count = view_count + 1
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 12. Create triggers
-- Updated_at triggers
CREATE TRIGGER update_likes_updated_at
  BEFORE UPDATE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_sessions_updated_at
  BEFORE UPDATE ON public.user_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Likes count trigger
CREATE TRIGGER update_calculation_likes_count_trigger
  AFTER INSERT OR DELETE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.update_calculation_likes_count();

-- Replies count trigger (using comments table)
CREATE TRIGGER update_calculation_replies_count_trigger
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_calculation_replies_count();

-- Activity triggers
CREATE TRIGGER update_calculation_on_comment_activity
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_calculation_last_activity();

CREATE TRIGGER update_calculation_on_like_activity
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.update_calculation_last_activity();

-- View count trigger (this would be called from application code)
-- CREATE TRIGGER increment_calculation_view_count
--   BEFORE UPDATE ON public.calculations
--   FOR EACH ROW 
--   WHEN (OLD.view_count IS DISTINCT FROM NEW.view_count)
--   EXECUTE FUNCTION public.increment_view_count();

-- 13. Create views for easier queries
-- Public feed view
CREATE OR REPLACE VIEW public.public_calculations_feed AS
SELECT 
  c.id,
  c.user_id,
  p.full_name as author_name,
  p.avatar_url as author_avatar,
  c.name as title,
  c.description,
  c.formula,
  c.result,
  c.likes_count,
  c.replies_count,
  c.view_count,
  c.is_public,
  c.is_pinned,
  c.tags,
  c.created_at,
  c.updated_at,
  c.last_activity_at,
  -- Calculate popularity score (weighted algorithm)
  (
    (c.likes_count * 3) + 
    (c.replies_count * 2) + 
    (c.view_count * 0.5) +
    EXTRACT(EPOCH FROM (now() - c.last_activity_at)) / -86400 -- Recent activity bonus
  ) as popularity_score,
  -- Calculate hotness (for "hot" sorting)
  (
    (c.likes_count + c.replies_count) / 
    POWER(EXTRACT(EPOCH FROM (now() - c.created_at)) / 3600 + 2, 1.5)
  ) as hotness_score
FROM public.calculations c
LEFT JOIN public.profiles p ON c.user_id = p.id
WHERE c.is_public = true
ORDER BY 
  c.is_pinned DESC,
  popularity_score DESC;

-- User's calculation stats view
CREATE OR REPLACE VIEW public.user_calculation_stats AS
SELECT 
  user_id,
  COUNT(*) as total_calculations,
  SUM(likes_count) as total_likes_received,
  SUM(replies_count) as total_replies,
  SUM(view_count) as total_views,
  MAX(created_at) as last_calculation_date
FROM public.calculations
GROUP BY user_id;

-- Recent activity view
CREATE OR REPLACE VIEW public.recent_activity AS
SELECT 
  'comment' as activity_type,
  c.id as activity_id,
  c.calculation_id,
  c.user_id,
  c.user_name,
  c.content,
  c.created_at
FROM public.comments c
UNION ALL
SELECT 
  'like' as activity_type,
  l.id as activity_id,
  l.calculation_id,
  l.user_id,
  NULL as user_name,
  NULL as content,
  l.created_at
FROM public.likes l
ORDER BY created_at DESC
LIMIT 100;

-- 14. Create helper functions
-- Function to get comment tree
CREATE OR REPLACE FUNCTION public.get_comment_tree(calculation_id_param UUID)
RETURNS TABLE (
  id UUID,
  parent_comment_id UUID,
  user_id UUID,
  user_name TEXT,
  content TEXT,
  operation TEXT,
  user_number NUMERIC,
  result_number NUMERIC,
  likes_count INTEGER,
  depth INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  path LTREE
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE comment_tree AS (
    -- Anchor: root comments (depth = 0)
    SELECT 
      c.id,
      c.parent_comment_id,
      c.user_id,
      c.user_name,
      c.content,
      c.operation,
      c.user_number,
      c.result_number,
      c.likes_count,
      0 as depth,
      c.created_at,
      text2ltree(c.id::text) as path
    FROM public.comments c
    WHERE c.calculation_id = calculation_id_param 
      AND c.parent_comment_id IS NULL
    
    UNION ALL
    
    -- Recursive: child comments
    SELECT 
      c.id,
      c.parent_comment_id,
      c.user_id,
      c.user_name,
      c.content,
      c.operation,
      c.user_number,
      c.result_number,
      c.likes_count,
      ct.depth + 1 as depth,
      c.created_at,
      ct.path || text2ltree(c.id::text) as path
    FROM public.comments c
    INNER JOIN comment_tree ct ON c.parent_comment_id = ct.id
    WHERE c.calculation_id = calculation_id_param
  )
  SELECT * FROM comment_tree
  ORDER BY path;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if user has liked a node
CREATE OR REPLACE FUNCTION public.has_user_liked_node(
  user_id_param UUID,
  calculation_id_param UUID,
  node_id_param TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.likes l
    WHERE l.user_id = user_id_param
      AND l.calculation_id = calculation_id_param
      AND l.node_id = node_id_param
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get calculation with comments
CREATE OR REPLACE FUNCTION public.get_calculation_with_comments(calculation_id_param UUID)
RETURNS JSONB AS $$
DECLARE
  calculation_json JSONB;
  comments_json JSONB;
BEGIN
  -- Get calculation
  SELECT jsonb_build_object(
    'id', c.id,
    'title', c.name,
    'description', c.description,
    'formula', c.formula,
    'likes_count', c.likes_count,
    'replies_count', c.replies_count,
    'author_id', c.user_id,
    'created_at', c.created_at,
    'updated_at', c.updated_at
  ) INTO calculation_json
  FROM public.calculations c
  WHERE c.id = calculation_id_param;
  
  -- Get comments as tree
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', ct.id,
      'parent_id', ct.parent_comment_id,
      'user_name', ct.user_name,
      'content', ct.content,
      'operation', ct.operation,
      'user_number', ct.user_number,
      'result_number', ct.result_number,
      'likes_count', ct.likes_count,
      'depth', ct.depth,
      'created_at', ct.created_at
    )
    ORDER BY ct.path
  ) INTO comments_json
  FROM public.get_comment_tree(calculation_id_param) ct;
  
  -- Combine
  RETURN jsonb_build_object(
    'calculation', calculation_json,
    'comments', COALESCE(comments_json, '[]'::JSONB)
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- 15. Grant permissions
-- Grant access to functions
GRANT EXECUTE ON FUNCTION public.get_comment_tree(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_user_liked_node(UUID, UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_calculation_with_comments(UUID) TO authenticated, anon;

-- Grant access to views
GRANT SELECT ON public.public_calculations_feed TO authenticated, anon;
GRANT SELECT ON public.user_calculation_stats TO authenticated, anon;
GRANT SELECT ON public.recent_activity TO authenticated, anon;


-- ============================================
-- DATABASE CLEANUP FUNCTION (Optional)
-- ============================================
CREATE OR REPLACE FUNCTION public.cleanup_old_data()
RETURNS void AS $$
BEGIN
  -- Delete expired sessions
  DELETE FROM public.user_sessions 
  WHERE expires_at < now() OR NOT is_active;
  
  -- Delete calculations older than 1 year with no activity
  DELETE FROM public.calculations 
  WHERE last_activity_at < now() - INTERVAL '1 year'
    AND likes_count = 0 
    AND replies_count = 0;
    
  -- Vacuum analyze to clean up
  ANALYZE public.calculations;
  ANALYZE public.comments;
  ANALYZE public.likes;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- END OF COMPLETE SCHEMA UPDATE
-- ============================================

-- To apply this schema:
-- 1. Run this entire script in Supabase SQL Editor
-- 2. The script will automatically update existing tables
-- 3. Test by running: SELECT * FROM public.public_calculations_feed LIMIT 5;