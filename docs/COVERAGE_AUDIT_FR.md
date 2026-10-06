# Audit de couverture des concerts en France (CON-38)

**Question** : quand un bêta-testeur suit ses artistes, Encore lui montre-t-il les concerts réellement annoncés en France ? Ticketmaster est aujourd'hui la seule source live.

**État au 2026-10-06**
- **Fait** : panel de 30 artistes, et relevé des dates annoncées publiquement en France sur 6 mois. Résultat : 107 dates, avec leurs sources.
- **Reste à faire** : la comparaison chiffrée avec Ticketmaster. Il faut la clé API locale de Victor, que l'assistant n'a pas pu utiliser dans cette session. Une seule commande suffit (section 4). Elle produit le tableau et le pourcentage de couverture dans `docs/coverage-audit-fr.results.md`.

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
  - `npm run audit:coverage-fr` interroge l'API officielle Discovery avec `countryCode=FR` et `locale=*`, en prenant chaque attraction dont le nom correspond exactement ;
  - une date est « couverte » si Ticketmaster liste ce même artiste à cette même date ;
  - pas de scraping : uniquement l'API que l'app utilise déjà.

**Limites**
- La liste publique peut être incomplète : petites salles, festivals d'hiver, dates ajoutées après le 6 octobre.
- Le script signale donc aussi les dates présentes **uniquement** sur Ticketmaster.

---

## 2. Dates annoncées publiquement (6 mois)

| Artiste | Genre | Dates FR annoncées | Villes | Remarque |
|---|---|---|---|---|
| Ninho | rap/pop FR | 33 | 27 | Quattro Tour, 20 janv. → 26 mars 2027. Prévente via France Billet |
| Orelsan | rap/pop FR | 30 | 9 | 19 oct. → 28 déc. 2026, dont 15 soirs à l'Accor Arena. Billetterie annoncée sur orelsan.show |
| Bigflo & Oli | rap/pop FR | 20 | 18 | Karma Tour, oct. → déc. 2026 |
| GIMS | rap/pop FR | 10 | 6 | Nantes, Lyon, Toulouse, Strasbourg, Orléans, Paris La Défense Arena |
| Josman | rap/pop FR | 10 | 10 | DPC Tour, 15 oct. → 7 nov. 2026 |
| Angèle | rap/pop FR | 4 | 2 | Reims (3 mars 2027), Accor Arena (8–10 mars 2027). Le reste de la tournée FR est à l'automne 2027 |
| Jul, SDM, Gazo, Tiakola, Aya Nakamura, Damso, Theodora, Zaho de Sagazan, Pierre Garnier | rap/pop FR | 0 | — | Tournées terminées, ou prochaines dates hors fenêtre (ex. SDM au Stade de France le 29 mai 2027) |
| Justice, Polo & Pan, Kungs, Fred again.., Charlotte de Witte, David Guetta | électro | 0 | — | Surtout des festivals d'été ; rien d'annoncé en salle d'ici avril 2027 |
| Dua Lipa, The Weeknd, Billie Eilish, Travis Scott, Sabrina Carpenter, Shakira, Imagine Dragons, Linkin Park, Coldplay | international | 0 | — | Stades l'été 2026 terminés ; 2027 pas encore annoncé en France |
| **Total** | | **107** | | **6 artistes sur 30** ont des dates dans la fenêtre |

---

## 3. Ce que ça veut déjà dire, avant le chiffre Ticketmaster

1. **Le risque n°1 n'est pas Ticketmaster, c'est le calendrier.** 24 artistes sur 30 n'ont **aucune** date annoncée en France d'ici avril 2027. Aucun fournisseur de billets n'y peut rien. Une bêta en octobre–novembre 2026 montrera donc un feed vide pour beaucoup d'artistes suivis. Il faut que l'app :
   - le dise clairement, avec des états vides explicites ;
   - pousse à suivre plus d'artistes ;
   - propose d'élargir la zone (réglage « Europe »).
2. **Les dates existantes se concentrent sur quelques tournées rap/pop FR de Zéniths et d'Arenas.** C'est là que la couverture Ticketmaster compte. Indices sur la billetterie, à confirmer par la mesure :
   - **Angèle** : tournée Live Nation. Sa page Live Nation utilise un identifiant d'attraction Ticketmaster, donc elle a de bonnes chances d'être couverte.
   - **Ninho** : prévente en marque blanche France Billet.
   - **Orelsan** : billetterie sur son propre site.

   Ninho et Orelsan sont donc les cas à risque.
3. **Prix** : déjà connu (CON-27). Beaucoup d'événements Ticketmaster FR n'ont pas de prix, et l'app affiche « Price not listed ».

---

## 4. Mesurer la couverture Ticketmaster (5 minutes, à faire par Victor)

1. Dans le dossier du projet, crée `.env.local` s'il n'existe pas. Le plus simple est de copier celui de l'ancien projet, qui contient déjà la clé :
   ```bash
   cp "$HOME/Documents/ChatGPT/Concert app/.env.local" "$HOME/Concert-APP/.env.local"
   ```
2. Lance l'audit. Il faut Node 22.18 ou plus récent.
   ```bash
   npm run audit:coverage-fr
   ```
3. Le résultat s'affiche et il est enregistré dans `docs/coverage-audit-fr.results.md`. Demande ensuite à Claude Code de le commiter et d'appliquer la règle de décision ci-dessous.

---

## 5. Recommandation sur CON-28 (fournisseurs FR secondaires)

**Règle de décision**, appliquée au pourcentage global des 107 dates :

| Couverture Ticketmaster | Décision CON-28 |
|---|---|
| **≥ 80 %** | Ne bloque pas la bêta. CON-28 reste High et passe après la bêta |
| **50 – 80 %** | Ne bloque pas la bêta, mais l'app affiche une note de couverture (« Listings from Ticketmaster; some French tours sell elsewhere »). CON-28 passe **avant l'ouverture publique** |
| **< 50 %** | **Bloque la bêta.** CON-28 passe en Urgent : sans une seconde source (Fnac/France Billet, See Tickets, DICE ou Shotgun via leurs programmes officiels), les testeurs rap FR ne verront pas leurs concerts |

**Recommandation provisoire** : CON-28 **ne bloque pas** la bêta tant que la mesure n'est pas faite, et reste en High. Deux raisons :
- l'essentiel du manque vient du calendrier (24/30 artistes sans date), pas de la source ;
- la bêta est justement le moyen de vérifier si les testeurs remarquent des concerts manquants. La question 8 du script d'interview (`docs/BETA_KIT.md`) le demande explicitement.

À réviser dès que `npm run audit:coverage-fr` a tourné.
