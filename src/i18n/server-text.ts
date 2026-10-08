import type { Locale } from './config';
import { cityName } from './names';

/**
 * The server speaks English: recommendation reasons, provider notes, alert templates and error
 * messages arrive as English sentences. This maps the ones Showbound writes itself to French.
 * Unknown text (a provider's own wording) is returned unchanged rather than guessed at.
 */
const exact: Record<string, string> = {
  // Recommendation tiers and reasons (src/domain/recommendations.ts)
  'Must see': 'Incontournable',
  'A favourite, live': 'Un favori, en live',
  'Artist you follow': 'Artiste suivi',
  'You follow this artist': 'Tu suis cet artiste',
  'Shares a genre with artists you follow': 'Un style proche des artistes que tu suis',
  'Discover a concert in your chosen region': 'Découvre un concert dans la zone que tu as choisie',
  Discover: 'À découvrir',
  'On your must-see list': 'Sur ta liste des incontournables',
  'One of your favourites': 'Un de tes favoris',
  'You saved this show': 'Tu as gardé ce concert',
  'Within your chosen travel region': 'Dans la zone que tu as choisie',
  'Outside your chosen travel region': 'Hors de la zone que tu as choisie',
  'Ticket range starts within your budget; trip total unknown':
    'Les billets commencent dans ton budget ; total du voyage inconnu',
  'Coming up within 30 days': 'Dans les 30 prochains jours',
  'Travel time still needs checking': 'Temps de trajet encore à vérifier',
  // Trip labels (src/domain/trip-scoring.ts)
  'Best value': 'Meilleur rapport',
  Cheapest: 'Le moins cher',
  Fastest: 'Le plus rapide',
  Easiest: 'Le plus simple',
  // Trip sources (src/domain/trip-sources.ts)
  'SNCF timetable': 'Horaires SNCF',
  'Fictional sample': 'Exemple fictif',
  'LiteAPI sandbox: test prices, not bookable': 'LiteAPI sandbox : prix de test, non réservable',
  // Rail coverage (src/server/providers/rail.ts)
  'Showbound covers trains within France for now.':
    'Showbound couvre les trains en France pour le moment.',
  'The concert is in your home area: no train needed.':
    'Le concert est près de chez toi : pas besoin de train.',
  'No TGV, OUIGO or Intercités train runs to this area. Regional TER is not covered yet.':
    'Aucun TGV, OUIGO ou Intercités ne dessert cette zone. Les TER ne sont pas encore couverts.',
  // Concert data notes (src/server/data.ts, src/server/providers/ticketmaster.ts)
  'Sample experience. All concerts, dates and prices shown are fictional.':
    'Mode démo. Tous les concerts, dates et prix affichés sont fictifs.',
  'Live listings from Ticketmaster. Coverage and prices may be incomplete.':
    'Concerts réels via Ticketmaster. La couverture et les prix peuvent être incomplets.',
  'Live data is not configured. Add a Ticketmaster API key or switch to sample mode in settings.':
    'Les données réelles ne sont pas configurées. Ajoute une clé API Ticketmaster ou passe en mode démo dans les réglages.',
  'Live concerts need a Ticketmaster API key. Sample mode remains available in settings.':
    'Les concerts réels demandent une clé API Ticketmaster. Le mode démo reste disponible dans les réglages.',
  'No live artists followed yet. Open Find live artists, search for an artist, and follow the correct result. Your sample selections are kept separately.':
    'Aucun artiste réel suivi pour l’instant. Ouvre « Trouver des artistes réels », cherche un artiste et suis le bon résultat. Tes choix de démo sont gardés à part.',
  'Concert provider check failed. We’ll retry in 15 minutes.':
    'La vérification des concerts a échoué. Nouvel essai dans 15 minutes.',
  'Concert listings are up to date. Coverage is limited to Ticketmaster.':
    'Les concerts sont à jour. La couverture se limite à Ticketmaster.',
  'This artist has too many linked records for this pilot. Contact support.':
    'Cet artiste a trop de fiches liées pour ce pilote. Contacte le support.',
  'Concert provider retry is scheduled. Please try again later.':
    'Une nouvelle vérification est prévue. Réessaie plus tard.',
  'The provider did not respond. Try again later.':
    'Le fournisseur n’a pas répondu. Réessaie plus tard.',
  'The provider has reached its request limit. Try again later.':
    'Le fournisseur a atteint sa limite de requêtes. Réessaie plus tard.',
  'The provider returned an unreadable response.':
    'Le fournisseur a renvoyé une réponse illisible.',
  // Alerts (src/server/data.ts)
  'Check the official seller for sale details.':
    'Vérifie les détails de la vente chez le vendeur officiel.',
  'A new opportunity for an artist you follow.': 'Une nouvelle date pour un artiste que tu suis.',
  // Errors (src/server/api.ts and friends)
  'Add your name.': 'Ajoute ton prénom.',
  'Choose artists from the live search to see real concerts.':
    'Choisis des artistes dans la recherche réelle pour voir de vrais concerts.',
  'The request could not be read.': 'La requête n’a pas pu être lue.',
  'The request is empty.': 'La requête est vide.',
  'Email or password is incorrect.': 'E-mail ou mot de passe incorrect.',
  'Sign in to continue.': 'Connecte-toi pour continuer.',
  'Enter your current password to delete your account.':
    'Saisis ton mot de passe actuel pour supprimer ton compte.',
  'Spotify did not grant top-artist access. Reconnect and approve it.':
    'Spotify n’a pas donné accès à tes artistes. Reconnecte-toi et accepte l’accès.',
  'This request did not come from this app. Reload and try again.':
    'Cette requête ne vient pas de l’app. Recharge la page et réessaie.',
  'Artist not found.': 'Artiste introuvable.',
  'Concert not found in this mode.': 'Concert introuvable dans ce mode.',
  'Concert not found.': 'Concert introuvable.',
  'Connect Spotify first.': 'Connecte d’abord Spotify.',
  'No device is subscribed. Turn notifications on first.':
    'Aucun appareil abonné. Active d’abord les notifications.',
  'This endpoint does not exist.': 'Cette adresse n’existe pas.',
  'Method not supported.': 'Méthode non prise en charge.',
  'This account could not be created. Try signing in.':
    'Ce compte n’a pas pu être créé. Essaie de te connecter.',
  'This request is too large.': 'Cette requête est trop lourde.',
  'Cannot save an inactive concert plan.': 'Impossible de garder un plan de concert inactif.',
  'Check the seller for changes before buying.':
    'Vérifie les changements chez le vendeur avant d’acheter.',
  'Reload your Spotify artists and choose again.':
    'Recharge tes artistes Spotify et choisis à nouveau.',
  'This concert changed. Check again before saving.':
    'Ce concert a changé. Vérifie à nouveau avant de le garder.',
  'This option is no longer current. Check again.':
    'Cette option n’est plus à jour. Vérifie à nouveau.',
  'Too many attempts. Please try again later.': 'Trop de tentatives. Réessaie plus tard.',
  'Add a Ticketmaster API key to search the live artist catalogue.':
    'Ajoute une clé API Ticketmaster pour chercher dans le catalogue réel.',
  'Music connection encryption is not configured.':
    'Le chiffrement de la connexion musicale n’est pas configuré.',
  'Push notifications are not set up on this server yet.':
    'Les notifications ne sont pas encore configurées sur ce serveur.',
  'This invite code is not valid. Ask the person who invited you.':
    'Ce code d’invitation n’est pas valide. Demande à la personne qui t’a invité.',
  'Live concerts are not available right now. Try again later or explore the demo.':
    'Les concerts réels ne sont pas disponibles pour le moment. Réessaie plus tard ou explore la démo.',
  'No current verified ticket link is available. Refresh concerts or check the seller directly.':
    'Aucun lien de billetterie vérifié pour le moment. Actualise les concerts ou va directement chez le vendeur.',
  'Spotify is not enabled for this pilot. Choose your artists manually.':
    'Spotify n’est pas activé pour ce pilote. Choisis tes artistes à la main.',
  'This music connection expired or could not be verified. Start again.':
    'Cette connexion musicale a expiré ou n’a pas pu être vérifiée. Recommence.',
  'Spotify did not grant a refresh token. Reconnect and approve access.':
    'Spotify n’a pas donné d’accès durable. Reconnecte-toi et accepte l’accès.',
  'Spotify access expired or was revoked. Reconnect Spotify in Settings.':
    'L’accès Spotify a expiré ou a été retiré. Reconnecte Spotify dans les réglages.',
  'Spotify artist identity could not be materialized.':
    'Cet artiste Spotify n’a pas pu être importé.',
  'Enter a valid email address.': 'Saisis une adresse e-mail valide.',
  'Pick a city from the list.': 'Choisis une ville dans la liste.',
  'Keep feedback under 2,000 characters.': 'Reste sous 2 000 caractères.',
  'Write a few words before sending.': 'Écris quelques mots avant d’envoyer.',
  'Use at least 12 characters': 'Utilise au moins 12 caractères',
  'This browser push service is not supported.':
    'Le service de notifications de ce navigateur n’est pas pris en charge.',
  'Check the form and try again.': 'Vérifie le formulaire et réessaie.',
  'The request could not be completed. Please try again.': 'La requête n’a pas abouti. Réessaie.',
  'Choose a supported home city': 'Choisis une ville prise en charge',
  'End date must be on or after start date': 'La date de fin doit suivre la date de début',
  'Something went wrong. Try again.': 'Un souci est survenu. Réessaie.',
  'Please try again.': 'Réessaie.',
  // Push (src/server/push.ts)
  'Showbound notifications are on': 'Les notifications Showbound sont activées',
  'New shows by the artists you follow will arrive here.':
    'Les nouvelles dates de tes artistes arriveront ici.',
  'Open Showbound to see every new match.': 'Ouvre Showbound pour voir toutes les nouveautés.',
};

type Rule = [RegExp, (...groups: string[]) => string];
const patterns: Rule[] = [
  [/^In your home city, (.+)$/, (city) => `Dans ta ville, ${cityName(city, 'fr')}`],
  [/^About (\d+) km between city centres$/, (km) => `Environ ${km} km entre les centres-villes`],
  [
    /^Choose (.+) from the live artist search to confirm its identity\.$/,
    (name) => `Choisis ${name} dans la recherche réelle pour confirmer son identité.`,
  ],
  [
    /^(\d+) sample artists? (?:was|were) skipped\.$/,
    (n) => (n === '1' ? '1 artiste de démo ignoré.' : `${n} artistes de démo ignorés.`),
  ],
  [/^(.+): sale within 24 hours$/, (artist) => `${artist} : vente dans moins de 24 h`],
  [
    /^(\d+) more concerts? for you$/,
    (n) => (n === '1' ? '1 autre concert pour toi' : `${n} autres concerts pour toi`),
  ],
  [
    /^(Sample event\. )?(.+), (\d{4}-\d{2}-\d{2})\. (.+)$/,
    (sample, venue, date, tail) =>
      `${sample ? 'Concert fictif. ' : ''}${venue}, ${date}. ${translate(tail, 'fr')}`,
  ],
];

function one(text: string): string | null {
  const value = text.trim();
  if (value in exact) return exact[value];
  for (const [pattern, render] of patterns) {
    const match = pattern.exec(value);
    if (match) return render(...match.slice(1).map((group) => group ?? ''));
  }
  return null;
}

/** Translate one server sentence, or several joined with spaces (sync summaries). */
export function translate(text: string | null | undefined, locale: Locale): string {
  if (!text) return '';
  if (locale === 'en') return text;
  const whole = one(text);
  if (whole !== null) return whole;
  const sentences = text.split(/(?<=[.!?])\s+/);
  const out: string[] = [];
  for (let i = 0; i < sentences.length;) {
    let matched = false;
    for (let j = sentences.length; j > i; j--) {
      const found = one(sentences.slice(i, j).join(' '));
      if (found !== null) {
        out.push(found);
        i = j;
        matched = true;
        break;
      }
    }
    if (!matched) out.push(sentences[i++]);
  }
  return out.join(' ');
}

/** Alert titles are "Artist in City" or "Artist: sale within 24 hours". */
export function translateAlertTitle(title: string, locale: Locale): string {
  if (locale === 'en') return title;
  const sale = one(title);
  if (sale !== null) return sale;
  // The last " in " splits it, so an artist called "Live in Paris" keeps its name.
  const match = /^(.+) in (.+)$/.exec(title);
  return match ? `${match[1]} à ${cityName(match[2], locale)}` : title;
}
