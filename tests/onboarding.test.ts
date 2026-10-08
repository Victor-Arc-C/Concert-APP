import { expect, it } from 'vitest';
import {
  onboardingProgress,
  onboardingSource,
  unsupportedLiveArtists,
} from '../src/domain/onboarding';

it('classifies manual, Spotify, mixed and demo onboarding', () => {
  expect(onboardingSource(['a', 'b'], [], false)).toBe('manual');
  expect(onboardingSource(['a', 'b'], ['a', 'b', 'c'], false)).toBe('spotify');
  expect(onboardingSource(['a', 'b'], ['a'], false)).toBe('mixed');
  expect(onboardingSource(['a'], ['a'], true)).toBe('demo');
});
it('rejects fictional artists in live onboarding', () => {
  expect(unsupportedLiveArtists(['tm-1', 'spotify-2'], ['tm-1', 'spotify-2'])).toEqual([]);
  expect(unsupportedLiveArtists(['tm-1', 'fred-again', 'fred-again'], ['tm-1'])).toEqual([
    'fred-again',
  ]);
  expect(unsupportedLiveArtists([], [])).toEqual([]);
});
it('reports onboarding progress from fresh artist checks only', () => {
  const progress = onboardingProgress([
    { artistId: 'a', fresh: true, failed: false },
    { artistId: 'b', fresh: false, failed: false },
    { artistId: 'c', fresh: true, failed: true },
    { artistId: 'd', fresh: false, failed: true },
  ]);
  expect(progress).toEqual({ total: 4, done: ['a', 'c'], failed: ['c'] });
  expect(onboardingProgress([])).toEqual({ total: 0, done: [], failed: [] });
});
