type AuditArtist = { name: string; ticketmasterNames?: string[] };

function normalizedName(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Audit-only, explicitly reviewed aliases. Do not change production artist identity rules.
export function matchesAuditArtist(name: string, artist: AuditArtist): boolean {
  return [artist.name, ...(artist.ticketmasterNames ?? [])].some(
    (candidate) => normalizedName(name) === normalizedName(candidate),
  );
}
