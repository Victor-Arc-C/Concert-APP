'use client';
import Link from 'next/link';
import { useApp } from './context';
import { Brand, LanguageSwitch } from './ui';
import { useCue } from './stage/rig';
import { useI18n } from '@/i18n/client';

const unsplash = (label: string) => (
  <a href="https://unsplash.com" target="_blank" rel="noreferrer">
    {label}
  </a>
);
const licence = (label: string) => (
  <a href="https://unsplash.com/license" target="_blank" rel="noreferrer">
    {label}
  </a>
);
const cnil = (
  <a href="https://www.cnil.fr" rel="noreferrer">
    cnil.fr
  </a>
);

/**
 * Privacy notice and beta terms. Both languages state the same facts; only the wording changes.
 * Edit the two versions together.
 */
export function Privacy() {
  const { data } = useApp();
  const { t, locale } = useI18n();
  useCue('quiet');
  const contact = data.privacyContact;
  const configured = Boolean(contact?.controller && contact.email);
  return (
    <div className="document-page">
      <div className="doc-top">
        <Brand />
        <LanguageSwitch />
      </div>
      <h1>{t.privacy.title}</h1>
      {locale === 'fr' ? (
        <>
          <p>
            Showbound est un pilote gratuit, sur invitation. Cette page explique ce que nous
            conservons, pourquoi, où et pendant combien de temps, ainsi que les règles de la bêta.
            Les concerts et prix de démo sont fictifs.
          </p>
          <h2>Qui est responsable</h2>
          {configured ? (
            <p>
              Le responsable du traitement est {contact!.controller}. Pour toute question ou demande
              liée à tes données, écris à <a href={`mailto:${contact!.email}`}>{contact!.email}</a>.
            </p>
          ) : (
            <p className="inline-note" role="note">
              L’identité du responsable et le contact confidentialité ne sont pas encore configurés
              sur ce déploiement.
            </p>
          )}
          <h2>Ce que nous conservons</h2>
          <ul>
            <li>Ton compte : e-mail, prénom et mot de passe haché.</li>
            <li>
              Liste d’attente : si tu t’y inscris, ton e-mail et la ville choisie, gardés uniquement
              pour t’inviter à l’ouverture de Showbound.
            </li>
            <li>
              Tes réglages : ville, distance, dates, budget billets, choix de notifications et de
              consentement.
            </li>
            <li>
              Les artistes que tu suis ou mets en incontournables, les concerts que tu gardes ou
              écartes, les liens billetterie que tu ouvres, tes alertes dans l’app et les plans de
              voyage que tu gardes.
            </li>
            <li>
              Si tu actives les notifications sur un appareil : l’adresse push et les clés de
              chiffrement que ton navigateur nous donne pour cet appareil. Les titres d’alertes
              passent par le service push de l’éditeur de ton navigateur (Apple, Google, Mozilla ou
              Microsoft) pour l’atteindre.
            </li>
            <li>Les avis que tu choisis d’envoyer, avec l’écran d’où tu les envoies.</li>
            <li>Des statistiques d’usage facultatives, seulement si tu les actives.</li>
            <li>
              Si tu connectes Spotify : des jetons d’accès chiffrés et les artistes que tu
              confirmes.
            </li>
            <li>
              Les sessions de connexion (7 jours) et les tentatives de connexion musicale en cours.
            </li>
            <li>
              Pour la sécurité : des compteurs de limitation indexés par une empreinte de ton e-mail
              ou de ton identifiant de compte, et des journaux d’erreurs sans donnée personnelle.
              Notre hébergeur conserve aussi des journaux de requêtes standards (comme l’adresse IP
              et le navigateur) selon sa propre politique de conservation.
            </li>
          </ul>
          <h2>Pourquoi (base légale)</h2>
          <p>
            Ton compte, tes réglages, artistes, concerts gardés, alertes, voyages et liens
            billetterie sont nécessaires pour fournir le service auquel tu t’es inscrit (contrat).
            Les statistiques d’usage et la connexion Spotify reposent sur ton consentement, que tu
            peux retirer à tout moment dans les réglages. Les avis bêta, compteurs de sécurité et
            journaux d’erreurs reposent sur notre intérêt légitime à faire fonctionner et améliorer
            un pilote sûr. Nous ne vendons ni données personnelles ni profils d’écoute.
          </p>
          <h2>Où</h2>
          <p>
            L’app est hébergée par Vercel et la base de données par Neon (PostgreSQL géré). Au
            moment de la rédaction, les serveurs de l’application Showbound tournent aux États-Unis
            : tes données peuvent donc être traitées hors de l’Union européenne, selon les
            conditions de traitement de ces prestataires. Demande-nous si tu veux connaître les
            régions actuelles ou les garanties de transfert.
          </p>
          <p>
            Sur la page d’accueil publique uniquement, un script de Travelpayouts (réseau
            d’affiliation voyage, partenaire d’Aviasales) est chargé : il peut transformer des liens
            de voyage en liens affiliés et utiliser ses propres cookies, selon sa politique de
            confidentialité. Il ne tourne pas dans l’app et n’a pas accès à ton compte.
          </p>
          <h2>Combien de temps</h2>
          <ul>
            <li>
              Données de compte, réglages, artistes, incontournables, concerts gardés, liens
              billetterie, alertes, voyages et avis : jusqu’à la suppression de ton compte.
            </li>
            <li>
              Appareils de notification : jusqu’à ce que tu les désactives, que le navigateur retire
              l’autorisation ou que tu supprimes ton compte.
            </li>
            <li>Sessions de connexion : 7 jours.</li>
            <li>Statistiques d’usage : 30 jours, ou immédiatement quand tu les désactives.</li>
            <li>Compteurs de limitation de sécurité : 2 à 3 jours.</li>
            <li>
              Les données supprimées peuvent rester dans les sauvegardes du fournisseur de base de
              données jusqu’à leur expiration, selon sa fenêtre de restauration.
            </li>
          </ul>
          <h2>Tes droits</h2>
          <p>
            Tu peux consulter et télécharger tes données (Réglages → Exporter mes données), les
            corriger (Réglages), retirer ton consentement (Réglages) et supprimer ton compte et ses
            données (Réglages → Supprimer le compte). La suppression retire immédiatement de la base
            active les données liées au compte. Tu peux aussi nous contacter pour l’accès, la
            rectification, l’effacement, la limitation ou l’opposition, et tu as le droit de déposer
            une réclamation auprès de la CNIL ({cnil}).
          </p>
          <h2>Spotify</h2>
          <p>
            Le connecteur n’est actif que pour les comptes pilotes validés. Il demande l’accès à tes
            artistes les plus écoutés, affiche leurs noms pour que tu choisisses, et conserve des
            jetons d’accès chiffrés. Nous ne gardons aucune statistique d’écoute Spotify. La
            déconnexion supprime les jetons et les tentatives de connexion en cours. Tu peux aussi
            retirer l’accès à Showbound depuis ton compte Spotify.
          </p>
          <h2>Conditions de la bêta</h2>
          <ul>
            <li>
              Le pilote est gratuit, peut changer ou s’arrêter à tout moment, et n’offre aucune
              garantie.
            </li>
            <li>
              Les concerts, dates et prix viennent de tiers et peuvent être incomplets ou dépassés.
              Vérifie toujours chez le vendeur avant d’acheter ou de partir.
            </li>
            <li>
              Showbound ne vend aucun billet et ne réserve aucun voyage. Tout achat se fait entre
              toi et le vendeur.
            </li>
            <li>Ton code d’invitation est propre à ton groupe. Ne le partage pas publiquement.</li>
          </ul>
          <h2>Concerts et sources</h2>
          <p>
            Les données de concerts réels viennent de Ticketmaster lorsqu’il est configuré. Les
            fourchettes de prix affichées sont indicatives et peuvent exclure des frais. La
            disponibilité est confirmée par le vendeur. Aucune commission d’affiliation n’est active
            dans ce pilote. Les trajets et hôtels ne sont ni chiffrés ni réservés.
          </p>
          <h2>Photographie</h2>
          <p>
            Ambiance de concert générique issue d’{unsplash('Unsplash')}, utilisée sous la{' '}
            {licence('licence Unsplash')}. Ces images ne représentent pas les concerts de démo cités
            et n’impliquent aucun soutien d’artiste.
          </p>
        </>
      ) : (
        <>
          <p>
            Showbound is a free, invite-only pilot. This page explains what we store, why, where and
            for how long, and the rules of the beta. Sample concerts and prices are fictional.
          </p>
          <h2>Who is responsible</h2>
          {configured ? (
            <p>
              The data controller is {contact!.controller}. For any privacy question or request,
              write to <a href={`mailto:${contact!.email}`}>{contact!.email}</a>.
            </p>
          ) : (
            <p className="inline-note" role="note">
              The controller identity and privacy contact are not configured on this deployment yet.
            </p>
          )}
          <h2>What we store</h2>
          <ul>
            <li>Your account: email, name and a hashed password.</li>
            <li>
              Waitlist: if you join it, your email and the home city you chose, kept only to invite
              you when Showbound opens.
            </li>
            <li>
              Your settings: home city, distance, dates, ticket budget, notification and consent
              choices.
            </li>
            <li>
              Artists you follow or mark as must-see, concerts you save or dismiss, ticket links you
              open, your in-app alerts and the trip plans you save.
            </li>
            <li>
              If you turn on notifications on a device: the push address and encryption keys your
              browser gives us for that device. Alert titles are sent through your browser
              vendor&apos;s push service (Apple, Google, Mozilla or Microsoft) to reach it.
            </li>
            <li>Feedback you choose to send, with the screen you sent it from.</li>
            <li>Optional usage analytics, only if you turn them on.</li>
            <li>If you connect Spotify: encrypted access tokens and the artists you confirm.</li>
            <li>Sign-in sessions (7 days) and pending music-connection attempts.</li>
            <li>
              For security: rate-limit counters keyed by a hash of your email or account ID, and
              error logs that contain no personal data. Our hosting provider also keeps standard
              request logs (such as IP address and browser) under its own retention policy.
            </li>
          </ul>
          <h2>Why (legal basis)</h2>
          <p>
            Your account, settings, artists, saves, alerts, trips and ticket-link records are needed
            to provide the service you signed up for (contract). Usage analytics and the Spotify
            connection rely on your consent, which you can withdraw in settings at any time. Beta
            feedback, security counters and error logs rely on our legitimate interest in running
            and improving a safe pilot. We do not sell personal data or listening profiles.
          </p>
          <h2>Where</h2>
          <p>
            The app is hosted by Vercel and the database by Neon (managed PostgreSQL). At the time
            of writing, Showbound&apos;s application servers run in the United States, so your data
            may be processed outside the European Union, under these providers&apos; data processing
            terms. Ask us if you want the current regions or the transfer safeguards.
          </p>
          <p>
            On the public home page only, a script from Travelpayouts (a travel affiliate network,
            Aviasales&apos; partner programme) is loaded: it may turn travel links into affiliate
            links and use its own cookies, under its own privacy policy. It does not run inside the
            app and has no access to your account.
          </p>
          <h2>How long</h2>
          <ul>
            <li>
              Account data, settings, artists, must-see choices, saves, ticket-link records, alerts,
              trips and feedback: until you delete your account.
            </li>
            <li>
              Notification devices: until you turn them off, the browser withdraws permission, or
              you delete your account.
            </li>
            <li>Sign-in sessions: 7 days.</li>
            <li>Usage analytics: 30 days, or immediately when you turn them off.</li>
            <li>Security rate-limit counters: 2 to 3 days.</li>
            <li>
              Deleted data can remain in the database provider&apos;s backups until they expire
              under its restore window.
            </li>
          </ul>
          <h2>Your rights</h2>
          <p>
            You can see and download your data (Settings → Export my data), correct it (Settings),
            withdraw consent (Settings), and delete your account and its data (Settings → Delete
            account). Deletion removes account-linked records from the active database immediately.
            You can also contact us for access, correction, deletion, restriction or objection, and
            you have the right to complain to the CNIL ({cnil}).
          </p>
          <h2>Spotify</h2>
          <p>
            The connector is only active for approved pilot accounts. It requests top-artist access,
            shows artist names for you to choose, and stores encrypted access tokens. We do not keep
            Spotify listening metrics. Disconnecting removes tokens and pending connection attempts.
            You may also revoke Showbound in your Spotify account.
          </p>
          <h2>Beta terms</h2>
          <ul>
            <li>
              The pilot is free, may change or stop at any time, and comes without any guarantee.
            </li>
            <li>
              Listings, dates and prices come from third parties and may be incomplete or out of
              date. Always check the seller before buying or travelling.
            </li>
            <li>
              Showbound sells no tickets and books no travel. Any purchase is between you and the
              seller.
            </li>
            <li>Your invite code is personal to your group. Please do not share it publicly.</li>
          </ul>
          <h2>Listings and sources</h2>
          <p>
            Live event data comes from Ticketmaster when configured. Listed price ranges are
            indicative and may exclude fees. Availability is confirmed by the seller. No affiliate
            commission is active in this pilot. Travel and hotels are not quoted or booked.
          </p>
          <h2>Photography</h2>
          <p>
            Generic concert atmosphere from {unsplash('Unsplash')}, used under the{' '}
            {licence('Unsplash licence')}. These images do not depict the named sample events or
            imply artist endorsement.
          </p>
        </>
      )}
      <Link className="button secondary" href="/app">
        {t.privacy.back}
      </Link>
    </div>
  );
}
