import { expect, it } from 'vitest';
import { matchesAuditArtist } from '../src/domain/coverage-audit';

it('keeps exact audit identities while ignoring case and accents', () => {
  expect(matchesAuditArtist('ANGELE', { name: 'Angèle' })).toBe(true);
  expect(matchesAuditArtist('OrelSan', { name: 'Orelsan' })).toBe(true);
  expect(matchesAuditArtist('Orelsan Tribute', { name: 'Orelsan' })).toBe(false);
});

it('includes the French Bigflo record only when its alias has been reviewed', () => {
  expect(matchesAuditArtist('Bigflo et Oli', { name: 'Bigflo & Oli' })).toBe(false);
  const artist = { name: 'Bigflo & Oli', ticketmasterNames: ['Bigflo et Oli'] };
  expect(matchesAuditArtist('Bigflo et Oli', artist)).toBe(true);
  expect(matchesAuditArtist('Bigflo & Oli', artist)).toBe(true);
  expect(matchesAuditArtist('Bigflo et Oli Tribute', artist)).toBe(false);
});

it('does not globally equate et with ampersand or accept a partial name', () => {
  expect(matchesAuditArtist('Earth et Wind', { name: 'Earth & Wind' })).toBe(false);
  expect(matchesAuditArtist('Bigflo', { name: 'Bigflo & Oli' })).toBe(false);
});
