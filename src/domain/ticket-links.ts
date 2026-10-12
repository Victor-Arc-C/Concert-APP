// Awin's tracked click for Fnac Spectacles (advertiser 12494): the only redirect wrapper allowed,
// because the product feed supplies these links and they land on fnacspectacles.com.
function fnacAwinLink(u: URL): boolean {
  return (
    u.hostname === 'www.awin1.com' &&
    u.pathname === '/pclick.php' &&
    u.searchParams.get('m') === '12494' &&
    /^\d+$/.test(u.searchParams.get('p') ?? '') &&
    /^\d+$/.test(u.searchParams.get('a') ?? '')
  );
}
/** The seller a ticket link leads to, or null when the link is not an approved one. */
export function ticketSellerHost(value: string): string | null {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password) return null;
    if (fnacAwinLink(u)) return 'www.fnacspectacles.com';
    return [
      'ticketmaster.com',
      'ticketmaster.fr',
      'ticketmaster.co.uk',
      'ticketmaster.nl',
      'ticketmaster.de',
      'ticketmaster.es',
      'ticketmaster.it',
      'ticketmaster.be',
      'ticketmaster.ie',
      'ticketmaster.se',
      'ticketmaster.dk',
      'ticketmaster.no',
      'ticketmaster.ch',
      'ticketmaster.at',
      'ticketmaster.pl',
      'ticketweb.uk',
      'ticketweb.com',
      'universe.com',
    ].some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))
      ? u.hostname
      : null;
  } catch {
    return null;
  }
}
export function safeTicketUrl(value: string): boolean {
  return ticketSellerHost(value) !== null;
}
