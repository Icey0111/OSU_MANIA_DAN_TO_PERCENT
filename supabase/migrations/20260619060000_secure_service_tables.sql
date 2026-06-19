-- All application data is accessed through server-side API routes using the
-- service role. Keep direct anon/authenticated REST access closed.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE beatmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE overlay_auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE beatmap_promotion_audits ENABLE ROW LEVEL SECURITY;
