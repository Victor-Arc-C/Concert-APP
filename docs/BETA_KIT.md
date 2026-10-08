# Kit bêta privée Showbound (CON-40)

Ce kit sert à recruter et suivre 10 à 20 vrais utilisateurs pendant 2 semaines. C'est Victor qui envoie les invitations : rien ici n'est envoyé ni activé automatiquement.

**Objectif de la bêta**
- savoir si la découverte de concerts et le clic vers la billetterie ont de la valeur ;
- tester l'idée du voyage pour un concert, à la main (Wizard-of-Oz).

**Critères de succès**
- au moins 10 utilisateurs activés en mode live. « Activé » = inscription faite, onboarding terminé en mode live, et au moins un vrai concert vu dans le feed. Tu le notes à la main dans le tableau (section 4) : le rapport hebdo affiche l'activation en `unavailable`, car elle n'est pas mesurable avec le consentement actuel ;
- 2 rapports hebdo (`npm run metrics:weekly`) ;
- un mémo de décision : continuer, changer d'angle ou arrêter.

---

## 1. Avant d'inviter (checklist)

- [ ] Les PR du milestone MVP sont fusionnées et la prod est verte (voir CON-22). Il faut au minimum la PR #13 (bouton « Send feedback ») et la PR #14 (`npm run metrics:weekly`) : ce kit s'appuie sur les deux.
- [ ] `CRON_SECRET` est défini dans Vercel (Production), et le cron `/api/jobs` a tourné au moins une fois : Vercel → projet concert-app → **Settings → Cron Jobs** (ou **Logs**, filtre `/api/jobs`) montre une exécution réussie.
- [ ] `BETA_INVITE_CODES` est défini dans Vercel avec les codes ci-dessous (section 3), puis la prod est redéployée.
- [ ] Tu as testé toi-même le parcours complet sur ton téléphone : code d'invitation → inscription → recherche d'un vrai artiste → feed → concert → lien billet → « Send feedback ».
- [ ] Ton compte et ceux de tes tests sont dans `METRICS_EXCLUDE` (voir `docs/ANALYTICS.md`).

---

## 2. Message d'invitation (WhatsApp)

À envoyer en message privé, pas dans un groupe : chaque personne reçoit le code de son groupe (section 3). L'app est en anglais pour l'instant ; le message le dit pour éviter la surprise.

> Salut [prénom] ! Je lance **Showbound**, une petite app qui te montre les concerts de TES artistes près de chez toi (ou un peu plus loin 👀) et t'envoie vers la billetterie officielle.
>
> Je cherche 15 personnes pour la tester pendant 2 semaines. Ça prend 3 minutes pour démarrer :
> 1. Va sur https://concert-app-drab.vercel.app/signup
> 2. Code d'invitation : **[CODE]**
> 3. Choisis 5 artistes que tu écoutes vraiment
>
> L'app est en anglais pour l'instant, et c'est une bêta : si un truc est bizarre, appuie sur « Send feedback », ça m'arrive direct 🙏
>
> Partant(e) ?

**Relance J+2** (seulement si pas de réponse) :

> Petit rappel pour Showbound 🙂 Si tu as 3 minutes cette semaine : https://concert-app-drab.vercel.app/signup, code **[CODE]**. Et si ce n'est pas ton truc, pas de souci, dis-le-moi !

---

## 3. Codes d'invitation (3 codes, NON activés)

Les codes donnent accès à l'inscription : ce sont des secrets. Ils ne sont donc **jamais écrits dans ce dépôt**. Tu les génères sur ton Mac et tu les gardes dans tes notes.

| Code | Pour qui |
|---|---|
| `ENCORE-AMIS-xxxxxx` | amis proches et entourage |
| `ENCORE-CAMPUS-xxxxxx` | camarades de promo et associations étudiantes |
| `ENCORE-SON-xxxxxx` | communautés musique (groupes de fans, assos de concerts) |

Avoir un code par groupe permet de voir d'où viennent les inscrits. L'app ne relie pas le code au compte : c'est à toi de noter qui a reçu quel code.

**Générer les 3 codes** : dans le Terminal, lance la commande ci-dessous et copie la ligne qu'elle affiche dans tes notes.

```bash
echo "ENCORE-AMIS-$(openssl rand -hex 3 | tr a-f A-F),ENCORE-CAMPUS-$(openssl rand -hex 3 | tr a-f A-F),ENCORE-SON-$(openssl rand -hex 3 | tr a-f A-F)"
```

**Pour les activer** :
1. Va sur le tableau de bord Vercel → projet **concert-app** → **Settings → Environment Variables** (lien direct : https://vercel.com/encore23/concert-app/settings/environment-variables).
2. Clique **Add New**.
3. Name : `BETA_INVITE_CODES`. Value : la ligne copiée (les 3 codes séparés par des virgules). Environment : **Production**.
4. Clique **Save**.
5. Redéploie : onglet **Deployments** → **⋯** sur le déploiement **Production** marqué **Current** (pas un « Preview ») → **Redeploy**.

Les codes sont sensibles à la casse. Pour en révoquer un, retire-le de la variable et redéploie.

---

## 4. Liste de recrutement (à remplir dans tes notes, pas ici)

**Données personnelles** : prénoms, budgets et notes d'interview restent dans tes notes personnelles (Notes, Google Sheet privé…). Ne les écris jamais dans ce fichier : il est dans git. Le tableau ci-dessous est seulement le modèle de colonnes.

Vise 25 noms pour obtenir environ 15 « oui ». Mélange les profils : rap/pop FR, électro, international, gens qui voyagent pour des concerts et gens qui n'y vont presque jamais.

| # | Prénom | Groupe / code | Écoute surtout | Invité le | Inscrit ? | Activé ? | Spotify allowlist ? | Interview J0 ? |
|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | |

**Spotify** : il n'y a que 5 places dans l'allowlist du mode développeur. Garde-les pour les 5 testeurs les plus actifs après J3. L'ajout se fait dans le Spotify Developer Dashboard → ton app → **User Management**, avec l'email de leur compte Spotify. Ça ne sert que si Spotify est activé en production. Sinon, Settings affiche « awaiting provider approval » et la recherche manuelle d'artistes suffit.

---

## 5. Script d'interview (10 minutes)

**Règles** :
- tu observes, tu n'aides pas ;
- tu demandes de penser à voix haute ;
- tu notes les mots exacts ;
- pas de question qui suggère la réponse (« c'est bien, non ? »).

**0:00 – Intro (1 min)**
« Merci ! Je teste l'app, pas toi : il n'y a pas de mauvaise réponse. Dis à voix haute ce que tu penses, même les trucs négatifs. »

**1:00 – Contexte (2 min)**
1. « Raconte-moi le dernier concert où tu es allé(e). Comment tu as su qu'il avait lieu ? »
2. « Tu as déjà raté un concert que tu aurais voulu voir ? Pourquoi ? »
3. « Où tu achètes tes billets d'habitude ? »

**3:00 – Observation (4 min)** : la personne utilise l'app sans aide.
4. Si c'est le J0 : « Inscris-toi et choisis tes artistes. » Sinon : « Montre-moi comment tu as utilisé l'app cette semaine. »
5. « Qu'est-ce que tu ouvrirais en premier ici ? Pourquoi ? »
6. « Ce concert t'intéresse ? Qu'est-ce qu'il te faudrait savoir avant d'acheter ? »
7. Note sans commenter : où la personne hésite, ce qu'elle ne trouve pas, si elle clique sur le lien billet.

**7:00 – Questions (2 min)**
8. « Il manquait un artiste ou un concert que tu connais ? Lequel ? » → à noter pour l'audit de couverture (CON-38).
9. « Sur 10, à quel point tu serais déçu(e) si l'app disparaissait demain ? Pourquoi ce chiffre ? »
10. La question voyage (section 6).

**9:00 – Fin (1 min)**
« Une seule chose à changer ? » Puis : « Merci ! Si quelque chose te surprend cette semaine, utilise Send feedback. »

**Après l'appel** : écris 3 lignes maximum dans la fiche du testeur, dans tes notes personnelles (ce qui a marché, ce qui a bloqué, la citation la plus forte).

---

## 6. Question Wizard-of-Oz : le voyage pour un concert

L'app ne réserve **aucun** transport ni hôtel (hors scope du MVP). On teste l'envie à la main, sans rien promettre.

**Pendant l'interview**, quand la personne regarde un concert dans une autre ville :

> « Imagine qu'Showbound te propose, pour ce concert, le train et un logement pas cher à côté de la salle, avec le prix total. Tu ferais le déplacement ? Jusqu'à combien tu serais prêt(e) à mettre en tout, billet compris ? »

**Puis, par WhatsApp à J7** (à tous les testeurs actifs) :

> Question rapide 🙂 Parmi les concerts que tu as vus dans Showbound, il y en a un pour lequel tu ferais le voyage (autre ville / autre pays) ? Si oui, lequel, et avec quel budget total max ? Je peux te faire un plan (train + logement) à la main, juste pour voir si c'est utile, sans engagement.

**Si quelqu'un dit oui** :
1. Fais le plan à la main sur les sites officiels (SNCF Connect, Booking…).
2. Envoie 2 options avec les prix réels du jour et leurs liens. N'invente jamais un prix ni une disponibilité.
3. Note s'il clique, s'il demande plus, s'il réserve. **Ne réserve jamais à sa place et ne prends pas de paiement.**

| Testeur | Concert | Ville | Budget max annoncé | Plan envoyé ? | A cliqué ? | A réservé ? |
|---|---|---|---|---|---|---|

---

## 7. Calendrier J0 / J7 / J14

**Choisis un lundi pour J0.** Le rapport hebdo couvre la semaine du lundi au dimanche (UTC) : avec un J0 un lundi, J7 et J14 tombent pile sur deux semaines complètes.

| Jour | Quoi | Qui | Résultat attendu |
|---|---|---|---|
| J-2 | Checklist section 1, codes activés, test complet sur ton téléphone | Victor | Prod prête |
| **J0** | Envoi des invitations (section 2). Interview ou observation de 3 testeurs pendant leur inscription (section 5) | Victor | 10+ inscrits sous 48 h |
| J2 | Relance des non-répondants. Lecture des feedbacks (requête SQL dans `docs/ANALYTICS.md`) | Victor | Bugs bloquants listés dans Linear |
| J3 | Attribution des 5 places Spotify aux plus actifs | Victor | |
| **J7** | Rapport hebdo `npm run metrics:weekly` + 5 interviews courtes + question voyage par WhatsApp | Victor | Rapport n°1 collé dans Linear (CON-40) |
| J8–J13 | Corrections des 1 ou 2 problèmes les plus cités | Claude Code | PR fusionnées |
| **J14** | Rapport hebdo n°2 + 5 interviews + mémo de décision | Victor (+ Claude pour la synthèse) | `docs/BETA_DECISION.md` : continuer / changer d'angle / arrêter |

**Le rapport hebdo se lance le lundi** : les métriques portent sur la semaine du lundi au dimanche (UTC), et les données analytics ne sont gardées que 30 jours.

---

## 8. Trame du mémo de décision (J14)

1. **Chiffres** : les métriques des 2 rapports, avec les effectifs. Rappel : sous 10 personnes, ce sont des anecdotes.
   - Deux des cinq métriques seront `unavailable` pour cette cohorte : l'activation (pas mesurable, compte-la à la main) et la rétention semaine 1 (il faut 14 jours d'observation après l'activation, plus le décalage du rapport).
   - Les trois autres sont mesurées : CTR des recommandations, taux de sauvegarde, CTR des liens billets.
2. **Ce que les gens ont dit** : les 5 citations les plus fortes et les thèmes qui reviennent.
3. **Couverture** : concerts ou artistes manquants cités par les testeurs (lien avec CON-38 et CON-28).
4. **Voyage** : combien ont dit oui, avec quels budgets, combien ont cliqué sur un plan fait à la main.
5. **Décision** : continuer, changer d'angle ou arrêter, avec la raison principale et la prochaine expérience.
