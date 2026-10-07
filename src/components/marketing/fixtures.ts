/**
 * Dev-only stress data for the marketing page (see DataToggle). Every value is something the
 * live Ticketmaster feed can realistically return: real artists, venues and city names, with the
 * long, accented, clustered and high-volume cases the sample data never exercises.
 */
import type { PublicCity, PublicGig, PublicGigs } from '@/domain/marketing';

export type Fixture = 'worst' | 'empty' | 'one' | 'huge';
export const fixtureNames: Fixture[] = ['worst', 'empty', 'one', 'huge'];

const city = (
  name: string,
  country: string,
  latitude: number,
  longitude: number,
  gigs: PublicGig[],
  total = gigs.length,
): PublicCity => ({ name, country, latitude, longitude, gigs, total });
const gig = (artist: string, venue: string, date: string): PublicGig => ({ artist, venue, date });

const longParis = [
  gig('King Gizzard & the Lizard Wizard', 'Zénith Paris - La Villette', '2026-11-04'),
  gig(
    'Orchestre Philharmonique de Radio France',
    'Cité de la Musique - Philharmonie de Paris',
    '2026-11-06',
  ),
  gig('Godspeed You! Black Emperor', 'La Cigale', '2026-11-09'),
  gig('MØ', 'La Maroquinerie', '2026-11-12'),
  gig('Florence + the Machine', 'Accor Arena', '2026-11-15'),
  gig('藤井 風', 'Adidas Arena', '2026-11-18'),
  gig('!!!', 'Le Trabendo', '2026-11-21'),
  gig('Sunn O)))', 'Le Trianon', '2026-11-24'),
  gig('Ólafur Arnalds', 'Salle Pleyel', '2026-11-27'),
  gig('Rosalía', 'Accor Arena', '2026-12-01'),
  gig('Wu-Tang Clan', 'Paris La Défense Arena', '2026-12-04'),
  gig('Hania Rani', 'Théâtre du Châtelet', '2026-12-08'),
];

const worst: PublicGigs = {
  mode: 'live',
  cities: [
    // 37 shows but only the first 12 are sent: the "+N more" path.
    city('Paris', 'FR', 48.857, 2.352, longParis, 37),
    city("Reggio nell'Emilia", 'IT', 44.698, 10.631, [gig('Måneskin', 'RCF Arena', '2026-12-12')]),
    city('Mönchengladbach', 'DE', 51.18, 6.443, [gig('Sigur Rós', 'SparkassenPark', '2027-06-20')]),
    city("'s-Hertogenbosch", 'NL', 51.697, 5.304, [gig('Parcels', 'Mezz', '2026-11-30')]),
    city('Clermont-Ferrand', 'FR', 45.778, 3.087, [
      gig('Florence + the Machine', 'Zénith d’Auvergne', '2026-11-17'),
    ]),
    city('Aix-en-Provence', 'FR', 43.529, 5.447, [
      gig('Ibeyi', 'Arena du Pays d’Aix', '2026-12-03'),
    ]),
    city('Saint-Étienne', 'FR', 45.434, 4.39, [gig('Yaeji', 'Le Fil', '2026-11-26')]),
    // A Benelux cluster: five cities inside ~150 km, the label-collision case.
    city('Amsterdam', 'NL', 52.368, 4.904, [gig('Boards of Canada', 'AFAS Live', '2026-12-10')]),
    city('Utrecht', 'NL', 52.091, 5.122, [gig('Hania Rani', 'TivoliVredenburg', '2026-12-11')]),
    city('Rotterdam', 'NL', 51.924, 4.478, [gig('Wu-Tang Clan', 'Ahoy', '2026-12-05')]),
    city('Antwerp', 'BE', 51.219, 4.402, [gig('MØ', 'De Roma', '2026-11-14')]),
    city('Brussels', 'BE', 50.85, 4.352, [
      gig('Godspeed You! Black Emperor', 'Ancienne Belgique', '2026-11-08'),
    ]),
    city('Esch-sur-Alzette', 'LU', 49.496, 5.981, [gig('!!!', 'Rockhal', '2026-11-22')]),
    city('Stockholm', 'SE', 59.329, 18.069, [
      gig('King Gizzard & the Lizard Wizard', 'Annexet', '2027-02-02'),
    ]),
  ],
  stats: { shows: 1284, artists: 212, cities: 14, countries: 7 },
  waitlist: 1047,
};

const one: PublicGigs = {
  mode: 'live',
  cities: [city('Lyon', 'FR', 45.764, 4.836, [gig('RAYE', 'Halle Tony Garnier', '2026-12-02')])],
  stats: { shows: 1, artists: 1, cities: 1, countries: 1 },
  waitlist: null,
};

const empty: PublicGigs = {
  mode: 'live',
  cities: [],
  stats: { shows: 0, artists: 0, cities: 0, countries: 0 },
  waitlist: null,
};

// Real European cities with approximate coordinates, for the high-volume case.
const many: [string, string, number, number][] = [
  ['Paris', 'FR', 48.857, 2.352],
  ['Lyon', 'FR', 45.764, 4.836],
  ['Marseille', 'FR', 43.296, 5.37],
  ['Toulouse', 'FR', 43.604, 1.444],
  ['Bordeaux', 'FR', 44.838, -0.579],
  ['Nantes', 'FR', 47.218, -1.554],
  ['Lille', 'FR', 50.629, 3.057],
  ['Strasbourg', 'FR', 48.573, 7.752],
  ['Nice', 'FR', 43.71, 7.262],
  ['London', 'GB', 51.507, -0.128],
  ['Manchester', 'GB', 53.481, -2.243],
  ['Glasgow', 'GB', 55.864, -4.252],
  ['Birmingham', 'GB', 52.486, -1.89],
  ['Dublin', 'IE', 53.35, -6.26],
  ['Amsterdam', 'NL', 52.368, 4.904],
  ['Utrecht', 'NL', 52.091, 5.122],
  ['Rotterdam', 'NL', 51.924, 4.478],
  ['Eindhoven', 'NL', 51.441, 5.47],
  ['Antwerp', 'BE', 51.219, 4.402],
  ['Brussels', 'BE', 50.85, 4.352],
  ['Ghent', 'BE', 51.054, 3.717],
  ['Luxembourg', 'LU', 49.612, 6.13],
  ['Berlin', 'DE', 52.52, 13.405],
  ['Hamburg', 'DE', 53.551, 9.993],
  ['Cologne', 'DE', 50.938, 6.96],
  ['Munich', 'DE', 48.135, 11.582],
  ['Frankfurt', 'DE', 50.11, 8.682],
  ['Barcelona', 'ES', 41.387, 2.169],
  ['Madrid', 'ES', 40.417, -3.704],
  ['Valencia', 'ES', 39.47, -0.376],
  ['Lisbon', 'PT', 38.722, -9.139],
  ['Porto', 'PT', 41.158, -8.629],
  ['Milan', 'IT', 45.464, 9.19],
  ['Rome', 'IT', 41.903, 12.496],
  ['Bologna', 'IT', 44.494, 11.343],
  ['Zurich', 'CH', 47.377, 8.542],
  ['Vienna', 'AT', 48.208, 16.373],
  ['Prague', 'CZ', 50.075, 14.438],
  ['Copenhagen', 'DK', 55.676, 12.568],
  ['Stockholm', 'SE', 59.329, 18.069],
  ['Oslo', 'NO', 59.913, 10.752],
  ['Warsaw', 'PL', 52.23, 21.012],
  ['Budapest', 'HU', 47.498, 19.04],
];
const artists = longParis.map((g) => g.artist);
const huge: PublicGigs = {
  mode: 'live',
  cities: many.map(([name, country, lat, lon], i) => {
    const total = Math.max(1, Math.round(640 / (i + 1)));
    return city(
      name,
      country,
      lat,
      lon,
      Array.from({ length: Math.min(12, total) }, (_, j) =>
        gig(
          artists[(i + j) % artists.length],
          `${name} Arena`,
          `2026-${11 + (j % 2)}-${String(1 + j).padStart(2, '0')}`,
        ),
      ),
      total,
    );
  }),
  stats: { shows: 12483, artists: 1906, cities: many.length, countries: 21 },
  waitlist: 23861,
};

export const fixtures: Record<Fixture, PublicGigs> = { worst, empty, one, huge };
