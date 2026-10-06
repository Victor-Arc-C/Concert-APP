export function safeTicketUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      [
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
    );
  } catch {
    return false;
  }
}
