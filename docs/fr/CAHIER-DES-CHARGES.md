# Kiroween 2026 — Le Voyage d'un paquet : cahier des charges

Document de cadrage rédigé le 11 novembre 2026 pour l'idée n° 126. Il suit les conventions du premier document, [kiroween-2026-cahiers-des-charges.md](kiroween-2026-cahiers-des-charges.md) (règles du concours, grille du jury, socle technique, notation des exigences), et se lit seul. Il est écrit pour être donné tel quel à Kiro comme matière première de ses specs.

Sources vérifiées le 11 novembre 2026 : les conditions d'usage des données (TeleGeography, PeeringDB, DB-IP, IPinfo, Natural Earth, RIPE Atlas), les API de RIPE (IPmap, RIPEstat, Atlas), la page de manuel de `mtr`, la documentation de MapLibre, et l'état de l'art (Nautilus, NextTrace, Open Visual Traceroute). Ce qui n'a pas pu être vérifié est marqué **À vérifier** et rassemblé en annexe D. Les distances et délais des exemples ont été calculés, pas estimés ; les charges en jours et les cibles de performance sont des évaluations.

## Sommaire

- [1. En bref](#en-bref)
- [2. Fiche d'identité](#fiche)
- [3. Problème et public](#probleme)
- [4. Objectifs, non-objectifs, indicateurs](#objectifs)
- [5. Ce que l'outil peut savoir : le contrat d'honnêteté](#honnetete)
- [6. Données et licences](#donnees)
- [7. Chaîne de traitement](#traitement)
- [8. Parcours utilisateurs](#parcours)
- [9. Exigences fonctionnelles](#exigences-f)
- [10. Exigences non fonctionnelles](#exigences-n)
- [11. Architecture technique](#architecture)
- [12. Interface et direction artistique](#interface)
- [13. Propriétés à tester](#proprietes)
- [14. Stratégie Kiro](#kiro)
- [15. Plan de réalisation](#plan)
- [16. Risques et parades](#risques)
- [17. Démonstration et soumission](#demo)
- [18. Recette](#recette)
- [19. Questions ouvertes](#questions)
- [Annexes — glossaire, exemples d'entrées, sources, points à vérifier](#annexes)

---

<a id="en-bref"></a>

## 1. En bref

Tu tapes une adresse de site. Ta requête quitte ta box, traverse des villes, passe par un point d'échange, plonge sous un océan et ressort sur un autre continent, le tout en moins d'un dixième de seconde. **Le Voyage d'un paquet** rend ce trajet visible : il prend la sortie d'un `traceroute`, place chaque étape sur une carte du monde, montre les câbles sous-marins compatibles avec chaque traversée, et dit honnêtement ce qui est mesuré, ce qui est déduit et ce qui est supposé.

| | |
|---|---|
| Catégorie | Frankenstein |
| Chimère | Un diagnostic réseau de 1987 × la géographie des câbles et des points d'échange × la vitesse de la lumière comme garde-fou |
| Périmètre minimal | 8 jours, plus 1,5 jour de soumission ; périmètre réduit possible en 6 jours (voir 15) |
| Prix visés | Best Frankenstein, prix globaux, Best Demo |

**Trois décisions qui structurent tout le reste**

1. **Un navigateur ne peut pas tracer une route.** Il n'a accès ni aux paquets bruts ni au compteur de sauts. Le produit a donc deux moitiés : un outil en ligne de commande qui enveloppe le `traceroute` de la machine, et un site statique qui affiche un « voyage » (collé, déposé, ou choisi dans une galerie). Le site hébergé n'émet jamais de sonde.
2. **On ne peut pas savoir quel câble un paquet a emprunté.** Aucune mesure ne le dit. Le produit parle de câbles **compatibles** avec une traversée, classés par vraisemblance, jamais de câble « emprunté ». Cette retenue est le cœur du produit, pas une faiblesse.
3. **La lumière sert de détecteur de mensonge.** Une étape qui répond en 9,6 ms depuis Lyon ne peut pas être à Ashburn, quoi qu'en dise une base de géolocalisation : en 9,6 ms aller-retour, rien ne parcourt plus de 1 439 km. Toute localisation physiquement impossible est rejetée, et le rejet est montré.

**Place dans le concours.** Le projet est en Frankenstein, comme Suture et Heures fantômes du premier document : les trois se disputeraient le même prix de catégorie. Recommandation : il remplace Suture, le plus risqué des cinq, plutôt qu'il ne s'y ajoute. Au 11 novembre, il reste 23 jours avant la clôture du 4 décembre.

---

<a id="fiche"></a>

## 2. Fiche d'identité

| | |
|---|---|
| Nom de travail | Le Voyage d'un paquet. En anglais : « Packet Voyage ». Commande : `voyage`. **À vérifier** : disponibilité du nom sur npm et absence de marque homonyme. |
| Trigramme des exigences | `VOY` |
| Catégorie | Frankenstein |
| Chimère | `traceroute` (un outil de diagnostic de 1987, en texte) × systèmes d'information géographique (géométries de câbles, landmasses, projections) × physique (vitesse de la lumière dans le vide et dans la fibre) × données publiques d'infrastructure |
| En une phrase | Un diagnostic réseau cousu à la géographie : tu suis le trajet physique de ta requête, sa distance, les pays et les réseaux traversés, et les câbles sous-marins compatibles avec chaque traversée. |
| Public | Enseignants et élèves, développeurs et administrateurs qui enquêtent sur une latence, curieux et journalistes qui veulent comprendre une coupure de câble. |
| Idée centrale | Internet est un objet physique. Une mesure de délai est une mesure de distance : la lumière borne ce qui est possible, et cette borne suffit à trier le vrai du faux. |
| Ce qui existe déjà | Des traceroutes « visuels » qui posent des points sur une carte en faisant confiance à une base de géolocalisation (NextTrace, Open Visual Traceroute). Un outil de recherche, Nautilus (université de Californie à Irvine), qui associe des liens IP à des câbles sous-marins avec un score de confiance, à partir de centaines de millions de traces. Des cartes de câbles, sans lien avec ta propre connexion. |
| Ce qui est différent | Ta propre trace, sur ta machine ; la contrainte de la lumière appliquée à chaque étape et montrée ; trois niveaux de certitude visibles partout ; des câbles « compatibles », jamais affirmés ; un récit de voyage lisible par un élève de quinze ans ; rien d'envoyé sans accord. |
| Prix visés | Best Frankenstein, prix globaux, Best Demo. |

---

<a id="probleme"></a>

## 3. Problème et public

**Situation de départ.** Inès enseigne les sciences numériques en classe de seconde. Le chapitre « Internet » dit que les données « voyagent par des câbles ». Ses élèves pensent au Wi-Fi et au « nuage ». Elle voudrait leur montrer qu'une requête vers un site américain traverse réellement l'Atlantique, par où, et en combien de temps. La commande `traceroute` lui donne dix lignes d'adresses et de millisecondes que personne dans la salle ne sait lire.

Le même texte illisible arrive sur l'écran de Karim, développeur : son API répond en 280 ms depuis Singapour alors que le serveur est à Francfort. Le détour est quelque part dans ces lignes, mais où ?

Pourquoi le problème persiste :

- La sortie de `traceroute` est faite pour des spécialistes : des adresses, des noms cryptiques, des délais.
- Les outils qui dessinent une carte font confiance à une seule base de géolocalisation. Or ces bases situent souvent un routeur là où son propriétaire est enregistré, pas là où il est branché : on voit des paquets « passer » par le siège social d'un opérateur.
- Les cartes de câbles sous-marins sont magnifiques et sans rapport avec la connexion de celui qui les regarde.
- Les outils de recherche sont rigoureux et inaccessibles au grand public.

**Personas**

- **Inès, enseignante.** Elle veut une démonstration de dix minutes, sans installation en salle, avec une fiche d'activité. Elle a besoin que l'outil ne dise rien de faux devant trente élèves.
- **Karim, développeur.** Il veut voir en un coup d'œil où une route fait un détour, comparer IPv4 et IPv6, et envoyer le résultat à son hébergeur sans exposer son adresse.
- **Lucie, curieuse ou journaliste.** Une coupure de câble fait l'actualité. Elle veut savoir si ses propres connexions passent par cette région, et ce qu'on peut honnêtement en dire.
- **Un agent IA (option).** Dans Kiro, un agent à qui l'on demande « pourquoi cette API est-elle lente d'ici ? » appelle l'outil et raisonne sur un trajet structuré plutôt que sur du texte brut.

**Usage exclu.** L'outil situe des routeurs, pas des personnes. Il ne cherche pas à localiser une adresse résidentielle, n'affiche jamais plus fin que la ville, et masque par défaut le point de départ de l'utilisateur dans tout ce qui se partage.

---

<a id="objectifs"></a>

## 4. Objectifs, non-objectifs, indicateurs

**Objectifs**

- O1 — Passer d'une trace brute à un trajet compréhensible en moins de dix secondes.
- O2 — Ne jamais afficher une localisation que la physique interdit.
- O3 — Faire porter à chaque information son niveau de certitude : mesuré, déduit, supposé.
- O4 — Fonctionner sans installation pour qui veut seulement voir (galerie, trace collée), et en une commande pour qui veut tracer.
- O5 — Ne rien envoyer hors de la machine sans accord explicite, et ne rien partager qui révèle le point de départ.

**Non-objectifs**

- Pas un outil de supervision ni de mesure continue : une trace à la fois, à la demande.
- Pas un scanner : un seul hôte par commande, aucune plage d'adresses, aucune découverte de ports.
- Pas une vérité sur les câbles : l'outil ne prétend jamais savoir lequel a été emprunté.
- Pas un outil de localisation de personnes.
- Pas de simulation de coupure de câble ni de calcul de résilience dans cette édition (c'est le terrain de la recherche, voir Nautilus et ses suites).
- Pas de chemin de retour : un traceroute ne voit que l'aller.

**Indicateurs**

| Indicateur | Cible |
|---|---|
| Localisations physiquement impossibles affichées | Zéro, garanti par les propriétés VOY-P-06 et VOY-P-07 |
| Étapes publiques localisées au niveau « solide » ou « probable » sur la galerie | Au moins 70 % — mesuré **76,7 %** (33 sur 43) |
| Étapes publiques localisées au niveau « solide » ou « probable » sur des traces réelles | Indicateur descriptif (aucune cible d'acceptation ; la base `geodb` ne fait que 0,3) | **25,6 %** (11 sur 43). Donné à côté du taux tous niveaux pour distinguer « situé » de « confirmé » |
| Étapes publiques localisées, à quelque niveau de confiance que ce soit, sur des traces réelles | Au moins 70 % — mesuré **86,0 %** (37 sur 43). C'est le ratio que la base locale déplace : 34,9 % (15 sur 43) sans elle |
| Temps entre la fin de la trace et l'affichage du trajet, cache chaud | Moins de 3 secondes |
| Libellés affirmant un câble « emprunté » | Zéro, vérifié par un contrôle automatique du vocabulaire |
| Requêtes réseau du site hébergé sans accord | Zéro après le chargement |
| Fausses localisations rejetées par la lumière | Comptées et affichées par voyage : c'est le chiffre de la démonstration |

---

<a id="honnetete"></a>

## 5. Ce que l'outil peut savoir : le contrat d'honnêteté

### 5.1 Ce que mesure un traceroute

Chaque paquet porte un compteur de sauts, le TTL. Chaque routeur le diminue de un ; celui qui le fait tomber à zéro détruit le paquet et renvoie un message d'erreur à l'expéditeur. `traceroute` envoie des paquets avec un TTL de 1, puis 2, puis 3 : chaque message d'erreur révèle l'adresse d'un routeur du chemin et le temps de l'aller-retour.

Ce qui est donc **mesuré** : une adresse par étape (celle de l'interface qui a répondu) et un délai aller-retour, le RTT, en millisecondes. Rien d'autre.

### 5.2 Ce qu'il ne voit pas

| Limite | Conséquence | Réponse du produit |
|---|---|---|
| Le chemin de retour est invisible et souvent différent de l'aller | Le délai d'une étape mélange deux chemins ; la différence de délai entre deux étapes voisines n'est pas fiable | Raisonner sur l'enveloppe des délais (7.6), jamais sur une différence brute |
| Un routeur peut répondre lentement ou pas du tout (réponses limitées en débit, filtrées) | Étapes muettes (`* * *`), délais gonflés | Les étapes muettes restent des trous comptés ; aucune position n'est inventée |
| Tunnels MPLS | Des routeurs intermédiaires sont cachés ; deux étapes voisines peuvent être séparées de milliers de kilomètres | Un long segment n'est pas une anomalie ; l'étiquette MPLS est affichée quand l'outil de mesure la fournit |
| Répartition de charge (plusieurs chemins parallèles) | Plusieurs adresses répondent pour une même étape | Toutes les réponses sont conservées ; le trajet principal suit la plus fréquente, les autres sont montrées en variantes |
| Anycast (une même adresse annoncée depuis des dizaines de sites) | La « position » d'une adresse dépend de qui demande | L'étape est marquée anycast ; seule une instance compatible avec le délai est retenue |
| Géolocalisation d'adresses | Les bases situent souvent le siège de l'opérateur, pas le routeur | Plusieurs sources croisées, puis filtrées par la lumière (7.5 à 7.7) |
| Le support physique n'est pas observable | Impossible de savoir quelle fibre, quel câble, quel tracé | Tracé dessiné comme **supposé** ; câbles « compatibles » seulement |
| Le premier kilomètre appartient à l'utilisateur | La trace révèle sa box, son opérateur, sa ville | Caviardage par défaut de tout ce qui se partage (VOY-F-38) |

### 5.3 Trois niveaux de certitude

| Niveau | Ce qui en relève | Rendu à l'écran |
|---|---|---|
| **Mesuré** (*measured*) | Adresse de l'étape, délais, pertes, ordre des étapes | Chiffres en gras, point plein |
| **Déduit** (*inferred*) | Réseau de l'adresse, ville, pays, point d'échange, nature d'un segment | Valeur accompagnée de son niveau (solide, probable, incertain) et de ses sources ; trait plein ou en tirets |
| **Supposé** (*assumed*) | Tracé entre deux étapes, câbles compatibles, distance réelle | Trait pointillé ; libellés au conditionnel ; liste de possibilités |

Règle : aucune valeur n'apparaît sans son niveau. Une valeur déduite s'ouvre sur ses sources ; une valeur supposée s'ouvre sur l'explication de ce qui empêche d'en savoir plus.

### 5.4 Vocabulaire imposé

| À écrire | À ne jamais écrire |
|---|---|
| « Compatible cables for this crossing » | « Your packet travelled through cable X » |
| « Likely in Paris (2 sources agree) » | « Located in Paris » sans niveau |
| « At least 6,655 km » | « 6,655 km » pour une distance réelle |
| « Countries where a hop was located » | « Countries your data crossed » |
| « Not located » | Une position par défaut (centre du pays, siège de l'opérateur) |

Ce tableau devient un fichier de steering et un contrôle automatique (voir 14).

---

<a id="donnees"></a>

## 6. Données et licences

C'est le point le plus délicat du projet : les meilleures données ne sont pas libres. Le dépôt est public et sous licence MIT ; tout ce qui y est embarqué doit avoir une licence qui le permet.

### 6.1 Sources étudiées

| Source | Usage visé | Conditions constatées le 11 novembre 2026 | Décision |
|---|---|---|---|
| **TeleGeography, Submarine Cable Map** | Géométrie des câbles, atterrissements, longueur, année de mise en service, propriétaires | Le site sert des fichiers JSON publics (géométries en GeoJSON, une fiche par câble : pour MAREA, 6 605 km, mise en service en mai 2018, atterrissements à Bilbao et Virginia Beach, propriétaires Meta, Microsoft et Telxius). Mais la page de citation dit que la licence CC BY-SA 4.0 couvre les **cartes** et leurs captures, que l'accès aux bases sous-jacentes est réservé aux abonnés payants, et que la carte interactive n'est pas intégrable. Le dépôt GitHub historique n'existe plus. | **Rien d'embarqué sans autorisation écrite.** Demander l'autorisation pour un usage non commercial avec crédit (question ouverte n° 2). À défaut, source de repli ci-dessous. |
| **OpenStreetMap** | Géométrie de câbles sous-marins (`communication=line` avec `submarine=yes`, balises `seamark`), nom, opérateur | Base sous licence ODbL : réutilisation permise avec attribution et partage à l'identique de la base dérivée. | **Source par défaut des câbles.** Extraction par un script versionné. **À vérifier** : le taux de couverture réel par rapport aux câbles en service. |
| **Wikidata** | Compléments de fiche : longueur, année, atterrissements | Données sous CC0. **À vérifier** : couverture et qualité pour les câbles. | Complément, par rapprochement de noms. |
| **Natural Earth** | Fond de carte, contours des terres et des pays | Domaine public, aucun crédit exigé (« Made with Natural Earth » suggéré). | Embarqué. |
| **RIPE IPmap** | Localisation d'adresses d'infrastructure | API publique `https://ipmap-api.ripe.net/v1/locate/…` ; plusieurs moteurs (latence, noms inverses, points d'échange, anycast, contributions) ; la réponse donne une ville, un score, un indicateur anycast et les contributions de chaque moteur. **À vérifier** : conditions d'usage, limites de débit, accès depuis un navigateur. | **Source principale de localisation**, appelée par l'outil en ligne de commande, avec accord et cache. |
| **RIPEstat** | Réseau (AS) et préfixe d'une adresse, nom inverse | API publique sans clé ; au plus 8 requêtes simultanées ; au-delà de 1 000 requêtes par jour, s'enregistrer ; paramètre `sourceapp` demandé pour un usage régulier. | Source du réseau quand la base locale ne suffit pas. |
| **DB-IP Lite** | Base locale : pays, ville, AS | CC BY 4.0 ; crédit à DB-IP et lien de retour exigés là où les résultats sont affichés ; formats CSV et MMDB ; mise à jour mensuelle. | Base locale téléchargée par l'outil au premier usage, non versionnée dans le dépôt (taille). Sert de candidat faible, jamais seule. |
| **IPinfo Lite** | Base locale : pays et AS | CC BY-SA 4.0 ; crédit à IPinfo ; gratuit ; un jeton semble requis. | Alternative à DB-IP pour le couple pays et AS. Une seule des deux suffit. |
| **PeeringDB** | Préfixes des points d'échange (`ixpfx`), coordonnées des centres de données (`fac`, avec latitude et longitude) | API lisible sans compte. La politique d'usage autorise l'exploitation d'Internet (dépannage, recherche, analyse) mais **interdit de reproduire, stocker ou transmettre les données sans accord préalable**, et de les passer en bloc à un tiers. | Interrogation **en direct** depuis la machine de l'utilisateur, cache local, **rien dans le dépôt**. Demander l'accord pour les quelques noms présents dans la galerie (question ouverte n° 3). |
| **RIPE Atlas** | Traces publiques depuis des milliers de sondes, pour la galerie et la comparaison multi-départs | API de résultats `/api/v2/measurements/{id}/results/` (filtres `start`, `stop`, `probe_ids`) et `/latest/`. Créer une mesure demande une clé et des crédits. Tout usage commercial des données demande l'accord du RIPE NCC. **À vérifier** : lecture sans clé des mesures publiques ; format exact d'un résultat de traceroute. | Option (VOY-F-47). Usage non commercial avec crédit. |
| **Table des aéroports et des villes** | Décoder les indices dans les noms de routeurs (`par`, `lhr`, `fra`) | **À vérifier** : source et licence (OurAirports est réputé dans le domaine public, non confirmé ce jour ; GeoNames est sous CC BY 4.0). Les codes CLLI des opérateurs nord-américains sont propriétaires. | Table réduite maison (codes d'aéroport et noms de grandes villes) depuis une source à licence confirmée. Aucun code CLLI. |

### 6.2 Trois conséquences de conception

1. **Le paquet de données est séparé du code.** `packages/data` a sa propre notice de licence (ODbL pour les câbles, domaine public pour le fond de carte). Le code reste sous MIT.
2. **Ce qui ne peut pas être redistribué est interrogé en direct ou téléchargé par l'utilisateur.** PeeringDB et IPmap sont appelés depuis la machine de l'utilisateur ; la base DB-IP est téléchargée dans son dossier de cache.
3. **Chaque voyage embarque ses crédits.** Un fichier de voyage liste les sources qui ont servi à le produire ; l'interface et tout export d'image les affichent.

### 6.3 Fiche de provenance

Chaque jeu de données embarqué est accompagné d'une fiche, lue par l'interface pour afficher les crédits et par un contrôle automatique qui refuse tout jeu sans fiche.

```json
{
  "id": "submarine-cables",
  "title": "Submarine telecommunication cables",
  "origin": "OpenStreetMap contributors",
  "url": "https://www.openstreetmap.org/copyright",
  "licence": "ODbL-1.0",
  "retrieved_at": "2026-11-12",
  "query": "scripts/data/cables.overpassql",
  "transform": "scripts/data/build-cables.ts",
  "attribution": "© OpenStreetMap contributors",
  "features": 0,
  "sha256": "…"
}
```

### 6.4 Envois vers des services tiers

| Service | Ce qui est envoyé | Quand |
|---|---|---|
| Résolveur DNS du système | Les adresses publiques de la route, pour leur nom inverse | À chaque trace, sauf `--offline` |
| RIPE IPmap, RIPEstat | Les adresses publiques de la route | Après accord, sauf `--offline` |
| PeeringDB | Rien de propre à la route : téléchargement de la liste des préfixes de points d'échange | Après accord, une fois par période de cache |
| Modèle de langage (option) | Le voyage déjà caviardé, sans adresse | Seulement si l'option VOY-F-36 est activée |

Les adresses privées, celles du réseau d'accès et l'adresse de l'utilisateur ne sont jamais envoyées (propriété VOY-P-04).

---

<a id="traitement"></a>

## 7. Chaîne de traitement

### 7.1 Vue d'ensemble

```
trace brute ─▶ lecture ─▶ classes d'adresses ─▶ enrichissement ─▶ candidats de localisation
                                                 (réseau, nom,       (plusieurs sources
                                                  point d'échange)    par étape)
                                                                          │
     ┌────────────────────────────────────────────────────────────────────┘
     ▼
enveloppe des délais ─▶ contrainte de la lumière ─▶ choix du trajet ─▶ confiance par étape
                        (rejets tracés)             (programmation dynamique)
                                                                          │
     ┌────────────────────────────────────────────────────────────────────┘
     ▼
segments ─▶ nature (terre, mer, indéterminé) ─▶ câbles compatibles ─▶ indicateurs ─▶ carnet de voyage
```

Tout ce qui suit l'enrichissement est du calcul pur, sans réseau ni horloge : c'est le cœur des tests par propriétés.

### 7.2 Lecture des traces

| Format | Origine | Particularités à gérer |
|---|---|---|
| `traceroute` (Linux, macOS, BSD) | Texte | Trois délais par ligne ; plusieurs adresses sur une ligne ; `*` ; annotations `!H`, `!N`, `!X` ; nom et adresse ou adresse seule (`-n`) ; lignes d'étiquettes MPLS |
| `tracert` (Windows) | Texte, souvent dans la langue du système | Délais avant l'adresse ; `<1 ms` ; messages localisés de délai dépassé ; nom entre crochets |
| `mtr`, rapport texte | Texte (`--report`, `--report-wide`) | Colonnes de statistiques ; `???` pour une étape muette |
| `mtr`, JSON | `--json` (si `mtr` a été compilé avec la bibliothèque Jansson) | Statistiques par étape : envois, pertes, meilleur délai, moyenne |
| RIPE Atlas (option) | JSON d'un résultat de mesure | Plusieurs réponses par étape ; délais absents en cas de silence |

La lecture produit une liste d'étapes : numéro (TTL), réponses (adresse, nom éventuel, liste de délais), pertes, annotations. Elle ne jette rien : une ligne incomprise est conservée telle quelle et signalée.

### 7.3 Classes d'adresses

| Classe | Plages | Traitement |
|---|---|---|
| Privée | `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (RFC 1918) ; `fc00::/7` (RFC 4193) | « Chez toi » : jamais localisée, jamais envoyée |
| Partagée par l'opérateur (CGNAT) | `100.64.0.0/10` (RFC 6598) | « Réseau d'accès » : jamais localisée, jamais envoyée |
| Lien local, boucle locale | `169.254.0.0/16`, `127.0.0.0/8`, `fe80::/10`, `::1` | Ignorée pour la localisation |
| Documentation | `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24` (RFC 5737) ; `2001:db8::/32` (RFC 3849) | Acceptée dans les exemples et les tests ; marquée « exemple » |
| Multidiffusion, réservée | `224.0.0.0/4`, `240.0.0.0/4`, `ff00::/8` | Signalée comme inattendue |
| Publique | Le reste | Enrichie et localisée |

### 7.4 Enrichissement

Pour chaque adresse publique :

1. **Réseau** : numéro d'AS, nom, préfixe, depuis la base locale, sinon depuis RIPEstat.
2. **Nom inverse** : s'il n'est pas dans la trace, résolution par le système.
3. **Point d'échange** : si l'adresse appartient au préfixe d'un point d'échange, l'étape est marquée et reçoit le ou les sites de ce point d'échange comme candidats de localisation.
4. **Anycast** : indicateur fourni par IPmap, ou déduit d'une liste de préfixes connus.

Chaque résultat est mis en cache avec sa date et sa source. Hors ligne, l'outil utilise le cache et les bases locales, et liste ce qui manque.

### 7.5 Candidats de localisation

Chaque étape reçoit une liste de candidats : une ville, des coordonnées, une source, un poids de départ.

| Source | Exemple | Poids de départ | Remarque |
|---|---|---|---|
| IPmap, moteur de latence | Une sonde à 1,3 ms de l'adresse | 0,85 | Mesure indépendante : le meilleur indice |
| Point d'échange | L'adresse est dans le préfixe d'un point d'échange parisien | 0,80 | Le point d'échange peut avoir plusieurs sites dans la même ville |
| Indice dans le nom | `ae1.par1.example.net` contient `par` | 0,60 | Conventions propres à chaque opérateur ; un code peut être ambigu |
| IPmap, autres moteurs | Contribution, nom inverse | 0,50 | |
| Base de géolocalisation | DB-IP : « Ashburn, US » | 0,30 | Situe souvent le siège de l'opérateur |
| Voisinage | L'étape précédente et la suivante sont à Londres, 0,2 ms d'écart | 0,40 | Ajouté par le choix du trajet, pas par une source |

Les poids sont des réglages, à étalonner sur des traces réelles (question ouverte n° 9). Deux candidats de sources différentes à moins de `agreeRadiusKm` l'un de l'autre sont fusionnés ; le poids fusionné vaut `1 − (1 − p₁)(1 − p₂)` : deux sources indépendantes qui s'accordent valent plus que chacune.

**Lecture des indices dans les noms.** Le nom est découpé sur les points et les tirets ; chaque fragment est comparé, chiffres finaux retirés, à la table des codes d'aéroport et des noms de villes. Un fragment de trois lettres qui est aussi un mot courant des noms de routeurs (`gig`, `eth`, `net`, `cdn`, `agg`, `rtr`, `nat`) est écarté par une liste d'exclusion. Un indice ne compte que s'il est compatible avec la contrainte de la lumière, ce qui élimine la plupart des faux amis.

### 7.6 Enveloppe des délais et contrainte de la lumière

**Enveloppe.** Soit `rttᵢ` le plus petit délai mesuré à l'étape `i`. Un paquet qui atteint l'étape `j` est passé par toutes les étapes `i ≤ j`. Le délai pour atteindre l'étape `i` ne peut donc pas dépasser le délai de n'importe quelle étape suivante :

```
envᵢ = min(rttⱼ) pour tout j ≥ i
```

L'enveloppe est croissante et efface les étapes « lentes à répondre » : si l'étape 5 annonce 14,9 ms et l'étape 6 annonce 13,8 ms, l'étape 5 est au plus à 13,8 ms.

**Borne dure (le vide).** Rien ne va plus vite que la lumière dans le vide, `c = 299,79 km/ms`. L'aller-retour vers l'étape `i` prend au moins deux fois la distance. Avec `S` le point de départ :

```
d(S, positionᵢ) ≤ c × envᵢ / 2            (borne de l'étape)
d(S, pᵢ) + d(pᵢ, pⱼ) + d(pⱼ, S) ≤ c × envⱼ   pour i < j   (borne du triangle)
```

La seconde borne dit que le paquet destiné à l'étape `j` est allé de `S` à `i`, puis de `i` à `j`, et que la réponse est revenue de `j` à `S`, quel que soit son chemin de retour. Les deux bornes valent même pour une liaison radio ou satellite.

**Borne de vraisemblance (la fibre).** Dans une fibre, la lumière va à environ `c / 1,468`, soit 204 km/ms. Une position qui respecte le vide mais exige plus vite que la fibre est possible (liaison radio) mais peu vraisemblable : elle est pénalisée, pas rejetée.

**Tolérance.** Une ville n'est pas un point, et le point de départ est connu à la ville près : la borne dure est élargie de `slackKm` (50 km par défaut).

**Rejet tracé.** Chaque candidat écarté est conservé avec sa raison : distance maximale permise, distance requise. C'est ce que l'interface montre sous le nom de « rejeté par la lumière ».

**Sans point de départ.** Si l'utilisateur ne déclare pas sa ville et que rien ne permet de la déduire, seules les bornes relatives entre étapes s'appliquent, et l'interface le signale.

### 7.7 Choix du trajet

Le trajet est choisi globalement, pas étape par étape : la meilleure position d'une étape dépend de ses voisines.

- **États.** Pour l'étape `i` : ses candidats restants après la borne de l'étape, plus l'état « non localisé ».
- **Score d'un état.** Le poids fusionné du candidat. L'état « non localisé » a un score fixe faible (`unlocatedScore`), de sorte qu'une étape sans bon candidat reste sans position plutôt que mal placée.
- **Score d'une transition** entre le candidat `a` de l'étape précédente localisée et le candidat `b` :
  - interdite si la borne du triangle est violée ;
  - pénalisée si `d(a, b)` dépasse le budget de fibre `204 × (env_b − env_a) / 2 + slackKm` (le budget est indicatif, à cause du chemin de retour) ;
  - légèrement pénalisée pour un aller-retour géographique (s'éloigner du départ puis s'en rapprocher de plus de `zigzagKm`) ;
  - bonifiée si les deux étapes sont dans le même réseau et à moins de 1 ms d'écart d'enveloppe et que les deux candidats sont dans la même ville.
- **Résolution.** Programmation dynamique sur les étapes dans l'ordre (algorithme de Viterbi) : on maximise la somme des logarithmes des scores. Les égalités sont départagées par l'identifiant du candidat, pour un résultat déterministe.

Coût : le nombre d'étapes multiplié par le carré du nombre de candidats par étape, soit quelques milliers d'opérations.

### 7.8 Confiance par étape

La confiance d'une étape localisée est le poids fusionné de sa position retenue, diminué si la transition qui y mène a été pénalisée.

| Niveau | Seuil | Sens |
|---|---|---|
| Solide (*solid*) | 0,80 et plus | Une mesure indépendante, ou plusieurs sources concordantes |
| Probable (*likely*) | 0,50 et plus | Un bon indice, compatible avec ses voisines |
| Incertain (*uncertain*) | Moins de 0,50 | Une seule source faible, que la lumière n'a pas contredite |
| Non localisé (*not located*) | — | Aucun candidat, ou tous rejetés |

### 7.9 Segments et nature des traversées

Un **segment** relie deux étapes localisées consécutives. Les étapes muettes ou non localisées qui les séparent sont comptées dans le segment, pas placées.

La nature d'un segment se déduit des **masses terrestres** : chaque ville est rattachée à une masse (Afro-Eurasie, Amériques, Australie, Grande-Bretagne, Irlande, Japon, etc.), calculée une fois à partir des contours de Natural Earth.

| Cas | Nature | Libellé |
|---|---|---|
| Même ville ou moins de `localKm` | Local | « Same city » |
| Même masse terrestre | **Indéterminé** | « Overland or undersea: cannot tell ». Les câbles compatibles sont proposés s'il en existe, sans préférence affichée. |
| Masses différentes | **Maritime** | « Sea crossing » : la traversée est certaine, le câble ne l'est pas |
| Masses différentes reliées par un ouvrage fixe connu | Maritime ou ouvrage | « Sea crossing or fixed link » (le tunnel sous la Manche porte des fibres) |

Pourquoi « indéterminé » sur une même masse : de Marseille à Singapour, la route habituelle passe par la mer Rouge et l'océan Indien, mais une route terrestre à travers l'Asie existe aussi. Rien dans la trace ne les distingue à coup sûr.

### 7.10 Câbles compatibles

Pour un segment de `A` à `B`, maritime ou indéterminé, un câble est **compatible** s'il est en service à la date de la trace et s'il a deux atterrissements `La` et `Lb` tels que le trajet `A → La → Lb → B` tienne dans le délai observé.

```
longueur estimée   L = k × d(A, La) + longueur du câble entre La et Lb + k × d(Lb, B)
délai attendu      t = 2 × L / 204 km/ms
délai observé      Δ = env_B − env_A
compatible si      t ≤ Δ × (1 + tolérance)
```

- `k` est le facteur d'allongement terrestre (`landFactor`, 1,5 par défaut, à étalonner) : une fibre ne suit pas la ligne droite.
- La longueur entre deux atterrissements est mesurée le long de la géométrie du câble quand elle est exploitable ; sinon, c'est la distance à vol d'oiseau multipliée par `cableFactor` (1,2 par défaut).
- Le délai observé est un majorant bruité (chemin de retour, files d'attente) : un câble « trop rapide » de peu reste compatible, un câble « trop lent » ne l'est pas.

**Score de compatibilité**, entre 0 et 1 :

| Composante | Poids | Calcul |
|---|---|---|
| Délai | 0,5 | Proche de 1 quand `t` est proche de `Δ` par en dessous ; décroît quand `t` est très inférieur à `Δ` |
| Proximité | 0,2 | Décroît avec `d(A, La) + d(Lb, B)` |
| Opérateur | 0,3 | 1 si le nom du réseau de `A` ou de `B` correspond à un propriétaire connu du câble, 0 sinon, 0,5 si les propriétaires sont inconnus |

Affichage en trois bandes (compatibilité forte, moyenne, faible), cinq câbles au plus, avec le nombre des autres. Le score n'est **jamais** présenté comme une probabilité, et la bande la plus haute s'appelle « forte », pas « certain ».

### 7.11 Distances, pays, indicateurs

| Indicateur | Calcul | Niveau |
|---|---|---|
| Distance minimale | Somme des distances à vol d'oiseau entre étapes localisées consécutives, précédée de « au moins » | Déduit |
| Délai | Enveloppe à la destination | Mesuré |
| Plancher de la lumière | `2 × d(S, D) / 204` : le délai d'une fibre idéale en ligne droite | Déduit |
| Inflation | Délai divisé par le plancher | Déduit |
| Pays des étapes | Pays des positions retenues, dans l'ordre | Déduit |
| Réseaux | AS distincts, dans l'ordre, avec leurs noms | Déduit (solide) |
| Points d'échange | Étapes marquées | Déduit |
| Détour (« trombone ») | Le trajet quitte un pays puis y revient ; ou trois étapes `A`, `B`, `C` avec `d(A,B) + d(B,C) > detourRatio × d(A,C)` | Déduit |
| Rejets | Nombre de candidats écartés par la lumière | Mesuré (c'est un compte) |
| Trous | Étapes muettes ou non localisées | Mesuré |

Les distances sont des distances sur la sphère (formule de haversine, rayon moyen de 6 371 km), calculées correctement de part et d'autre de l'antiméridien.

### 7.12 Carnet de voyage

Le voyage se raconte en cartes d'étape, produites par des gabarits à partir des données structurées, sans modèle de langage :

- « **Stop 4 — Paris, France** (likely). Network: ExampleNet. 9.6 ms after departure. »
- « **Crossing — the Atlantic.** 5,570 km as the crow flies, 73 ms later. Three cables are compatible with this crossing. Nothing in the measurement says which one carried your packet. »

Le « passeport » rassemble un tampon par pays d'étape, par réseau et par point d'échange. Une option (VOY-F-36) confie la reformulation à un modèle de langage, avec deux garde-fous : il ne reçoit que le voyage caviardé, et toute phrase rendue est vérifiée (chaque nombre et chaque nom propre doit figurer dans le voyage, sinon le gabarit est repris).

### 7.13 Réglages

| Réglage | Défaut | Rôle |
|---|---|---|
| `lightVacuumKmPerMs` | 299,79 | Borne dure |
| `lightFibreKmPerMs` | 204 | Borne de vraisemblance, plancher, délais de câble |
| `slackKm` | 50 | Tolérance sur les positions |
| `agreeRadiusKm` | 100 | Deux candidats plus proches sont fusionnés |
| `unlocatedScore` | 0,15 | Score de l'état « non localisé » |
| `zigzagKm` | 500 | Seuil d'un aller-retour géographique pénalisé |
| `localKm` | 50 | En dessous, un segment est local |
| `landFactor` | 1,5 | Allongement terrestre entre une ville et un atterrissement |
| `cableFactor` | 1,2 | Allongement d'un câble sans géométrie exploitable |
| `cableTolerance` | 0,1 | Tolérance sur le délai d'un câble |
| `detourRatio` | 3 | Seuil d'un détour |
| `maxCablesShown` | 5 | Câbles listés par traversée |

### 7.14 Exemple chiffré

Une trace de Lyon vers un serveur à Ashburn, en Virginie. Adresses et noms sont fictifs ; distances et délais sont calculés.

| Étape | Délai min. | Enveloppe | Ce qui est su | Position retenue |
|---|---|---|---|---|
| 1 | 1,2 ms | 1,2 | Adresse privée | Chez toi |
| 2 | 4,8 ms | 4,8 | Adresse partagée de l'opérateur | Réseau d'accès |
| 3 | 9,1 ms | 9,1 | Réseau du fournisseur d'accès ; nom contenant `par` | Paris (probable) |
| 4 | 9,6 ms | 9,6 | Préfixe d'un point d'échange ; la base dit « Ashburn » | Paris (solide) ; Ashburn **rejetée** |
| 5 | 14,9 ms | 13,8 | Réseau de transit ; nom contenant `lon` | Londres (probable) |
| 6 | 13,8 ms | 13,8 | Même réseau ; IPmap : latence | Londres (solide) |
| 7 | 88,4 ms | 86,9 | Même réseau ; nom contenant `nyc` | New York (probable) |
| 8 | 86,9 ms | 86,9 | Même réseau ; IPmap : latence | New York (solide) |
| 9 | 92,3 ms | 91,7 | Réseau de l'hébergeur ; nom contenant `iad` | Ashburn (probable) |
| 10 | 91,7 ms | 91,7 | Destination ; IPmap : latence | Ashburn (solide) |

- **Le rejet de l'étape 4.** En 9,6 ms aller-retour, la lumière dans le vide parcourt au plus 9,6 ÷ 2 × 299,79 = 1 439 km. Ashburn est à 6 496 km de Lyon. La base se trompe ; l'indice du point d'échange place l'étape à Paris, à 391 km.
- **L'enveloppe de l'étape 5.** Elle annonce 14,9 ms, mais l'étape 6, plus loin, répond en 13,8 ms : l'étape 5 est au plus à 13,8 ms.
- **Segments** : Lyon → Paris 391 km ; Paris → Londres 344 km (traversée maritime ou tunnel) ; Londres → New York 5 570 km (traversée maritime) ; New York → Ashburn 350 km. **Distance minimale : au moins 6 655 km.**
- **La traversée de l'Atlantique.** L'enveloppe passe de 13,8 à 86,9 ms : 73,1 ms, soit l'équivalent de 73,1 ÷ 2 × 204 = 7 456 km de fibre. Un câble de 6 600 km entre la Cornouailles et la côte est des États-Unis, avec ses raccordements terrestres, tient dans ce budget ; un câble qui atterrit à Bilbao, à plus de 900 km de Londres, reste possible mais moins compatible.
- **Plancher de la lumière** : 2 × 6 496 ÷ 204 = 63,6 ms. **Délai mesuré** : 91,7 ms. **Inflation** : 1,44.
- **Bilan affiché** : 3 pays d'étape (France, Royaume-Uni, États-Unis), 3 réseaux, 1 point d'échange, 1 localisation rejetée par la lumière, aucun trou.

---

<a id="parcours"></a>

## 8. Parcours utilisateurs

- **P1 — Voir sans rien installer.** Un juge ouvre l'adresse du site. La galerie propose six voyages. Il choisit « Lyon → Ashburn » : le globe tourne, le trajet se dessine étape par étape, la frise des délais avance en même temps.
- **P2 — Comprendre une étape.** Il clique sur l'étape 4. La fiche montre l'adresse, le réseau, les deux sources de localisation, et la ligne barrée : « Ashburn, US — rejected by light: 9.6 ms allows 1,439 km at most; 6,496 km needed ».
- **P3 — Lire une traversée.** Il clique sur le segment Londres → New York. « Sea crossing, 5,570 km at least, 73 ms. » Trois câbles compatibles s'allument en pointillé, classés. En dessous : « Nothing in the measurement says which one. »
- **P4 — Tracer sa propre route.** Karim lance `npx packet-voyage trace api.example.com`. L'outil demande une fois : sa ville de départ, et l'accord pour interroger RIPE et PeeringDB. Il enveloppe `mtr`, enrichit, écrit `journey.json` et ouvre l'interface en local.
- **P5 — Repérer un détour.** La carte signale un « trombone » : la route part de Singapour, monte à Tokyo, redescend à Hong Kong, puis file vers l'Europe. L'inflation est de 2,6.
- **P6 — Comparer.** Il relance en IPv6 (`--ipv6`) et ouvre les deux voyages côte à côte : la route IPv6 évite le détour.
- **P7 — Partager sans se dévoiler.** `voyage share journey.json` retire son adresse, sa box et le réseau d'accès, ramène le départ au pays, et produit un lien qui contient tout le voyage. Il le colle dans un ticket chez son hébergeur.
- **P8 — Coller une trace.** Inès n'a pas le droit d'installer quoi que ce soit en salle. Chez elle, elle a copié la sortie de `tracert`. En classe, elle la colle dans le site : les noms présents dans la trace suffisent à localiser la plupart des étapes par leurs indices, sans aucune requête.
- **P9 — Faire travailler la classe.** Elle ouvre le mode classe : une fiche demande aux élèves de calculer eux-mêmes la distance maximale permise par un délai, puis de vérifier quelle ville est possible.
- **P10 — Demander à un agent (option).** Dans Kiro, Karim écrit : « Why is api.example.com slow from here? ». L'agent appelle l'outil `trace_host` (Karim approuve), reçoit le voyage structuré, et répond en citant le détour et l'inflation.

---

<a id="exigences-f"></a>

## 9. Exigences fonctionnelles

Priorités : **I** indispensable (périmètre minimal), **S** souhaitable, **O** optionnel, **X** exclu de cette édition. Critères en notation EARS.

**Lecture des traces**

- **VOY-F-01 (I) — Entrées.** QUAND l'utilisateur colle un texte ou dépose un fichier, le système DOIT en tirer la liste des étapes pour les formats `traceroute`, `tracert`, `mtr` en rapport texte et `mtr` en JSON.
- **VOY-F-02 (I) — Détection du format.** Le système DOIT reconnaître le format sans que l'utilisateur le précise. SI aucun format n'est reconnu, ALORS le système DOIT afficher la première ligne qu'il n'a pas comprise et les formats acceptés.
- **VOY-F-03 (I) — Fidélité.** Le système DOIT conserver les étapes muettes, les réponses multiples d'une même étape, tous les délais, les annotations (`!H`, `!N`, `!X`), les valeurs « inférieur à 1 ms » et les étiquettes MPLS présentes.
- **VOY-F-04 (I) — Deux familles d'adresses.** Le système DOIT lire les traces IPv4 et IPv6.
- **VOY-F-05 (S) — RIPE Atlas.** QUAND l'utilisateur fournit le résultat JSON d'une mesure de traceroute RIPE Atlas, le système DOIT le lire comme une trace, avec la position déclarée de la sonde comme point de départ.
- **VOY-F-06 (I) — Noms.** Le système DOIT conserver les noms d'hôtes présents dans la trace et les utiliser comme indices.

**Classes d'adresses et enrichissement**

- **VOY-F-07 (I) — Classes.** Le système DOIT ranger chaque adresse dans une des classes de 7.3. Le système NE DOIT jamais localiser ni transmettre une adresse non publique.
- **VOY-F-08 (I) — Réseau.** Pour chaque adresse publique, le système DOIT indiquer le numéro et le nom de son réseau, ou « inconnu ».
- **VOY-F-09 (I) — Nom inverse.** QUAND une adresse publique n'a pas de nom dans la trace et que le mode n'est pas hors ligne, l'outil en ligne de commande DOIT demander son nom inverse au résolveur du système.
- **VOY-F-10 (S) — Points d'échange.** QUAND une adresse appartient au préfixe d'un point d'échange connu, le système DOIT marquer l'étape et nommer le point d'échange.
- **VOY-F-11 (I) — Hors ligne.** OÙ l'option `--offline` est activée, le système NE DOIT émettre aucune requête ; il DOIT travailler avec le cache, les bases locales et les indices, et lister les enrichissements manquants.
- **VOY-F-12 (I) — Cache.** Le système DOIT conserver chaque enrichissement avec sa source et sa date, le réutiliser pendant sa durée de validité, et afficher l'état du cache sur demande.
- **VOY-F-13 (I) — Accord.** AVANT le premier envoi d'adresses à un service tiers, l'outil DOIT nommer les services, dire ce qui leur est envoyé et demander l'accord. L'accord est mémorisé, consultable et révocable. SANS accord, le système DOIT se comporter comme en mode hors ligne.

**Localisation**

- **VOY-F-14 (I) — Candidats.** Pour chaque étape publique, le système DOIT rassembler les candidats de localisation des sources disponibles, chacun avec sa source et son poids.
- **VOY-F-15 (I) — Indices dans les noms.** Le système DOIT reconnaître dans un nom d'hôte les codes d'aéroport et les noms de villes de sa table, en écartant les fragments de la liste d'exclusion.
- **VOY-F-16 (I) — Contrainte de la lumière.** Le système DOIT calculer l'enveloppe des délais et écarter tout candidat qui viole la borne de l'étape ou la borne du triangle. Chaque candidat écarté DOIT rester consultable avec la distance permise et la distance requise.
- **VOY-F-17 (I) — Choix du trajet.** Le système DOIT choisir les positions selon 7.7. Les mêmes entrées et les mêmes réglages DOIVENT donner le même trajet.
- **VOY-F-18 (I) — Confiance.** Chaque étape DOIT porter son niveau (solide, probable, incertain, non localisé) et la liste des sources qui fondent sa position.
- **VOY-F-19 (I) — Point de départ.** Le système DOIT accepter une ville de départ déclarée par l'utilisateur. SI aucune n'est déclarée et qu'aucune ne peut être déduite, ALORS le système DOIT n'appliquer que les bornes relatives et le signaler.
- **VOY-F-20 (S) — Anycast.** QUAND une adresse est connue comme anycast, le système DOIT le signaler et ne retenir qu'une instance compatible avec le délai.

**Segments et câbles**

- **VOY-F-21 (I) — Segments.** Le système DOIT relier les étapes localisées consécutives et indiquer, pour chaque segment, le nombre d'étapes muettes ou non localisées qu'il enjambe. Le système NE DOIT placer aucune étape sans candidat retenu.
- **VOY-F-22 (I) — Nature.** Chaque segment DOIT porter sa nature selon 7.9 : local, indéterminé, maritime, maritime ou ouvrage fixe.
- **VOY-F-23 (I) — Câbles compatibles.** Pour chaque segment maritime ou indéterminé, le système DOIT lister les câbles compatibles selon 7.10, classés, cinq au plus, avec leur bande de compatibilité. Le système NE DOIT jamais présenter un câble comme emprunté ni un score comme une probabilité.
- **VOY-F-24 (I) — Fiche de câble.** QUAND l'utilisateur ouvre un câble, le système DOIT afficher son nom, ses atterrissements, et, quand ils sont connus, sa longueur, son année de mise en service et ses propriétaires, avec la source de chaque information.
- **VOY-F-25 (S) — Ouvrages fixes.** QUAND un segment relie deux masses terrestres jointes par un ouvrage fixe de la table, le système DOIT le citer comme alternative.

**Indicateurs**

- **VOY-F-26 (I) — Bilan.** Le système DOIT afficher la distance minimale (précédée de « au moins »), le délai, le plancher de la lumière et l'inflation.
- **VOY-F-27 (I) — Traversées.** Le système DOIT afficher, dans l'ordre, les pays des étapes, les réseaux et les points d'échange, ainsi que le nombre de localisations rejetées et de trous.
- **VOY-F-28 (S) — Détours.** Le système DOIT signaler les détours définis en 7.11.
- **VOY-F-29 (S) — Comparaison.** QUAND deux voyages sont ouverts ensemble, le système DOIT les afficher sur la même carte et mettre côte à côte leurs bilans.

**Visualisation**

- **VOY-F-30 (I) — Carte.** Le système DOIT dessiner le trajet sur une carte du monde, avec un style de trait par niveau de certitude (plein, tirets, pointillé) et une couleur par réseau.
- **VOY-F-31 (I) — Frise des délais.** Le système DOIT afficher les étapes sur un axe en millisecondes, synchronisé avec la carte : survoler l'un met l'autre en évidence.
- **VOY-F-32 (I) — Fiche d'étape.** QUAND l'utilisateur ouvre une étape, le système DOIT montrer l'adresse, le nom, le réseau, les délais, l'enveloppe, la position retenue, ses sources et les candidats rejetés avec leur raison.
- **VOY-F-33 (I) — Feuille de route.** Le système DOIT offrir un tableau contenant toute l'information de la carte, lisible par un lecteur d'écran.
- **VOY-F-34 (I) — Pas à pas.** L'utilisateur DOIT pouvoir parcourir le voyage étape par étape au clavier. OÙ le système demande des animations réduites, le système NE DOIT lancer aucune animation automatique.
- **VOY-F-35 (S) — Carnet et passeport.** Le système DOIT produire le récit par gabarits de 7.12 et la page des tampons.
- **VOY-F-36 (O) — Reformulation.** OÙ l'option est activée, un modèle de langage reformule le récit à partir du voyage caviardé ; toute phrase contenant un nombre ou un nom absent du voyage est remplacée par le gabarit.

**Partage et export**

- **VOY-F-37 (I) — Fichier de voyage.** Le système DOIT exporter et importer un voyage au format `journey.json`, validé par schéma à l'import.
- **VOY-F-38 (I) — Caviardage.** AVANT tout partage, le système DOIT retirer l'adresse de l'utilisateur, les étapes non publiques et les étapes du réseau d'accès, et ramener le point de départ au niveau choisi (pays par défaut, ville sur demande). L'utilisateur DOIT voir ce qui sera partagé avant de confirmer.
- **VOY-F-39 (I) — Lien sans serveur.** Le système DOIT produire un lien qui contient le voyage caviardé dans le fragment de l'adresse. SI le voyage dépasse la taille permise, ALORS le système DOIT proposer le fichier à la place.
- **VOY-F-40 (S) — Image.** Le système DOIT exporter la carte en image, crédits des données inclus.

**Outil en ligne de commande**

- **VOY-F-41 (I) — Tracer.** QUAND l'utilisateur lance `voyage trace <host>`, l'outil DOIT envelopper l'outil de trace du système (`mtr` s'il produit du JSON, sinon `traceroute`, sinon `tracert`), sans privilège supplémentaire, pour un seul hôte, puis enrichir, écrire le fichier de voyage et proposer d'ouvrir l'interface locale.
- **VOY-F-42 (I) — Argument sûr.** L'outil DOIT refuser tout argument qui n'est ni un nom d'hôte ni une adresse, tout argument commençant par un tiret, toute plage et toute liste. L'outil DOIT lancer la commande du système sans passer par un interpréteur de commandes.
- **VOY-F-43 (I) — Autres commandes.** `voyage read`, `voyage enrich`, `voyage share`, `voyage data` (état et mise à jour des bases), chacune avec une sortie `--json` conforme au schéma.

**Démonstration et pédagogie**

- **VOY-F-44 (I) — Galerie.** Le site DOIT proposer au moins six voyages déjà calculés et caviardés, chargés en un clic, couvrant : une traversée océanique, un trajet continental, un détour, un rejet par la lumière, une étape anycast, une trace avec trous.
- **VOY-F-45 (S) — Mode classe.** Le système DOIT offrir une fiche d'activité : calcul à la main de la distance permise par un délai, choix de la ville possible, puis vérification.

**Agents et sources complémentaires**

- **VOY-F-46 (O) — Serveur MCP et power.** Un serveur MCP expose `trace_host`, `read_trace`, `explain_journey` et `compare_journeys` ; un power Kiro l'emballe avec un skill d'enquête de latence.
- **VOY-F-47 (O) — RIPE Atlas en direct.** QUAND l'utilisateur donne l'identifiant d'une mesure publique, le système DOIT en lire les derniers résultats et afficher les voyages de plusieurs sondes vers la même destination.

**Crédits**

- **VOY-F-48 (I) — Sources et licences.** Le système DOIT afficher, sur une page dédiée et au pied de la carte, les crédits de chaque jeu de données utilisé, générés depuis les fiches de provenance et depuis la liste des sources du voyage.

**Exclus de cette édition (X)** : mesure continue, chemin de retour, simulation de coupure de câble, lancement de sondes depuis le site hébergé, comptes d'utilisateurs.

---

<a id="exigences-n"></a>

## 10. Exigences non fonctionnelles

| Id | Domaine | Exigence |
|---|---|---|
| VOY-N-01 | Vie privée | Traitement local d'abord. Le site hébergé n'émet aucune requête après son chargement, sauf accord explicite. Les envois possibles sont ceux du tableau 6.4, et aucun autre. |
| VOY-N-02 | Éthique de la mesure | Le site hébergé n'émet aucune sonde. L'outil trace un hôte à la fois, à la demande d'un humain. Par le serveur MCP : une trace à la fois, cinq secondes au moins entre deux traces, vingt traces au plus par session, approbation de l'utilisateur à chaque appel. |
| VOY-N-03 | Sécurité | Arguments validés et passés sans interpréteur de commandes. Tout fichier importé est validé par schéma ; aucun contenu importé n'est exécuté ni injecté comme HTML. Politique de sécurité du contenu stricte sur le site. |
| VOY-N-04 | Honnêteté | Aucune valeur sans niveau de certitude. Le vocabulaire de 5.4 est vérifié automatiquement sur tous les libellés et sur le récit. |
| VOY-N-05 | Licences | Aucun jeu de données embarqué sans fiche de provenance et licence compatible. Crédits affichés partout où les données le sont. Le paquet de données porte sa propre notice. |
| VOY-N-06 | Performance | Lecture et calcul d'un voyage de 30 étapes en moins de 200 ms ; enrichissement à cache chaud en moins de 3 s ; carte fluide sur un ordinateur portable de milieu de gamme. Ce sont des cibles, à mesurer. |
| VOY-N-07 | Poids | Site : code de l'application sous 350 ko compressés ; données embarquées sous 1,5 Mo compressés, géométries simplifiées. |
| VOY-N-08 | Accessibilité | Niveau AA. Tableau équivalent à la carte. Navigation complète au clavier. La certitude est portée par le style du trait et par un libellé, jamais par la seule couleur. Respect de `prefers-reduced-motion`. |
| VOY-N-09 | Langues et unités | Anglais par défaut, français disponible. Kilomètres et millisecondes ; milles en option d'affichage. Instants en UTC dans les fichiers. |
| VOY-N-10 | Robustesse | Aucun texte collé ne provoque d'exception : le résultat est un voyage, éventuellement partiel, ou une erreur structurée. |
| VOY-N-11 | Fraîcheur | La date de chaque jeu de données est affichée. Un jeu de plus de 90 jours déclenche un avertissement discret. |
| VOY-N-12 | Portabilité | Outil : Linux, macOS, Windows, Node.js LTS. Site : navigateurs récents, sans WebGL obligatoire. |
| VOY-N-13 | Données de test | Aucune adresse personnelle dans le dépôt. Les voyages de la galerie et des tests sont caviardés avant d'être versionnés ; les exemples utilisent les plages de documentation. |
| VOY-N-14 | Aucun son | Le produit n'émet aucun son. Les recettes se prouvent par des journaux et des fichiers. |

---

<a id="architecture"></a>

## 11. Architecture technique

### 11.1 Vue d'ensemble

```
        machine de l'utilisateur                              site statique hébergé
┌──────────────────────────────────────────┐          ┌─────────────────────────────────┐
│ voyage trace <host>                      │          │ galerie  ·  trace collée         │
│   └─ mtr / traceroute / tracert          │          │   └─ lecture + calcul (core)     │
│   └─ enrichissement (accord, cache)      │          │      sans aucune requête         │
│        DNS · RIPEstat · IPmap · PeeringDB│          │                                  │
│   └─ calcul (core) ─▶ journey.json ──────┼─ lien ──▶│ carte · frise · fiches · carnet  │
│   └─ interface locale (même site)        │  ou      │                                  │
│ voyage mcp (option) ◀── agent Kiro       │ fichier  │ données embarquées (data)        │
└──────────────────────────────────────────┘          └─────────────────────────────────┘
```

Le même paquet `core` tourne dans le navigateur et dans Node.js. Le site sait tout calculer à partir d'une trace collée, avec les seuls indices des noms ; l'outil ajoute l'enrichissement.

### 11.2 Arborescence

```
packet-voyage/
├── .kiro/                 # steering, specs, hooks, agents, skills, settings
├── packages/
│   ├── core/              # calcul pur, sans réseau ni horloge
│   ├── schema/            # schémas Zod du fichier de voyage
│   ├── enrich/            # adaptateurs réseau et cache (Node.js seulement)
│   └── data/              # jeux embarqués, fiches de provenance, notice de licence propre
├── apps/
│   ├── web/               # site statique
│   ├── cli/               # commande `voyage` (paquet npm `packet-voyage`)
│   └── mcp/               # serveur MCP (option)
├── power/                 # power Kiro (option)
├── scripts/data/          # extraction et construction des jeux de données
├── gallery/               # voyages de démonstration, caviardés
├── KIRO_JOURNAL.md
└── LICENSE                # MIT
```

### 11.3 Modules de `core`

| Module | Rôle |
|---|---|
| `parse` | Un lecteur par format, un détecteur, une sortie commune |
| `addr` | Lecture des adresses IPv4 et IPv6, classes de 7.3, appartenance à un préfixe |
| `hints` | Découpage des noms, table des codes, liste d'exclusion |
| `geo` | Haversine, arcs de grand cercle, antiméridien, point dans un polygone, masses terrestres |
| `envelope` | Enveloppe des délais, bornes du vide et de la fibre |
| `locate` | Fusion des candidats, filtrage, programmation dynamique, confiance |
| `segments` | Segments, nature, trous |
| `cables` | Câbles compatibles, score, bandes |
| `metrics` | Bilan, inflation, détours |
| `story` | Gabarits du carnet, tampons, contrôle du vocabulaire |
| `redact` | Caviardage par niveau |
| `share` | Compression et encodage dans un fragment d'adresse |

### 11.4 Fichier de voyage (extrait)

Les adresses sont des adresses de documentation ; les valeurs sont celles de l'exemple 7.14.

```json
{
  "version": 1,
  "traced_at": "2026-11-12T09:14:03Z",
  "tool": "mtr",
  "protocol": "icmp",
  "family": 4,
  "source": { "label": "Lyon, FR", "lat": 45.76, "lon": 4.84, "precision": "city", "declared": true },
  "target": { "host": "www.example.org", "ip": "203.0.113.80" },
  "hops": [
    {
      "ttl": 4,
      "replies": [{ "ip": "198.51.100.9", "name": "ix-paris.transit.example.net", "rtt_ms": [9.9, 9.6, 10.4] }],
      "class": "public",
      "asn": 64500,
      "as_name": "Transit Example",
      "ixp": "Example-IX Paris",
      "envelope_ms": 9.6,
      "location": {
        "city": "Paris", "country": "FR", "lat": 48.86, "lon": 2.35,
        "confidence": 0.8, "level": "solid",
        "sources": ["ixp-prefix"],
        "rejected": [
          { "source": "geodb", "city": "Ashburn", "country": "US",
            "reason": "light", "allowed_km": 1439, "needed_km": 6496 }
        ]
      }
    }
  ],
  "segments": [
    {
      "from_ttl": 6, "to_ttl": 7, "kind": "sea",
      "geodesic_km": 5570, "delta_ms": 73.1, "skipped_hops": 0,
      "cables": [
        { "id": "example-cable-a", "name": "Example Cable A", "compatibility": 0.74, "band": "high",
          "landings": ["Cornwall, GB", "New York, US"] }
      ],
      "other_cables": 4
    }
  ],
  "summary": {
    "distance_km_min": 6655, "rtt_ms": 91.7, "light_floor_ms": 63.6, "inflation": 1.44,
    "countries": ["FR", "GB", "US"], "networks": 3, "ixps": 1,
    "rejected_by_light": 1, "gaps": 0
  },
  "credits": ["© OpenStreetMap contributors", "RIPE NCC (IPmap, RIPEstat)", "Made with Natural Earth"]
}
```

### 11.5 Modèle de données

| Entité | Champs principaux |
|---|---|
| `Journey` | `version`, `traced_at`, `tool`, `protocol`, `family`, `source`, `target`, `hops`, `segments`, `summary`, `credits`, `redaction` |
| `Hop` | `ttl`, `replies`, `class`, `asn`, `as_name`, `ixp`, `anycast`, `mpls`, `envelope_ms`, `location` |
| `Reply` | `ip`, `name`, `rtt_ms`, `loss`, `flags` |
| `Location` | `city`, `country`, `lat`, `lon`, `confidence`, `level`, `sources`, `rejected` |
| `Candidate` | `city`, `country`, `lat`, `lon`, `source`, `weight` |
| `Rejection` | `source`, `city`, `country`, `reason`, `allowed_km`, `needed_km` |
| `Segment` | `from_ttl`, `to_ttl`, `kind`, `geodesic_km`, `delta_ms`, `skipped_hops`, `cables`, `other_cables`, `fixed_link` |
| `CableMatch` | `id`, `name`, `compatibility`, `band`, `landings`, `length_km`, `rfs_year`, `owners`, `source` |
| `Summary` | `distance_km_min`, `rtt_ms`, `light_floor_ms`, `inflation`, `countries`, `networks`, `ixps`, `detours`, `rejected_by_light`, `gaps` |

### 11.6 Outil en ligne de commande

| Commande | Effet |
|---|---|
| `voyage trace <host>` | Trace, enrichit, calcule, écrit `journey.json`. Options : `--ipv6`, `--proto` (ICMP, UDP ou TCP selon l'outil du système), `--cycles`, `--from <ville>`, `--offline`, `--open`, `--out` |
| `voyage read <fichier>` | Lit une trace existante (ou l'entrée standard) et produit un voyage |
| `voyage enrich <journey.json>` | Complète un voyage calculé hors ligne |
| `voyage share <journey.json>` | Caviarde, montre ce qui part, produit le lien ou le fichier. Option : `--level` (pays ou ville) |
| `voyage data status` | État du cache et des bases : source, date, licence |
| `voyage data update` | Télécharge ou rafraîchit la base locale et la liste des préfixes de points d'échange, après accord |
| `voyage consent` | Affiche, accorde ou retire l'accord d'envoi |
| `voyage mcp` | Démarre le serveur MCP (option) |

Choix de l'outil de trace, dans l'ordre : `mtr --json -n -c <cycles> <host>` s'il existe et produit du JSON ; sinon `traceroute -n -q 3 <host>` ; sous Windows, `tracert -d <host>`. L'outil n'utilise jamais `sudo` et ne modifie aucune capacité du système : si le mode demandé exige des privilèges absents, il le dit et propose le mode par défaut.

### 11.7 Serveur MCP (option)

| Outil | Entrée | Sortie |
|---|---|---|
| `trace_host` | `host`, famille, protocole | Bilan du voyage et chemin du fichier ; soumis à approbation et aux limites de VOY-N-02 |
| `read_trace` | Texte d'une trace | Voyage calculé hors ligne |
| `explain_journey` | Chemin d'un voyage | Faits structurés : segments, détours, rejets, chacun avec son niveau de certitude |
| `compare_journeys` | Deux chemins | Différences de trajet et de bilan |

Déclaration côté Kiro, dans `.kiro/settings/mcp.json` (forme à confirmer dans la documentation au moment de l'écrire) :

```json
{
  "mcpServers": {
    "packet-voyage": { "command": "npx", "args": ["packet-voyage", "mcp"] }
  }
}
```

### 11.8 Carte

Choix de référence : `d3-geo` et un rendu Canvas, avec une couche SVG pour les éléments interactifs. Deux projections : orthographique (le globe) et Equal Earth (la carte plate). Raisons : aucun WebGL exigé, rendu identique dans les tests de capture, poids réduit, contrôle fin des styles de trait. MapLibre GL JS offre aussi une projection en globe (`map.setProjection({ type: 'globe' })`) ; c'est l'alternative si le rendu Canvas manque de fluidité (question ouverte n° 8). **À vérifier** : licences de `d3-geo` et de MapLibre au moment de l'installation.

### 11.9 Hébergement

Site statique sur un hébergeur gratuit de pages, à maintenir jusqu'au 29 janvier 2027. Aucun serveur, aucune base, aucune clé.

---

<a id="interface"></a>

## 12. Interface et direction artistique

### 12.1 Écrans

1. **Accueil.** La galerie de voyages, une zone « Paste a traceroute », la commande à copier pour tracer soi-même.
2. **Voyage.** La carte au centre ; en bas, la frise des délais ; à gauche, la liste des étapes ; en haut, le bandeau de bilan : « At least 6,655 km · 91.7 ms · 3 countries · 3 networks · 1 location rejected by light ».
3. **Fiche d'étape.** Volet latéral : ce qui est mesuré, ce qui est déduit avec ses sources, ce qui a été rejeté.
4. **Fiche de traversée.** Nature du segment, distance, délai, câbles compatibles classés, et la phrase qui dit ce qu'on ne peut pas savoir.
5. **Comparaison.** Deux voyages sur la même carte, deux bilans côte à côte.
6. **Carnet et passeport.** Le récit étape par étape, les tampons.
7. **Mode classe.** La fiche d'activité.
8. **Sources et licences.**
9. **Réglages.** Langue, unités, projection, animations, accord d'envoi.

### 12.2 États à traiter

| État | Affichage |
|---|---|
| Rien de chargé | La galerie et la zone de collage |
| Trace illisible | La ligne non comprise, les formats acceptés, un exemple |
| Trace entièrement privée | « This trace never left the local network » et une explication |
| Aucune étape localisée | Le tableau et la frise restent utiles ; la carte explique pourquoi elle est vide |
| Pas de point de départ | Bandeau : bornes relatives seulement, invitation à déclarer une ville |
| Hors ligne ou sans accord | Liste de ce qui manque et de ce que cela change |
| Données anciennes | Mention discrète de la date des jeux |

### 12.3 Direction artistique

L'idée visuelle vient de la catégorie : **le trajet est une couture**. Chaque réseau est un fil d'une couleur ; chaque point d'échange est un nœud où deux fils se rejoignent ; le trait plein est un point serré (mesuré et bien localisé), les tirets un point lâche (déduit), le pointillé un faufilage (supposé). Les localisations rejetées apparaissent un instant, puis sont barrées d'un trait, comme un point défait.

- **Carte.** Fond bleu nuit, terres ardoise, câbles en filigrane clair ; seuls les câbles compatibles avec la traversée ouverte s'allument.
- **Typographie.** Chasse fixe pour tout ce qui est mesuré (cela vient d'un terminal), caractère de lecture pour le récit.
- **Mouvement.** Le trajet se coud étape par étape, au rythme des délais réels ralentis d'un facteur constant : la traversée de l'océan prend visiblement plus longtemps. Animations coupées si le système le demande.
- **Sobriété.** Aucun son. Aucun décor d'Halloween : la catégorie est Frankenstein, et la chimère se voit dans les coutures.

### 12.4 Accessibilité

- La feuille de route (tableau) contient tout ce que montre la carte, dans l'ordre des étapes.
- Clavier : flèches pour passer d'une étape à l'autre, Entrée pour ouvrir une fiche, Échap pour la fermer.
- Chaque changement d'étape est annoncé aux lecteurs d'écran.
- Les trois styles de trait et les libellés portent la certitude ; les couleurs de réseau sont doublées d'un motif dans la légende.
- L'image exportée porte un texte de remplacement généré depuis le bilan.

---

<a id="proprietes"></a>

## 13. Propriétés à tester

Générées avec fast-check, rattachées aux critères d'acceptation. Les générateurs produisent des voyages entiers : un point de départ, une suite de villes, des délais compatibles ou non avec la physique, des candidats justes et faux.

| Id | Propriété |
|---|---|
| VOY-P-01 | **Aller-retour des lecteurs.** Pour tout voyage généré, l'écrire dans chacun des formats de trace puis le relire redonne les mêmes étapes, adresses et délais. |
| VOY-P-02 | **Robustesse.** Pour tout texte, la lecture se termine sans exception et rend soit des étapes, soit une erreur structurée. |
| VOY-P-03 | **Classes d'adresses.** Pour toute adresse générée dans une plage de 7.3, y compris sous forme IPv6 abrégée, la classe rendue est celle de la plage. |
| VOY-P-04 | **Rien de privé ne sort.** Pour tout voyage, aucune requête d'enrichissement ne contient une adresse non publique ni l'adresse de l'utilisateur. |
| VOY-P-05 | **Enveloppe.** L'enveloppe est croissante avec le numéro d'étape, et inférieure ou égale au délai de chaque étape. |
| VOY-P-06 | **Borne de l'étape.** Pour tout voyage, aucune position retenue n'est plus loin du départ que `c × env / 2 + slackKm`. |
| VOY-P-07 | **Borne du triangle.** Pour tout couple d'étapes localisées `i < j`, le périmètre départ, `i`, `j`, départ ne dépasse pas `c × envⱼ` (tolérance comprise). |
| VOY-P-08 | **Déterminisme.** Le trajet retenu ne dépend ni de l'ordre des candidats ni de l'ordre des sources. |
| VOY-P-09 | **Candidat impossible sans effet.** Ajouter un candidat qui viole la borne dure ne change pas le trajet retenu ; il apparaît seulement dans les rejets. |
| VOY-P-10 | **Monotonie de la confiance.** Ajouter une source concordante ne diminue jamais la confiance d'une étape. |
| VOY-P-11 | **Pas de position inventée.** Toute étape sans candidat retenu est « non localisée » ; aucun segment ne commence ni ne finit sur une telle étape ; la somme des étapes enjambées et des étapes localisées égale le nombre d'étapes publiques. |
| VOY-P-12 | **Géométrie.** La distance est symétrique, nulle seulement entre points confondus, respecte l'inégalité triangulaire, et ne change pas quand on décale toutes les longitudes d'un même angle (donc de part et d'autre de l'antiméridien). |
| VOY-P-13 | **Câbles.** Tout câble listé est en service à la date de la trace, a un atterrissement de chaque côté, respecte la condition de délai, a un score entre 0 et 1 ; l'ordre est stable ; cinq au plus sont listés et le compte des autres est exact. |
| VOY-P-14 | **Plancher.** Pour tout voyage accepté, le délai à la destination est au moins `2 × d(S, D) / c` : l'inflation calculée dans le vide vaut au moins 1. |
| VOY-P-15 | **Bilan cohérent.** La distance minimale est la somme des segments ; les pays du bilan sont exactement ceux des étapes localisées ; le nombre de rejets est celui des fiches. |
| VOY-P-16 | **Caviardage.** Pour tout voyage et tout niveau, le résultat ne contient ni adresse non publique, ni étape du réseau d'accès, ni adresse de l'utilisateur, ni coordonnée de départ plus fine que le niveau demandé. |
| VOY-P-17 | **Partage.** Décoder un lien redonne exactement le voyage caviardé ; un lien ne dépasse jamais la taille permise. |
| VOY-P-18 | **Schéma.** Toute sortie `--json` est valide au schéma ; importer un export redonne le même voyage. |
| VOY-P-19 | **Cache.** À cache chaud, le mode hors ligne donne le même voyage que le mode en ligne qui a rempli le cache. |
| VOY-P-20 | **Vocabulaire.** Pour tout voyage généré, aucune phrase du carnet ne contient une tournure interdite de 5.4, et toute distance de trajet est précédée de « at least ». |

---

<a id="kiro"></a>

## 14. Stratégie Kiro

### 14.1 Specs

| Spec | Parcours | Contenu |
|---|---|---|
| `trace-parsers` | Exigences d'abord | VOY-F-01 à 06 ; propriétés 01, 02 |
| `address-classes` | Quick Spec | VOY-F-07 ; propriétés 03, 04 |
| `name-hints` | Exigences d'abord | VOY-F-15. **Candidat à la comparaison « spec contre vibe coding »** : petit, bien borné, plein de cas limites |
| `data-packages` | Conception d'abord | Scripts d'extraction, fiches de provenance, VOY-F-48, VOY-N-05 |
| `enrichment` | Exigences d'abord | VOY-F-08 à 13 ; propriété 19 |
| `locator` | Exigences d'abord, section 7 en entrée | VOY-F-14 à 20 ; propriétés 05 à 11 |
| `crossings-and-cables` | Exigences d'abord | VOY-F-21 à 25 ; propriétés 12, 13 |
| `metrics-and-story` | Exigences d'abord | VOY-F-26 à 28, 35 ; propriétés 14, 15, 20 |
| `journey-ui` | Conception d'abord | VOY-F-30 à 34, 44 |
| `share-and-redact` | Exigences d'abord | VOY-F-37 à 39 ; propriétés 16, 17, 18 |
| `cli` | Quick Spec | VOY-F-41 à 43 |
| `mcp-power` | Quick Spec (option) | VOY-F-46 |

L'analyse des exigences est passée sur chaque `requirements.md` avant la conception. Le `locator` est la spec où elle a le plus de chances de trouver une contradiction (bornes dures, pénalités et tolérances se marchent facilement dessus) : noter ce qu'elle trouve dans le journal.

### 14.2 Steering

| Fichier | Inclusion | Contenu |
|---|---|---|
| `product.md`, `tech.md`, `structure.md`, `testing.md` | Toujours | Fondation : pour qui, pile, arborescence, règles de test |
| `honesty.md` | Toujours | Le contrat de la section 5 : trois niveaux, vocabulaire imposé, aucune valeur sans niveau |
| `probing-ethics.md` | Toujours | L'agent ne sonde jamais Internet : il travaille sur des traces enregistrées. Un hôte à la fois pour l'utilisateur, jamais de plage |
| `privacy.md` | Toujours | Tableau 6.4 ; rien de personnel dans le dépôt ; caviardage avant tout enregistrement de trace |
| `data-licences.md` | `fileMatch` sur `packages/data/**` et `scripts/data/**` | Tableau 6.1 : ce qui peut être embarqué, ce qui ne le peut pas, la fiche de provenance obligatoire |
| `geo-math.md` | `fileMatch` sur `packages/core/src/{geo,envelope,locate,cables}/**` | Kilomètres et millisecondes, constantes nommées, antiméridien, pièges des pôles, pas de calcul en degrés « à plat » |
| `trace-formats.md` | `fileMatch` sur `packages/core/src/parse/**` | Les formats de 7.2, leurs variantes, les sorties localisées de `tracert` |
| `release.md` | Manuelle | Procédure de mise à jour des données et de la galerie |

### 14.3 Hooks

| Hook | Déclencheur | Action |
|---|---|---|
| `probe-guard` | Avant usage d'outil, catégorie `shell` | Commande : refuse toute commande de l'agent qui sonde le réseau (`traceroute`, `tracert`, `mtr`, `ping`, `nmap`, `tracepath`) vers un hôte absent de la liste permise |
| `claims-guard` | Enregistrement dans `apps/web/src/**` ou `packages/core/src/story/**` | Commande : contrôle du vocabulaire de 5.4 sur les libellés |
| `data-licence-guard` | Enregistrement dans `packages/data/**` | Commande : refuse un jeu sans fiche de provenance ou d'une source non permise |
| `light-properties` | Enregistrement dans `packages/core/src/{envelope,locate}/**` | Commande : lance les propriétés 05 à 11 |
| `fixture-privacy-guard` | Enregistrement dans `gallery/**` ou dans un dossier de tests | Commande : refuse une trace non caviardée (adresse privée, réseau d'accès, départ plus fin que le pays) |
| `journal-reminder` | Après une tâche de spec | Commande : ajoute une ligne au journal avec la spec, la tâche et la durée |

Toutes les actions sont de type commande : elles ne consomment pas de crédits. Les déclencheurs de fichier ne réagissent qu'aux modifications faites par l'agent ; chaque garde est donc aussi un contrôle de l'intégration continue.

Le hook marquant, à montrer dans la vidéo :

```json
{
  "version": "v1",
  "hooks": [
    {
      "name": "Probe guard: the agent never probes the Internet",
      "trigger": "PreToolUse",
      "matcher": "shell",
      "action": { "type": "command", "command": "node scripts/hooks/probe-guard.mjs" }
    }
  ]
}
```

Le script lit sur son entrée standard le JSON fourni par Kiro (`hook_event_name`, `cwd`, `session_id`, `tool_name`, `tool_input`), cherche une commande de sonde et sa cible, et sort avec un code non nul et un message sur la sortie d'erreur si la cible n'est pas dans `.kiro/probe-allowlist.txt` : Kiro bloque alors l'outil et transmet le message à l'agent. La liste permise ne contient au départ que la machine locale. **À vérifier** : le nom exact du champ qui porte la commande dans `tool_input`, à lire sur un premier déclenchement.

### 14.4 Agents personnalisés, MCP, powers

- **`geo-reviewer`**, en lecture seule : relit tout code de géométrie et de bornes contre `geo-math.md`.
- **`claims-reviewer`**, en lecture seule : relit libellés et gabarits contre `honesty.md`, et cherche les valeurs affichées sans niveau.
- **`data-curator`** : seul agent autorisé à écrire dans `packages/data/**` et `scripts/data/**` ; il ne peut rien écrire ailleurs.
- **MCP pendant la construction** : un serveur de documentation pour lire les pages des API de RIPE et de PeeringDB au moment d'écrire les adaptateurs ; un navigateur de test pour les captures.
- **Power livré par le projet** (option) : le serveur MCP du projet, un skill « enquêter sur une latence » (tracer, lire le bilan, chercher le détour, comparer IPv4 et IPv6, conclure en citant les niveaux de certitude) et sa déclaration.

### 14.5 Surfaces

| Surface | Emploi |
|---|---|
| IDE | Specs, tests par propriétés (la fonction « Correctness » n'existe que là), interface |
| CLI | Scripts de données, tâches répétitives ; mode sans interface dans l'intégration continue pour une relecture contre `honesty.md` (demande une clé, donc un abonnement payant) |
| Web | Une session en parallèle pour le paquet de données pendant que l'IDE avance sur le `locator` |
| Crew | Pas d'emploi naturel ici ; ne pas forcer |

### 14.6 Le récit à tenir

Trois faits à pouvoir montrer, chiffres à l'appui, dans le texte de soumission :

1. **Le projet est construit sous sa propre règle.** L'agent qui écrit un outil de sonde n'a pas le droit de sonder : le hook `probe-guard` l'en empêche, et le journal compte ses déclenchements.
2. **Les propriétés portent la physique.** « Aucune position retenue ne viole la vitesse de la lumière » est une phrase du cahier, un critère d'acceptation et un test. Noter chaque contre-exemple trouvé ; les candidats probables sont l'antiméridien, une enveloppe faite uniquement d'étapes muettes, et les adresses IPv6 abrégées.
3. **Le steering change les mots.** Montrer un libellé produit avant `honesty.md` (« Your packet crossed the Atlantic via… ») et le même après.

Répartition indicative des crédits si ce projet prend la place de Suture : 800 à 1 000 crédits. **À vérifier** : le coût réel d'une spec complète, à mesurer sur `trace-parsers`.

---

<a id="plan"></a>

## 15. Plan de réalisation

### 15.1 Lots

| Lot | Contenu | Jours |
|---|---|---|
| V1 | Lecteurs de traces, schéma du voyage, classes d'adresses | 1 |
| V2 | Paquet de données : câbles, atterrissements, fond de carte, masses terrestres, table des indices, fiches de provenance | 1 |
| V3 | Enrichissement : base locale, RIPEstat, IPmap, préfixes de points d'échange, cache, accord | 1 |
| V4 | Localisation : candidats, enveloppe, bornes, choix du trajet, confiance, propriétés | 1,5 |
| V5 | Segments, nature, câbles compatibles, bilan, détours | 1 |
| V6 | Interface : carte, frise, fiches, feuille de route, états, accessibilité | 1,5 |
| V7 | Outil en ligne de commande, caviardage, lien de partage | 0,5 |
| V8 | Galerie, hébergement, README, page des sources | 0,5 |
| **Périmètre minimal** | | **8** |
| Options | Carnet et passeport (0,5) ; comparaison (0,5) ; mode classe (0,5) ; serveur MCP et power (1) ; RIPE Atlas (1) ; export d'image (0,5) ; reformulation par modèle (0,5) | 4,5 |

Hors vidéo et texte de soumission : compter 1,5 jour de plus.

### 15.2 Périmètre réduit, en 6 jours

| Lot | Ce qui est retiré | Jours |
|---|---|---|
| V1 | Rien | 1 |
| V2 | Wikidata, ouvrages fixes | 0,5 |
| V3 | Points d'échange, RIPEstat (la base locale donne le réseau) | 0,5 |
| V4 | Rien : c'est le cœur | 1,5 |
| V5 | Score d'opérateur, détours | 0,5 |
| V6 | Globe (carte plate seulement) | 1 |
| V7 | Rien | 0,5 |
| V8 | Rien | 0,5 |

Ce qui ne se retire jamais : la contrainte de la lumière, les trois niveaux de certitude, le caviardage, la galerie.

### 15.3 Calendrier si le projet est mené seul

| Date | Travail |
|---|---|
| 12 et 13 novembre | V1, V2 ; demande des crédits Kiro si ce n'est pas fait ; courriers à TeleGeography et PeeringDB |
| 14 novembre | V3 |
| 15 et 16 novembre | V4 |
| 17 novembre | V5 |
| 18 et 19 novembre | V6 |
| 20 novembre | V7, V8 : première version en ligne |
| 21 au 24 novembre | Options, dans l'ordre : carnet et passeport, comparaison, mode classe, serveur MCP |
| 25 et 26 novembre | Étalonnage sur des traces réelles, corrections |
| 27 novembre | **Gel des fonctions** |
| 28 au 30 novembre | Vidéo, texte de soumission, billet de blog, publication sociale |
| 1er et 2 décembre | Marge |
| 3 décembre | **Soumission**, un jour avant la clôture du 4 décembre à 23 h (Paris) |

S'il s'insère dans le calendrier du premier document à la place de Suture, il occupe la piste du 23 au 29 novembre : sept jours, donc le périmètre réduit.

---

<a id="risques"></a>

## 16. Risques et parades

| Risque | Gravité | Parade |
|---|---|---|
| Les données de câbles libres sont trop incomplètes | Forte | Mesurer la couverture d'OpenStreetMap dès V2. Demander l'autorisation de TeleGeography le premier jour. Le produit reste utile sans câbles : nature des traversées, lumière, bilan. |
| Une localisation fausse est affichée devant le jury | Forte | Bornes de la lumière, niveaux de certitude, galerie vérifiée à la main étape par étape avant le gel. |
| L'outil promet trop sur les câbles | Forte | Vocabulaire imposé, contrôle automatique, agent relecteur, phrase d'incertitude sur chaque fiche de traversée. |
| Un service tiers est indisponible ou limité pendant le jugement | Moyenne | Le site ne dépend d'aucun service : galerie pré-calculée, calcul local. |
| L'outil sert à sonder en masse | Moyenne | Un hôte par commande, aucune plage, limites du serveur MCP, site sans sonde. Le dire dans le README. |
| L'adresse ou le réseau d'accès de l'auteur fuit dans le dépôt public | Forte | Caviardage avant tout enregistrement, hook `fixture-privacy-guard`, propriété 16, contrôle en intégration continue. |
| `mtr` absent, sans JSON, ou privilèges manquants | Faible | Repli sur `traceroute` puis `tracert` ; messages clairs ; jamais de `sudo`. |
| Sorties de `tracert` dans d'autres langues | Moyenne | Lecture fondée sur la structure des lignes, pas sur les mots ; jeux de tests en plusieurs langues. |
| Carte trop lourde ou saccadée | Moyenne | Géométries simplifiées, rendu Canvas, carte plate par défaut si le globe peine. |
| L'innovation est contestée : Nautilus fait déjà l'association aux câbles | Moyenne | Le citer dans la soumission. Dire ce qui diffère : ta propre trace, en local, la lumière rendue visible, un récit pour non-spécialistes. Ne pas réutiliser son code sans avoir lu sa licence (**à vérifier** : elle est annoncée « pour la recherche »). |
| Une licence de données est mal comprise | Forte | Fiche de provenance obligatoire, hook de garde, page des sources, et les deux courriers de la première journée. |
| Des marques apparaissent dans la vidéo (noms de propriétaires de câbles, d'opérateurs) | Moyenne | Tourner la vidéo sur un voyage de la galerie aux noms d'exemple ; ne montrer aucun logo (question ouverte n° 10). |
| Le projet de trop : il s'ajoute aux cinq autres | Forte | Le substituer à Suture ; sinon périmètre réduit. |

---

<a id="demo"></a>

## 17. Démonstration et soumission

### 17.1 Script de la vidéo (moins de trois minutes, en anglais)

| Temps | Image | Propos |
|---|---|---|
| 0:00 à 0:20 | Un terminal, dix lignes de `traceroute` | « Ten lines of numbers. Somewhere in there, your click crossed an ocean. » La situation d'Inès. |
| 0:20 à 0:50 | `npx packet-voyage trace …` ; le globe ; le trajet se coud étape par étape, la frise avance | Une commande de 1987 cousue à une carte du monde. Le bandeau de bilan. |
| 0:50 à 1:20 | Fiche de l'étape 4 : « Ashburn — rejected by light » | En 9,6 ms, rien ne parcourt plus de 1 439 km. La physique trie les données. |
| 1:20 à 1:50 | La traversée de l'Atlantique ; trois câbles en pointillé | « Three cables are compatible. Nothing tells us which one, and we say so. » |
| 1:50 à 2:10 | Un détour signalé ; la comparaison IPv4 et IPv6 ; le lien caviardé | À quoi cela sert un mardi matin. |
| 2:10 à 2:45 | La propriété sur la lumière qui trouve un contre-exemple ; le hook `probe-guard` qui bloque l'agent ; un libellé avant et après `honesty.md` | Comment Kiro a servi. |
| 2:45 à 3:00 | Le bilan : « At least 6,655 km. 91.7 ms. Light alone: 63.6 ms. » ; l'adresse du site | Clôture. |

Aucune musique sous droits, aucun logo, aucune carte d'un tiers à l'écran.

### 17.2 Pour les juges

L'adresse ouvre le site ; « Open a sample journey » charge un voyage de la galerie en un clic. Rien à installer, aucun compte, aucune requête. Pour tracer sa propre route : `npx packet-voyage trace example.org`.

### 17.3 Texte de soumission

Suivre la trame en huit points de l'annexe 2 du premier document. Les trois faits de 14.6 en sont l'ossature.

### 17.4 Bonus

- **Billet de blog** : « La vitesse de la lumière comme test unitaire », avec les contre-exemples trouvés par les propriétés.
- **Publication sociale** : elle commence par `#KiroweenHackathon26`, avec la capture du rejet par la lumière.
- **Best Demo** : le moment du rejet et celui de la traversée sont les deux images à soigner.

---

<a id="recette"></a>

## 18. Recette

Chaque point se prouve par un journal ou un fichier, jamais à l'œil seul ni à l'oreille.

- [ ] Les six voyages de la galerie donnent le bilan fixé dans leurs fichiers de référence (sortie du test de non-régression).
- [ ] L'exemple 7.14 donne : 6 655 km au moins, 91,7 ms, plancher 63,6 ms, inflation 1,44, un rejet par la lumière.
- [ ] Les vingt propriétés passent ; les graines sont consignées.
- [ ] Le journal du navigateur de test ne contient aucune requête après le chargement du site.
- [ ] En mode `--offline`, le journal de l'outil ne contient aucune connexion sortante.
- [ ] Le journal des requêtes d'enrichissement ne contient aucune adresse non publique (propriété 04 et relecture d'un journal réel).
- [ ] `voyage trace` refuse une plage, une liste, un argument commençant par un tiret (codes de sortie consignés).
- [ ] Un voyage partagé ne contient ni adresse privée, ni réseau d'accès, ni départ plus fin que le pays (sortie du contrôle de caviardage).
- [ ] Le contrôle du vocabulaire ne trouve aucune tournure interdite dans les libellés ni dans le carnet.
- [ ] Chaque jeu de données embarqué a sa fiche de provenance ; la page des sources les liste toutes.
- [ ] Le dépôt public ne contient aucune donnée de TeleGeography ni de PeeringDB sans autorisation écrite jointe.
- [ ] Les traces `traceroute`, `tracert` (deux langues au moins) et `mtr` de l'annexe B sont lues sans perte.
- [ ] La feuille de route contient toutes les étapes et tous les segments de la carte (comparaison automatique).
- [ ] Le parcours complet se fait au clavier (enregistrement du test de bout en bout).
- [ ] Le hook `probe-guard` a bloqué au moins une tentative pendant la construction (ligne du journal).
- [ ] La base locale de géolocalisation reste hors du dépôt, se signale (`voyage data geodb status`), se convertit sans requête (`voyage data geodb import`), et son crédit « CC BY 4.0 » accompagne tout trajet qu'elle a situé (sortie du contrôle de caviardage et du test d'attribution).
- [ ] `.kiro` est présent à la racine et absent du `.gitignore` ; la licence MIT est détectée.

---

<a id="questions"></a>

## 19. Questions ouvertes

1. **Le nom.** « Packet Voyage » et la commande `voyage` conviennent-ils, sous réserve de disponibilité ?
2. **TeleGeography.** Leur écrire pour demander l'usage de leurs données dans un projet non commercial et crédité ? Proposition : oui, dès le premier jour, sans en dépendre.
3. **PeeringDB.** Leur demander l'accord pour citer dans la galerie les quelques points d'échange rencontrés ? Proposition : oui.
4. **La place du projet.** Remplace-t-il Suture, ou s'ajoute-t-il aux cinq ? Proposition : il le remplace.
5. **Le site et les services de RIPE.** Le site hébergé peut-il, sur accord, interroger IPmap depuis le navigateur pour une trace collée ? Proposition : pas dans le périmètre minimal ; les indices des noms suffisent à une démonstration.
6. **Les destinations de la galerie.** Proposition : des cibles faites pour être mesurées (serveurs racine du DNS, ancres RIPE Atlas, sites d'universités), aucune adresse de particulier.
7. **Les départs de la galerie.** Tes propres traces, caviardées au pays, ou des traces publiques de RIPE Atlas ? Les secondes évitent toute exposition, mais dépendent de l'option VOY-F-47 et des conditions du RIPE NCC.
8. **La carte.** Rendu Canvas avec `d3-geo`, ou MapLibre ? Proposition : Canvas, MapLibre en repli.
9. **L'étalonnage.** Les poids des sources et les facteurs d'allongement sont des valeurs de départ. Proposition : trente traces réelles vérifiées à la main avant le gel.
10. **Les marques dans la vidéo.** Les fiches de câbles réels citent des entreprises. Proposition : tourner la vidéo sur un voyage aux noms d'exemple.
11. **Le mode classe.** En anglais seulement pour la soumission, ou aussi en français dès cette édition ? Proposition : les deux, le français coûte peu.

---

<a id="annexes"></a>

## Annexes

### Annexe A — Glossaire

| Terme | Sens |
|---|---|
| Saut, étape (*hop*) | Un routeur traversé par le paquet |
| TTL | Compteur de sauts porté par chaque paquet, diminué de un par routeur |
| RTT | Délai aller-retour entre l'envoi d'une sonde et la réception de sa réponse |
| AS (système autonome) | Un réseau géré par une même organisation, identifié par un numéro |
| Point d'échange (IXP) | Lieu où des réseaux se raccordent entre eux |
| Nom inverse (rDNS) | Nom associé à une adresse ; celui d'un routeur contient souvent un indice de lieu |
| Anycast | Une même adresse annoncée depuis plusieurs lieux ; chacun atteint l'instance la plus proche au sens du routage |
| MPLS | Technique de tunnel qui peut cacher des routeurs intermédiaires |
| CGNAT | Partage d'adresses par l'opérateur, dans la plage `100.64.0.0/10` |
| Station d'atterrissement | Lieu où un câble sous-marin rejoint la terre |
| Enveloppe | Plus petit délai observé à une étape ou à une étape suivante |
| Plancher de la lumière | Délai d'une fibre idéale en ligne droite entre le départ et la destination |
| Inflation | Délai mesuré divisé par le plancher de la lumière |

### Annexe B — Exemples d'entrées

Adresses de documentation et noms fictifs ; les délais sont ceux de l'exemple 7.14.

**`traceroute` (Linux)**

```
traceroute to www.example.org (203.0.113.80), 30 hops max, 60 byte packets
 1  192.168.1.1  1.412 ms  1.207 ms  1.388 ms
 2  100.64.0.1  5.102 ms  4.811 ms  4.960 ms
 3  be10.par2.isp.example (198.51.100.1)  9.412 ms  9.102 ms  9.377 ms
 4  ix-paris.transit.example.net (198.51.100.9)  9.911 ms  9.604 ms  10.402 ms
 5  ae3.lon1.transit.example.net (198.51.100.21)  15.208 ms  14.903 ms  15.411 ms
 6  ae7.lon4.transit.example.net (198.51.100.25)  13.992 ms  13.801 ms  14.120 ms
 7  be2.nyc2.transit.example.net (198.51.100.41)  88.702 ms  88.404 ms  89.015 ms
 8  be5.nyc5.transit.example.net (198.51.100.45)  87.204 ms  86.903 ms  87.411 ms
 9  xe0.iad3.host.example.com (203.0.113.1)  92.611 ms  92.304 ms  92.870 ms
10  www.example.org (203.0.113.80)  91.902 ms  91.702 ms  92.015 ms
```

**`tracert` (Windows), avec une étape muette**

```
Tracing route to www.example.org [203.0.113.80]
over a maximum of 30 hops:

  1     1 ms     1 ms     1 ms  192.168.1.1
  2     5 ms     4 ms     5 ms  100.64.0.1
  3     *        *        *     Request timed out.
  4    10 ms     9 ms    10 ms  ix-paris.transit.example.net [198.51.100.9]
```

**`mtr --json` (abrégé ; structure à confirmer sur la version installée)**

```json
{
  "report": {
    "mtr": { "src": "host", "dst": "www.example.org", "tests": 5 },
    "hubs": [
      { "count": 4, "host": "198.51.100.9", "Loss%": 0.0, "Snt": 5,
        "Last": 9.9, "Avg": 9.9, "Best": 9.6, "Wrst": 10.4, "StDev": 0.3 }
    ]
  }
}
```

### Annexe C — Sources consultées

Consultées le 11 novembre 2026.

- TeleGeography, conditions de citation des cartes : `https://www2.telegeography.com/cite-telegeography-map`
- TeleGeography, fichiers servis par la carte : `https://www.submarinecablemap.com/api/v3/cable/cable-geo.json` et `https://www.submarinecablemap.com/api/v3/cable/marea.json`
- OpenStreetMap, balisage des lignes de communication : `https://wiki.openstreetmap.org/wiki/Tag:communication=line`
- PeeringDB, API et politique d'usage : `https://docs.peeringdb.com/api_specs/`, `https://www.peeringdb.com/aup`, exemples `https://www.peeringdb.com/api/ixpfx` et `https://www.peeringdb.com/api/fac`
- RIPE IPmap, référence de l'API : `https://ipmap.ripe.net/docs/02.api-reference/` ; exemple de réponse sur `https://ipmap-api.ripe.net/v1/locate/all`
- RIPEstat, API de données : `https://stat.ripe.net/docs/02.data-api/`
- RIPE Atlas, résultats de mesures : `https://atlas.ripe.net/docs/apis/rest-api-manual/measurements/results-and-latest.html` ; conditions de service : `https://www.ripe.net/about-us/legal/ripe-atlas-service-terms-and-conditions/`
- DB-IP Lite : `https://db-ip.com/db/lite.php`
- IPinfo Lite : `https://ipinfo.io/lite`
- Natural Earth, conditions d'usage : `https://www.naturalearthdata.com/about/terms-of-use/`
- `mtr`, page de manuel : `https://manpages.debian.org/bookworm/mtr-tiny/mtr.8.en.html`
- MapLibre GL JS, exemple de globe : `https://maplibre.org/maplibre-gl-js/docs/examples/display-a-globe-with-a-vector-map/`
- Nautilus, article : `https://arxiv.org/abs/2302.14201` (le site du projet, `https://nautilus.ics.uci.edu/`, ne répondait pas ce jour)
- Règles du concours et documentation Kiro : voir l'annexe 4 du premier document.

### Annexe D — Points marqués « À vérifier », rassemblés

| Domaine | Point |
|---|---|
| Nom | Disponibilité de `packet-voyage` sur npm, absence de marque homonyme |
| Câbles | Taux de couverture d'OpenStreetMap ; couverture et qualité de Wikidata ; réponse de TeleGeography |
| Localisation | Conditions d'usage et limites de débit de RIPE IPmap ; accès depuis un navigateur |
| Points d'échange | Réponse de PeeringDB pour la galerie |
| RIPE Atlas | Lecture sans clé des mesures publiques ; format exact d'un résultat de traceroute ; portée de la clause sur l'usage commercial |
| Bases locales | Jeton requis ou non pour IPinfo Lite ; taille de la base DB-IP à télécharger |
| Table des indices | Source et licence de la table des aéroports et des villes |
| Outils de trace | Structure exacte du JSON de `mtr` selon les versions ; sorties de `tracert` par langue |
| Carte | Licences de `d3-geo` et de MapLibre au moment de l'installation |
| Kiro | Nom du champ de la commande dans l'entrée d'un hook ; forme de `mcp.json` ; coût en crédits d'une spec |
| État de l'art | Licence du code de Nautilus |
| Réglages | Poids des sources, facteurs d'allongement, seuils : valeurs de départ à étalonner |
