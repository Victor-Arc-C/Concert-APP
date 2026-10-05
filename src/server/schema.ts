export const migrations = [
  {
    version: 1,
    sql: `
CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password_hash TEXT NOT NULL, mode TEXT NOT NULL DEFAULT 'sample', onboarded BOOLEAN NOT NULL DEFAULT FALSE, preferences JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL);
CREATE TABLE rate_limits (bucket TEXT PRIMARY KEY, count INT NOT NULL, window_at TIMESTAMPTZ NOT NULL);
CREATE TABLE artists (id TEXT PRIMARY KEY, data JSONB NOT NULL);
CREATE TABLE artist_provider_records (provider TEXT NOT NULL, external_id TEXT NOT NULL, artist_id TEXT NOT NULL REFERENCES artists(id), PRIMARY KEY(provider,external_id));
CREATE TABLE affinities (user_id TEXT REFERENCES users(id) ON DELETE CASCADE, artist_id TEXT REFERENCES artists(id), favorite BOOLEAN NOT NULL DEFAULT FALSE, hidden BOOLEAN NOT NULL DEFAULT FALSE, PRIMARY KEY(user_id,artist_id));
CREATE TABLE events (id TEXT PRIMARY KEY, fingerprint TEXT UNIQUE NOT NULL, data JSONB NOT NULL, sample BOOLEAN NOT NULL);
CREATE TABLE event_provider_records (provider TEXT NOT NULL, external_id TEXT NOT NULL, event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE, raw JSONB NOT NULL, fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(provider,external_id));
CREATE TABLE feedback (user_id TEXT REFERENCES users(id) ON DELETE CASCADE, event_id TEXT REFERENCES events(id) ON DELETE CASCADE, action TEXT NOT NULL CHECK(action IN ('saved','dismissed','clicked')), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(user_id,event_id));
CREATE TABLE intents (user_id TEXT REFERENCES users(id) ON DELETE CASCADE, artist_id TEXT REFERENCES artists(id), data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(user_id,artist_id));
CREATE TABLE alerts (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE, kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, read_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(user_id,event_id,kind));
CREATE TABLE music_accounts (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, access_token TEXT NOT NULL, refresh_token TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL);
CREATE TABLE oauth_attempts (state TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, verifier TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL);
CREATE TABLE analytics (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, properties JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE affiliate_clicks (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, event_id TEXT REFERENCES events(id) ON DELETE CASCADE, provider TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE provider_sync (artist_id TEXT PRIMARY KEY REFERENCES artists(id), checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), message TEXT);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE INDEX alerts_user ON alerts(user_id,created_at);
CREATE INDEX analytics_user_time ON analytics(user_id,created_at);
`,
  },
  {
    version: 2,
    sql: `
-- Additive provider-neutral structures. Existing event snapshots remain intact.
CREATE TABLE venues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  latitude DOUBLE PRECISION CHECK(latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION CHECK(longitude BETWEEN -180 AND 180)
);
CREATE TABLE venue_provider_records (
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  venue_id TEXT NOT NULL REFERENCES venues(id),
  PRIMARY KEY(provider,external_id)
);
CREATE TABLE event_venues (
  event_id TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  venue_id TEXT NOT NULL REFERENCES venues(id)
);
CREATE TABLE ticket_sources (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  url TEXT,
  price_min NUMERIC CHECK(price_min >= 0),
  price_max NUMERIC CHECK(price_max >= price_min),
  currency TEXT,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disabled_at TIMESTAMPTZ,
  PRIMARY KEY(provider,external_id),
  CHECK(price_max IS NULL OR price_min IS NOT NULL)
);
CREATE INDEX ticket_sources_event ON ticket_sources(event_id);
CREATE INDEX event_venues_venue ON event_venues(venue_id);
CREATE INDEX artist_provider_artist ON artist_provider_records(artist_id);
CREATE INDEX event_provider_event ON event_provider_records(event_id);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX events_mode_date ON events(sample,(data->>'date'));
CREATE INDEX feedback_event ON feedback(event_id);
CREATE INDEX affiliate_clicks_user_time ON affiliate_clicks(user_id,created_at);
CREATE INDEX oauth_attempts_expiry ON oauth_attempts(expires_at);
CREATE INDEX analytics_time ON analytics(created_at);
CREATE INDEX rate_limits_window ON rate_limits(window_at);
`,
  },
  {
    version: 3,
    sql: `CREATE TABLE provider_backoff (provider TEXT PRIMARY KEY, retry_at TIMESTAMPTZ NOT NULL);`,
  },
];
