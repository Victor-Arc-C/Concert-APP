export type OnboardingSource = 'manual' | 'spotify' | 'mixed' | 'demo';

/**
 * Classifies how the onboarding artists were chosen, so manual selection is never reported
 * as a tested Spotify import (docs/MVP_SCOPE.md, launch measurement contract).
 */
export function onboardingSource(
  selected: string[],
  spotifyArtistIds: string[],
  demo: boolean,
): OnboardingSource {
  if (demo) return 'demo';
  const fromSpotify = selected.filter((id) => spotifyArtistIds.includes(id)).length;
  if (!fromSpotify) return 'manual';
  return fromSpotify === selected.length ? 'spotify' : 'mixed';
}

/**
 * Live onboarding may only follow artists with a provider identity (Ticketmaster or a confirmed
 * Spotify mapping). Fictional sample artists have none. Returns the ids that are not allowed.
 */
export function unsupportedLiveArtists(artistIds: string[], providerBackedIds: string[]) {
  const backed = new Set(providerBackedIds);
  return [...new Set(artistIds)].filter((id) => !backed.has(id));
}

export type ArtistCheck = { artistId: string; fresh: boolean; failed: boolean };
export type OnboardingProgress = { total: number; done: string[]; failed: string[] };

/**
 * How far the first concert check has got, for the loader shown after choosing artists. An artist
 * counts as done once its latest check is still inside the window the sync itself respects
 * (an hour after a success, fifteen minutes after a failure), so the bar only moves for real work.
 */
export function onboardingProgress(checks: ArtistCheck[]): OnboardingProgress {
  const fresh = checks.filter((check) => check.fresh);
  return {
    total: checks.length,
    done: fresh.map((check) => check.artistId),
    failed: fresh.filter((check) => check.failed).map((check) => check.artistId),
  };
}
