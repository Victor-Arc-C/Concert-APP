import { expect, it } from 'vitest';
import { onboardingSource, unsupportedLiveArtists } from '../src/domain/onboarding';

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
