# Optional Spotify connection

Manual artist selection, concert browsing and saved shows work without Spotify. Since CON-33, onboarding step 2 searches the live (Ticketmaster) catalogue directly whenever live concerts are available, and completes in live mode. The fictional demo catalogue is an explicit opt-in. Spotify development mode allows at most five allowlisted users, and extended quota is limited to organizations with at least 250k MAU (https://developer.spotify.com/documentation/web-api/concepts/quota-modes), so manual live search is the primary beta path. Enable Spotify only for an approved pilot with its approved accounts. Keep all credentials and the 32-byte base64 encryption key in the local environment or deployment secret store.

Register the exact callback `${APP_URL origin}/api/spotify/callback` in Spotify. Local verification uses `http://127.0.0.1:3000/api/spotify/callback`. Only `user-top-read` is requested. OAuth uses encrypted PKCE verifiers and random, user-bound, single-use states with a ten-minute expiry. Cancellation removes the matching attempt and leaves any existing connection intact.

Access and refresh tokens are encrypted using AES-256-GCM. Expired access tokens refresh before requests; a 401 triggers one refresh and retry. Rotated refresh tokens replace the old encrypted value; absent replacements preserve it. Revoked refresh grants offer reconnect. Permission and quota failures surface without retry loops; provider Retry-After reaches the API response. Per-user request limits bound import and confirmation calls. Settings always offers reconnect when enabled.

## Explicit confirmation and stored data

Top-artist results are transient. Loading the list does not create artists, follows or Spotify preferences. Choose a suggestion, then explicitly confirm the matching live-catalogue artist. The server rechecks Spotify membership and validates the live internal artist before atomically saving the follow and the per-user Spotify ID mapping.

Migration 4 adds `spotify_artist_preferences`, linked to the user's follow. Its normalized affinity is **1 for an explicitly confirmed choice**. It is not a listening-derived rank, play count or probability. No raw listening history or ranks are stored. Existing favorite flags remain unchanged. This user-confirmed mapping does not assert a global automatic identity match; cross-provider normalization belongs to CON-12.

Export includes confirmed Spotify choices and never tokens. Unfollowing removes linked Spotify choices. Disconnect deletes tokens, pending OAuth attempts and Spotify choice records, preserving manual follows. Account deletion cascades through the same records. Disconnecting locally does not revoke the application's grant in Spotify account settings.

## CON-10 verification — 2026-10-05

Approved-account browser verification: successful authorization and exact callback, 30 returned top artists, explicit confirmation of an already-followed live artist, forced access-expiry refresh, reconnect, actual consent cancellation, disconnect and reconnect. Stored access/refresh ciphertext was checked through authenticated decryption without printing values. After disconnect, database checks found zero tokens, attempts or Spotify choices; existing follows remained.

Deterministic tests cover scope rejection, single-use state, encryption, refresh-token rotation/preservation, invalid_grant, 403 permission denial, 429/Retry-After, forged artist selection, atomic storage and disconnect cleanup. Revoked-grant and quota responses are controlled fixtures, not induced failures against Spotify. Local E2E checks use a disposable database with live providers disabled.
