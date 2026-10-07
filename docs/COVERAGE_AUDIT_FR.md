# Audit de couverture des concerts en France (CON-38)

**Question** : quand un bêta-testeur suit ses artistes, Encore lui montre-t-il les concerts réellement annoncés en France ? Ticketmaster est aujourd'hui la seule source live.

**Mise à jour au 2026-10-07**

- Le panel contient 30 artistes et 107 dates de référence. La comparaison officielle Ticketmaster a été exécutée ; voir [les résultats générés](coverage-audit-fr.results.md).
- Le premier résultat brut (86/107, 80,4 %) était trompeur : une fiche française de Bigflo et Oli n'était pas sélectionnée, et deux dates de référence étaient incorrectes. Les corrections ciblées et leurs sources sont détaillées ci-dessous. Le taux final reste un taux de présence de dates dans ce panel, sans garantie sur l'affichage dans l'app ou sur l'exhaustivité française.
- **Résultat après corrections : 107/107 dates présentes (100 %)**, sans troncature signalée pour ce passage. Cela ne mesure ni les tarifs, ni la disponibilité des billets, ni l'ensemble des concerts français.

## Corrections vérifiées le 7 octobre

- **Bigflo & Oli** : la recherche officielle renvoie `K8vZ917KBrV` (« Bigflo & Oli ») et `K8vZ917pPdf` (« Bigflo et Oli »). La seconde fiche contient 27 enregistrements français dans la fenêtre, dont 19 des 20 anciennes dates de référence. L'alias est désormais déclaré explicitement dans le panel, sans modifier les règles d'identité de l'application ni assimiler globalement « et » et « & ».
- **Bigflo à Nantes** : la date de référence passe du 10 au **11 octobre 2026**, conformément à la [billetterie officielle Fnac Spectacles](https://www.fnacspectacles.com/artist/bigflo-et-oli/?inApp=true). L'événement Ticketmaster `ZkyMmBwZ1A7G_Zk` est à Saint-Herblain, au Zénith Nantes Métropole.
- **Orelsan à Strasbourg** : la référence passe du 19 au **20 octobre 2026**, conformément au [site officiel du Zénith](https://www.zenith-strasbourg.fr/evenement/orelsan/). Ticketmaster liste `ZkyMmBwZ1A7167-` à Eckbolsheim.

Les autres références conservent leur date de vérification du 6 octobre. Il ne s'agit pas d'une nouvelle vérification exhaustive du calendrier des 30 artistes. Les doublons de noms et les communes de salles en périphérie restent des risques pour le parcours réel : suivre la mauvaise fiche Bigflo peut produire un feed vide alors que Ticketmaster dispose des concerts.

---

## 1. Méthode

- **Panel** : 30 artistes qui reflètent un public étudiant français.
  - 15 rap/pop FR : Ninho, Jul, SDM, Gazo, Tiakola, Aya Nakamura, Angèle, Orelsan, Damso, Theodora, Zaho de Sagazan, GIMS, Josman, Pierre Garnier, Bigflo & Oli.
  - 6 électro : Justice, Polo & Pan, Kungs, Fred again.., Charlotte de Witte, David Guetta.
  - 9 internationaux : Dua Lipa, The Weeknd, Billie Eilish, Travis Scott, Sabrina Carpenter, Shakira, Imagine Dragons, Linkin Park, Coldplay.
  - Werenoi, prévu au départ, est décédé en 2025 : il est remplacé par Bigflo & Oli.
- **Fenêtre** : du 2026-10-06 au 2027-04-06, France uniquement. Belgique et Suisse sont exclues.
- **Référence publique** : les dates annoncées dans la presse musicale et les agendas, le plus souvent JDS, Infoconcert, Sortir à Paris et Fnac Spectacles. La source de chaque artiste est dans `docs/coverage-audit-fr.public.json`.
- **Unité** : une date de concert. Trois soirs à l'Accor Arena comptent pour 3.
- **Comparaison Ticketmaster** :
  - `npm run audit:coverage-fr` interroge l'API officielle Discovery avec `countryCode=FR` et `locale=*`, en prenant les noms exacts et les alias explicitement vérifiés du panel ;
  - une date est « couverte » si Ticketmaster liste ce même artiste à cette même date ;
  - pas de scraping : uniquement l'API que l'app utilise déjà.

**Limites**

- La liste publique peut être incomplète : petites salles, festivals d'hiver, dates ajoutées après le 6 octobre. Le script signale donc aussi les dates présentes **uniquement** sur Ticketmaster.
- Le script mesure si **Ticketmaster a la date**, pas si l'app l'affiche :
  - il additionne toutes les attractions Ticketmaster qui portent exactement le nom de l'artiste, alors que l'app suit l'attraction choisie par l'utilisateur ;
  - la comparaison se fait sur la date seulement (même artiste, même jour), sans vérifier la ville ;
  - un concert vendu seulement sous le nom d'un festival n'est pas compté.
- Si une ligne indique « TM attraction = **no** », vérifie le nom à la main (ex. « Bigflo et Oli » au lieu de « Bigflo & Oli ») avant de conclure : ces dates seraient comptées comme manquantes à tort.

---

## 2. Dates annoncées publiquement (6 mois)

| Artiste                                                                                                               | Genre         | Dates FR annoncées | Villes | Remarque                                                                                          |
| --------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------ | ------ | ------------------------------------------------------------------------------------------------- |
| Ninho                                                                                                                 | rap/pop FR    | 33                 | 27     | Quattro Tour, 20 janv. → 26 mars 2027. Prévente via France Billet                                 |
| Orelsan                                                                                                               | rap/pop FR    | 30                 | 9      | 20 oct. → 28 déc. 2026, dont 15 soirs à l'Accor Arena. Billetterie annoncée sur orelsan.show      |
| Bigflo & Oli                                                                                                          | rap/pop FR    | 20                 | 18     | Karma Tour, oct. → déc. 2026                                                                      |
| GIMS                                                                                                                  | rap/pop FR    | 10                 | 6      | Nantes, Lyon, Toulouse, Strasbourg, Orléans, Paris La Défense Arena                               |
| Josman                                                                                                                | rap/pop FR    | 10                 | 10     | DPC Tour, 15 oct. → 7 nov. 2026                                                                   |
| Angèle                                                                                                                | rap/pop FR    | 4                  | 2      | Reims (3 mars 2027), Accor Arena (8–10 mars 2027). Le reste de la tournée FR est à l'automne 2027 |
| Jul, SDM, Gazo, Tiakola, Aya Nakamura, Damso, Theodora, Zaho de Sagazan, Pierre Garnier                               | rap/pop FR    | 0                  | —      | Tournées terminées, ou prochaines dates hors fenêtre (ex. SDM au Stade de France le 29 mai 2027)  |
| Justice, Polo & Pan, Kungs, Fred again.., Charlotte de Witte, David Guetta                                            | électro       | 0                  | —      | Surtout des festivals d'été ; rien d'annoncé en salle d'ici avril 2027                            |
| Dua Lipa, The Weeknd, Billie Eilish, Travis Scott, Sabrina Carpenter, Shakira, Imagine Dragons, Linkin Park, Coldplay | international | 0                  | —      | Stades l'été 2026 terminés ; 2027 pas encore annoncé en France                                    |
| **Total**                                                                                                             |               | **107**            |        | **6 artistes sur 30** ont des dates dans la fenêtre                                               |

---

## 3. Ce que la mesure permet de conclure

1. **Le référentiel ne contient aucune date pour 24 artistes sur 30.** Cela ne prouve pas qu'aucune autre date n'est annoncée en France. Un feed vide peut venir du calendrier, de la couverture ou de la fiche suivie. Il faut que l'app :
   - le dise clairement, avec des états vides explicites ;
   - pousse à suivre plus d'artistes ;
   - propose d'élargir la zone (réglage « Europe »).
2. **Les dates de ce panel sont présentes chez Ticketmaster**, notamment les 33 dates Ninho et les 30 dates Orelsan. La billetterie annoncée ailleurs ne prouve donc pas à elle seule une absence de Discovery. Le cas Bigflo montre surtout qu'une autre fiche du même artiste peut contenir les dates : l'audit les regroupe, l'app suit une fiche choisie.
3. **Prix** : déjà connu (CON-27). Beaucoup d'événements Ticketmaster FR n'ont pas de prix, et l'app affiche « Price not listed ».

---

## 4. Reproduire la mesure Ticketmaster

1. Configure `TICKETMASTER_API_KEY` dans le `.env.local` ignoré de ce checkout, ou dans l'environnement du processus. Ne copie pas le fichier complet d'une autre instance et n'affiche pas la clé. Le script n'ouvre aucune base de données et ne modifie pas la production.
2. Lance l'audit. Il faut Node 22.18 ou plus récent.
   ```bash
   npm run audit:coverage-fr
   ```
3. Le résultat s'affiche et il est enregistré dans `docs/coverage-audit-fr.results.md`. Vérifie les différences auprès des sources officielles avant d'appliquer les seuils ci-dessous. Les réponses contenant plus de 200 événements par fiche sont signalées comme tronquées.

---

## 5. Recommandation sur CON-28 (fournisseurs FR secondaires)

**Règle de décision**, appliquée au pourcentage global des 107 dates. Regarde aussi le détail par artiste : Ninho et Orelsan font 63 dates sur 107. Si seuls ces deux-là manquent, le problème est leur billetterie (France Billet, site propre), pas Ticketmaster en général.

| Couverture Ticketmaster | Décision CON-28                                                                                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **≥ 80 %**              | Ne bloque pas la bêta. CON-28 reste High et passe après la bêta                                                                                                                                           |
| **50 – 80 %**           | Ne bloque pas la bêta, mais l'app affiche une note de couverture (« Listings from Ticketmaster; some French tours sell elsewhere »). CON-28 passe **avant l'ouverture publique**                          |
| **< 50 %**              | **Bloque la bêta.** CON-28 passe en Urgent : sans une seconde source (Fnac/France Billet, See Tickets, DICE ou Shotgun via leurs programmes officiels), les testeurs rap FR ne verront pas leurs concerts |

**Décision après mesure** : CON-28 reste en **High**, sans devenir un bloqueur de bêta pour la présence des dates de ce panel. Le taux corrigé dépasse le seuil de 80 %. Cette décision ne valide pas le lancement complet : la bonne fiche suivie, les filtres géographiques et les autres gates doivent être vérifiés dans le parcours réel.

CON-28 reste nécessaire pour les **prix** et pour élargir les sources au-delà de ce panel. La demande Awin est un chantier distinct ; l'audit de présence ne démontre aucun tarif disponible. Les interviews de bêta doivent continuer à relever les concerts manquants, avec artiste, ville, salle et date.

Validation : appels officiels en lecture seule, contrôles ciblés auprès des sources de salle/billetterie, `npm run check` (typecheck, lint, 219 tests). Aucun changement de données ou de règles de recommandation en production.
