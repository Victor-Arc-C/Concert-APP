# Ticket-price access requests

Prepared on 7 October 2026. These are drafts for Victor to review and submit; none has been sent. They make no claim about audience size, approved partnerships or existing affiliate income. Keep personal details, keys and provider replies outside this public repository.

## Fnac Spectacles / France Billet — first request

Start from [programme 12494 on Awin](https://ui.awin.com/publisher-signup/fr/awin?advertiser=12494). After obtaining access, use the programme's business contact to confirm the feed specification. The [France Billet affiliate page](https://www.francebillet.com/campaign/affiliation-partenaire) confirms XML catalogue tools; it does not guarantee exact-session tariffs.

**Objet : Encore — accès au flux Fnac Spectacles et tarifs des concerts**

Bonjour,

Je développe Encore, une application qui permet de suivre ses artistes favoris, de retrouver leurs concerts et d’accéder à la billetterie. Le projet est en phase pilote en France : https://concert-app-drab.vercel.app.

Je souhaite rejoindre le programme Fnac Spectacles 12494 et utiliser votre flux catalogue officiel. Pourriez-vous me confirmer :

- si le flux donne un tarif et une devise pour chaque séance, avec sa date, sa salle et son identifiant ;
- si ce tarif correspond à une offre publique disponible, quels frais sont inclus et comment sont signalés les tarifs réservés aux adhérents ;
- les conditions d’accès, d’affichage, d’attribution, de mise en cache et de mise à jour ;
- s’il est possible d’obtenir la documentation et un petit export d’exemple avant l’intégration ?

L’achat restera entièrement sur votre site. Nous cherchons notamment à couvrir Tame Impala à Paris le 12 juin 2027, L2B à Toulouse le 5 mars 2027 et Malcolm Todd à Paris le 22 février 2027. Si ces dates ne sont pas dans votre catalogue, un échantillon de concerts français suffira pour vérifier les champs.

Merci pour votre aide,
Victor

## Weezevent — second request

Route: [official business contact](https://weezevent.com/fr/contact/aide-service-client/). Ask for the API/partner-calendar team. Creating an organizer account alone does not prove access to other organizers' ticket classes.

**Objet : Encore — accès partenaire au calendrier et aux tarifs Weezevent**

Bonjour,

Je développe Encore, une application de découverte de concerts en phase pilote en France : https://concert-app-drab.vercel.app. Les utilisateurs suivent leurs artistes et ouvrent ensuite la billetterie officielle.

Votre documentation décrit la recherche d’événements externes via `/event/search/` et des fourchettes de prix. Je souhaiterais savoir si Encore peut obtenir un accès partenaire pour afficher ces événements et leurs tarifs.

Pourriez-vous préciser les conditions d’accès au calendrier, la couverture des concerts, la devise et les frais associés aux prix, ainsi que les limites d’appels et de cache ? Les tarifs des événements externes sont-ils accessibles, et les offres privées ou épuisées sont-elles identifiées ?

Un accès de test ou un export représentatif avec des identifiants de séance, des tarifs et des liens de réservation nous permettrait de valider l’intégration. Nous n’avons besoin ni des données des acheteurs ni d’un accès à leurs commandes.

Merci,
Victor

## Ticketmaster — clarify French prices

Use the [Partner with Us form](https://developer.ticketmaster.com/partners/), reached from [official contact routing](https://developer.ticketmaster.com/support/contact-us/). Developer credential issues belong in the separate developer-support form.

**Product:** Encore is an artist-first concert discovery pilot for France and nearby Europe. Users follow artists, find upcoming shows and continue to the official seller. https://concert-app-drab.vercel.app.

**Current scale:** Private pilot. No audience or sales-volume claim is supplied in this request.

**Requested partnership:** We currently use Discovery. French events `ZkyMmBwZ1A78Z_Z`, `ZkyMmBwZ1A7FPx4` and `ZkyMmBwZ1A783qA` return successful detail responses without price ranges. Is there an approved French data product supplying current ticket prices for these exact events? We understand that Discovery Feed shares the Discovery source and that affiliate approval does not establish Partner Commerce API access. Please confirm price coverage, identifier mapping, fee semantics, permitted display/cache rules, credentials and access cost before we implement anything.

**Purchase journey:** Encore shows the source and a validated ticket link; checkout and fulfilment remain with the seller.

## What to return to the implementation task

Provide the approved provider name, specification, a small permitted sample and the written display/cache terms. Store credentials only in server secrets; never paste them into chat, an issue, a PR or this document. A links-only approval does not unblock ticket-price integration.
