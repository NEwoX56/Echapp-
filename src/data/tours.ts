import type { TourDef } from './types';

/**
 * Cinq grands tours originaux, débloqués par niveau.
 * worldLength calibré pour 3 à 5 min par étape ; displayKm est cosmétique.
 */
export const TOURS: TourDef[] = [
  {
    id: 'cimes',
    name: 'Tour des Cimes',
    region: 'Massif de Volcania',
    requiredLevel: 1,
    stages: [
      {
        id: 'cimes-1',
        name: 'Plaine des Sources',
        type: 'plaine',
        worldLength: 3000,
        displayKm: 168,
        seed: 11,
        profile: [[0, 4], [0.25, 9], [0.45, 5], [0.7, 11], [0.88, 6], [1, 4]],
        description:
          "Étape rapide pour lancer le tour. Un secteur de chemin de terre en milieu de parcours, puis gros sprint attendu.",
        sprints: [{ at: 0.55, name: 'Sprint de Vaugelles' }],
        paves: [{ from: 0.16, to: 0.22, name: 'Chemin des Sources' }]
      },
      {
        id: 'cimes-2',
        name: 'Collines de Solmagne',
        type: 'vallonnee',
        worldLength: 3400,
        displayKm: 182,
        seed: 27,
        profile: [
          [0, 6], [0.14, 32], [0.26, 14], [0.4, 40], [0.54, 16],
          [0.68, 46], [0.8, 22], [0.9, 38], [1, 12]
        ],
        meteo: 'pluie',
        description:
          "Succession de côtes sous la pluie. Terrain à puncheurs et baroudeurs, plateau exposé au vent dès le départ.",
        climbs: [
          { at: 0.4, name: 'Côte de Solmagne', category: 3 },
          { at: 0.68, name: 'Mur de Fayet', category: 2 }
        ],
        sprints: [{ at: 0.5, name: 'Sprint de Solmagne' }],
        vent: [{ from: 0.06, to: 0.15, name: 'Plateau de Solmagne' }]
      },
      {
        id: 'cimes-3',
        name: 'Chrono de Brumelac',
        type: 'clm',
        worldLength: 2200,
        displayKm: 31,
        seed: 42,
        profile: [[0, 5], [0.35, 12], [0.6, 8], [0.85, 14], [1, 6]],
        description: 'Contre-la-montre individuel. Seul face au chrono.'
      },
      {
        id: 'cimes-4',
        name: 'Mont Cendré',
        type: 'montagne',
        worldLength: 3600,
        displayKm: 176,
        seed: 63,
        profile: [
          [0, 6], [0.18, 16], [0.34, 62], [0.44, 42],
          [0.62, 96], [0.72, 72], [0.9, 132], [1, 124]
        ],
        description: 'Arrivée au sommet du Mont Cendré. La grande étape du tour.',
        climbs: [
          { at: 0.34, name: 'Col de Bramefont', category: 2 },
          { at: 0.62, name: 'Col des Ombres', category: 1 },
          { at: 0.9, name: 'Mont Cendré', category: 0 }
        ]
      },
      {
        id: 'cimes-5',
        name: 'Boulevard du Pic Corbeau',
        type: 'plaine',
        worldLength: 2800,
        displayKm: 122,
        seed: 84,
        profile: [[0, 10], [0.3, 6], [0.6, 12], [0.85, 7], [1, 8]],
        description:
          "Étape finale roulante. Dernière chance pour les sprinteurs, mais le plateau exposé du Pic Corbeau peut tout faire basculer avant l'arrivée.",
        sprints: [{ at: 0.6, name: 'Sprint du Pic Corbeau' }],
        vent: [{ from: 0.32, to: 0.48, name: 'Plateau du Pic Corbeau' }]
      }
    ]
  },
  {
    id: 'littoral',
    name: 'Ronde du Littoral',
    region: 'Côte de Brumelac',
    requiredLevel: 3,
    requiredTour: 'cimes',
    stages: [
      {
        id: 'lit-1',
        name: 'Digue de Kerantec',
        type: 'plaine',
        worldLength: 2900,
        displayKm: 154,
        seed: 121,
        profile: [[0, 3], [0.3, 6], [0.6, 4], [0.9, 7], [1, 3]],
        periode: 'aube',
        description: 'Grand départ à l\'aube, bord de mer plat et venteux. Peloton nerveux.',
        sprints: [{ at: 0.5, name: 'Sprint de Kerantec' }],
        mer: true
      },
      {
        id: 'lit-2',
        name: 'Falaises d\'Argent',
        type: 'vallonnee',
        worldLength: 3300,
        displayKm: 178,
        seed: 137,
        profile: [
          [0, 5], [0.12, 34], [0.24, 12], [0.38, 44], [0.5, 18],
          [0.64, 52], [0.76, 20], [0.88, 42], [1, 16]
        ],
        meteo: 'pluie',
        description: 'Enchaînement de murs côtiers sous la pluie. Course de mouvement.',
        climbs: [
          { at: 0.38, name: 'Mur d\'Argent', category: 3 },
          { at: 0.64, name: 'Côte du Phare', category: 2 },
          { at: 0.88, name: 'Falaise Noire', category: 3 }
        ],
        sprints: [{ at: 0.5, name: 'Sprint des Falaises' }],
        mer: true,
        vent: [{ from: 0.02, to: 0.09, name: 'Corniche d\'Argent' }]
      },
      {
        id: 'lit-3',
        name: 'Marais de Vensac',
        type: 'plaine',
        worldLength: 3100,
        displayKm: 191,
        seed: 149,
        profile: [[0, 2], [0.35, 5], [0.7, 3], [1, 4]],
        description: 'Longue étape de transition, trois secteurs pavés à négocier.',
        sprints: [
          { at: 0.35, name: 'Sprint de Vensac' },
          { at: 0.72, name: 'Sprint des Marais' }
        ],
        paves: [
          { from: 0.28, to: 0.33, name: 'Secteur de Vensac' },
          { from: 0.5, to: 0.57, name: 'Trouée des Marais' },
          { from: 0.78, to: 0.84, name: 'Chemin de Kerlan' }
        ]
      },
      {
        id: 'lit-4',
        name: 'Chrono de la Presqu\'île',
        type: 'clm',
        worldLength: 1900,
        displayKm: 24,
        seed: 163,
        profile: [[0, 3], [0.5, 8], [1, 3]],
        description: 'Chrono court et roulant, exposé au vent.'
      },
      {
        id: 'lit-5',
        name: 'Monts de Kerlan',
        type: 'montagne',
        worldLength: 3500,
        displayKm: 168,
        seed: 178,
        profile: [
          [0, 6], [0.2, 20], [0.36, 68], [0.48, 46],
          [0.66, 104], [0.78, 78], [0.92, 138], [1, 132]
        ],
        description: 'Le juge de paix : arrivée en altitude sur les Monts de Kerlan.',
        climbs: [
          { at: 0.36, name: 'Col de Kerlan', category: 2 },
          { at: 0.66, name: 'Col du Vent', category: 1 },
          { at: 0.92, name: 'Sommet de Kerlan', category: 0 }
        ]
      },
      {
        id: 'lit-6',
        name: 'Promenade de Brumelac',
        type: 'plaine',
        worldLength: 2600,
        displayKm: 108,
        seed: 190,
        profile: [[0, 5], [0.4, 8], [0.75, 4], [1, 6]],
        description:
          "Parade finale puis sprint massif sur la promenade. Le front de mer, à découvert, met le peloton en bordures avant que ça ne se joue au sprint.",
        sprints: [{ at: 0.65, name: 'Sprint de Brumelac' }],
        vent: [{ from: 0.28, to: 0.46, name: 'Front de mer de Brumelac' }],
        mer: true
      }
    ]
  },
  {
    id: 'traversee',
    name: 'Grande Traversée',
    region: 'Chaîne de Corbeau',
    requiredLevel: 6,
    requiredTour: 'littoral',
    stages: [
      {
        id: 'tra-1',
        name: 'Prologue d\'Origo',
        type: 'clm',
        worldLength: 1500,
        displayKm: 14,
        seed: 201,
        profile: [[0, 8], [0.5, 14], [1, 9]],
        description: 'Prologue explosif : quelques minutes pour prendre le maillot.'
      },
      {
        id: 'tra-2',
        name: 'Vallée de Ferro',
        type: 'plaine',
        worldLength: 3000,
        displayKm: 176,
        seed: 214,
        profile: [[0, 12], [0.3, 18], [0.6, 14], [0.9, 20], [1, 15]],
        description: 'Vallée large et roulante, deux secteurs pavés en fin de parcours.',
        sprints: [{ at: 0.55, name: 'Sprint de Ferro' }],
        paves: [
          { from: 0.62, to: 0.68, name: 'Secteur de Ferro' },
          { from: 0.85, to: 0.9, name: 'Pavés de la Traversée' }
        ]
      },
      {
        id: 'tra-3',
        name: 'Corniche d\'Altis',
        type: 'vallonnee',
        worldLength: 3400,
        displayKm: 186,
        seed: 227,
        profile: [
          [0, 14], [0.15, 48], [0.28, 22], [0.42, 58], [0.55, 26],
          [0.7, 64], [0.82, 30], [0.93, 50], [1, 24]
        ],
        description: 'Corniche sans répit, la mer en contrebas. Les écarts se creusent déjà.',
        climbs: [
          { at: 0.42, name: 'Côte d\'Altis', category: 2 },
          { at: 0.7, name: 'Corniche Haute', category: 1 }
        ],
        sprints: [{ at: 0.55, name: 'Sprint d\'Altis' }],
        mer: true
      },
      {
        id: 'tra-4',
        name: 'Col de Nimbus',
        type: 'montagne',
        worldLength: 3700,
        displayKm: 182,
        seed: 241,
        profile: [
          [0, 16], [0.16, 40], [0.32, 96], [0.44, 68],
          [0.6, 142], [0.72, 108], [0.88, 168], [1, 158]
        ],
        periode: 'crepuscule',
        description: 'Premier grand rendez-vous : trois cols en enfilade, arrivée au crépuscule.',
        climbs: [
          { at: 0.32, name: 'Col de Brume', category: 1 },
          { at: 0.6, name: 'Col de Nimbus', category: 0 },
          { at: 0.88, name: 'Pas de l\'Aigle', category: 1 }
        ]
      },
      {
        id: 'tra-5',
        name: 'Chrono de Kronos',
        type: 'clm',
        worldLength: 2400,
        displayKm: 38,
        seed: 255,
        profile: [[0, 20], [0.3, 34], [0.55, 24], [0.8, 40], [1, 26]],
        description: 'Chrono long et bosselé. Le général peut basculer.'
      },
      {
        id: 'tra-6',
        name: 'Plateau de Volta',
        type: 'vallonnee',
        worldLength: 3300,
        displayKm: 164,
        seed: 268,
        profile: [
          [0, 30], [0.18, 62], [0.32, 40], [0.5, 74], [0.64, 44],
          [0.8, 70], [1, 38]
        ],
        description: 'Plateau exposé, faux plats permanents. Étape usante.',
        climbs: [
          { at: 0.5, name: 'Rampe de Volta', category: 3 },
          { at: 0.8, name: 'Bosse du Plateau', category: 3 }
        ],
        sprints: [{ at: 0.64, name: 'Sprint de Volta' }],
        vent: [{ from: 0.06, to: 0.15, name: 'Plateau de Volta' }]
      },
      {
        id: 'tra-7',
        name: 'Pic Corbeau',
        type: 'montagne',
        worldLength: 3900,
        displayKm: 174,
        seed: 282,
        profile: [
          [0, 24], [0.14, 52], [0.3, 118], [0.42, 86],
          [0.58, 164], [0.7, 130], [0.86, 206], [1, 198]
        ],
        description: 'L\'étape reine. Arrivée au sommet du Pic Corbeau, 2 100 m.',
        climbs: [
          { at: 0.3, name: 'Col de Ferro', category: 1 },
          { at: 0.58, name: 'Col d\'Origo', category: 0 },
          { at: 0.86, name: 'Pic Corbeau', category: 0 }
        ]
      },
      {
        id: 'tra-8',
        name: 'Avenue de la Traversée',
        type: 'plaine',
        worldLength: 2700,
        displayKm: 116,
        seed: 296,
        profile: [[0, 18], [0.4, 22], [0.7, 16], [1, 20]],
        description:
          "Tour d'honneur puis sprint final sur l'avenue. La plaine ouverte, sans le moindre abri, peut scinder le peloton en bordures.",
        sprints: [{ at: 0.7, name: 'Sprint de la Traversée' }],
        vent: [{ from: 0.24, to: 0.4, name: 'Plaine ouverte de la Traversée' }]
      }
    ]
  }
  ,
  {
    id: 'couronne',
    name: 'La Couronne',
    region: 'Trois massifs, trois semaines',
    requiredLevel: 10,
    requiredTour: 'traversee',
    stages: [
      {
        id: 'cou-1',
        name: 'Prologue de Ferro',
        type: 'clm',
        worldLength: 1400,
        displayKm: 12,
        seed: 301,
        profile: [[0, 10], [0.5, 16], [1, 11]],
        periode: 'nuit',
        description: 'Prologue nocturne sous les projecteurs. Douze kilomètres pour endosser le premier maillot jaune.'
      },
      {
        id: 'cou-2',
        name: 'Plaines de Vensac',
        type: 'plaine',
        worldLength: 3100,
        displayKm: 194,
        seed: 314,
        profile: [[0, 8], [0.3, 14], [0.6, 10], [0.9, 16], [1, 11]],
        description:
          "Longue étape de plat. Les sprinteurs se disputent le vert, mais la ligne droite de Vensac, à découvert, peut casser la course avant l'heure.",
        sprints: [
          { at: 0.4, name: 'Sprint de Vensac' },
          { at: 0.75, name: 'Sprint de Brumelac' }
        ],
        vent: [{ from: 0.5, to: 0.68, name: 'Ligne droite de Vensac' }]
      },
      {
        id: 'cou-3',
        name: 'Murs de Solmagne',
        type: 'vallonnee',
        worldLength: 3300,
        displayKm: 178,
        seed: 327,
        profile: [
          [0, 12], [0.14, 52], [0.26, 20], [0.4, 62], [0.52, 24],
          [0.66, 70], [0.78, 28], [0.9, 56], [1, 22]
        ],
        description: 'Six murs en moins de trente kilomètres. Étape de puncheurs.',
        climbs: [
          { at: 0.4, name: 'Mur de Solmagne', category: 2 },
          { at: 0.66, name: 'Mur de Fayet', category: 2 },
          { at: 0.9, name: 'Côte de l\'Abbaye', category: 3 }
        ],
        sprints: [{ at: 0.52, name: 'Sprint de Solmagne' }],
        paves: [{ from: 0.02, to: 0.06, name: 'Chemin de Solmagne' }]
      },
      {
        id: 'cou-4',
        name: 'Col de Bramefont',
        type: 'montagne',
        worldLength: 3600,
        displayKm: 172,
        seed: 341,
        profile: [
          [0, 18], [0.18, 48], [0.34, 110], [0.46, 76],
          [0.64, 152], [0.76, 116], [0.9, 186], [1, 178]
        ],
        description: 'Première arrivée en altitude. Les grimpeurs sortent du bois.',
        climbs: [
          { at: 0.34, name: 'Col des Ombres', category: 1 },
          { at: 0.64, name: 'Col de Bramefont', category: 0 },
          { at: 0.9, name: 'Plateau de Bramefont', category: 1 }
        ]
      },
      {
        id: 'cou-5',
        name: 'Chrono d\'Origo',
        type: 'clm',
        worldLength: 2600,
        displayKm: 44,
        seed: 355,
        profile: [[0, 22], [0.28, 40], [0.52, 28], [0.78, 46], [1, 30]],
        description: 'Quarante-quatre kilomètres contre la montre. Le grand écart.'
      },
      {
        id: 'cou-6',
        name: 'Corniche du Littoral',
        type: 'vallonnee',
        worldLength: 3200,
        displayKm: 186,
        seed: 368,
        profile: [
          [0, 14], [0.2, 46], [0.34, 24], [0.5, 54], [0.66, 26],
          [0.82, 48], [1, 20]
        ],
        meteo: 'pluie',
        description: 'Étape de transition sur la côte, sous la pluie. Vent de travers annoncé.',
        climbs: [
          { at: 0.5, name: 'Côte du Phare', category: 3 },
          { at: 0.82, name: 'Falaise Noire', category: 3 }
        ],
        sprints: [{ at: 0.66, name: 'Sprint de la Corniche' }],
        mer: true
      },
      {
        id: 'cou-7',
        name: 'Cirque de Nimbus',
        type: 'montagne',
        worldLength: 3800,
        displayKm: 168,
        seed: 382,
        profile: [
          [0, 26], [0.15, 62], [0.3, 138], [0.42, 100],
          [0.58, 182], [0.7, 140], [0.86, 224], [1, 216]
        ],
        description: 'Quatre cols, dont deux hors catégorie. L\'étape qui fait mal.',
        climbs: [
          { at: 0.3, name: 'Col de Brume', category: 1 },
          { at: 0.58, name: 'Col de Nimbus', category: 0 },
          { at: 0.86, name: 'Cirque de Nimbus', category: 0 }
        ]
      },
      {
        id: 'cou-8',
        name: 'Mont Cendré',
        type: 'montagne',
        worldLength: 3900,
        displayKm: 164,
        seed: 396,
        profile: [
          [0, 30], [0.16, 70], [0.32, 148], [0.44, 108],
          [0.6, 196], [0.72, 152], [0.88, 246], [1, 238]
        ],
        description: 'L\'étape reine : arrivée au sommet du Mont Cendré, 2 400 m.',
        climbs: [
          { at: 0.32, name: 'Col de Ferro', category: 1 },
          { at: 0.6, name: 'Col d\'Origo', category: 0 },
          { at: 0.88, name: 'Mont Cendré', category: 0 }
        ]
      },
      {
        id: 'cou-9',
        name: 'Descente sur Altis',
        type: 'vallonnee',
        worldLength: 3000,
        displayKm: 152,
        seed: 409,
        profile: [[0, 40], [0.25, 66], [0.5, 34], [0.75, 52], [1, 26]],
        periode: 'crepuscule',
        description: 'Dernière chance pour les baroudeurs, dans la lumière du soir.',
        climbs: [{ at: 0.25, name: 'Côte d\'Altis', category: 3 }],
        sprints: [{ at: 0.6, name: 'Sprint d\'Altis' }],
        vent: [{ from: 0.82, to: 0.9, name: 'Plaine d\'Altis' }]
      },
      {
        id: 'cou-10',
        name: 'Avenue de la Couronne',
        type: 'plaine',
        worldLength: 2700,
        displayKm: 104,
        seed: 423,
        profile: [[0, 20], [0.4, 24], [0.7, 18], [1, 22]],
        description:
          "Parade sur les pavés du centre historique puis sprint final. Le vainqueur lève les bras.",
        sprints: [{ at: 0.72, name: 'Sprint de la Couronne' }],
        paves: [{ from: 0.18, to: 0.25, name: 'Pavés de la Couronne' }]
      }
    ]
  },
  {
    id: 'midi',
    name: 'Tour du Midi',
    region: 'Collines de Cassaigne',
    requiredLevel: 14,
    requiredTour: 'couronne',
    stages: [
      {
        id: 'midi-1',
        name: 'Étape des Vignes',
        type: 'plaine',
        worldLength: 2900,
        displayKm: 168,
        seed: 512,
        biome: 'mediterraneen',
        profile: [[0, 15], [0.3, 22], [0.6, 10], [0.85, 18], [1, 12]],
        description:
          "Départ vers le sud. Vignes en terrasses et villages de pierre ocre, un chemin de terre entre les rangs, bien loin des paysages du nord.",
        sprints: [{ at: 0.55, name: 'Sprint de Cassaigne' }],
        paves: [{ from: 0.12, to: 0.18, name: 'Chemin des Vignes' }]
      },
      {
        id: 'midi-2',
        name: "Collines de l'Estérel",
        type: 'vallonnee',
        worldLength: 3100,
        displayKm: 178,
        seed: 524,
        biome: 'mediterraneen',
        profile: [[0, 18], [0.28, 46], [0.5, 24], [0.72, 58], [1, 20]],
        description: 'Routes sinueuses entre pinèdes et roche rouge, sous un ciel qui ne se couvre jamais.',
        climbs: [
          { at: 0.3, name: "Côte de l'Estérel", category: 3 },
          { at: 0.72, name: 'Mur de Cassaigne', category: 2 }
        ],
        sprints: [{ at: 0.5, name: "Sprint de l'Estérel" }]
      },
      {
        id: 'midi-3',
        name: 'Chrono de Solenne',
        type: 'clm',
        worldLength: 2100,
        displayKm: 29,
        seed: 538,
        biome: 'mediterraneen',
        profile: [[0, 8], [0.35, 14], [0.65, 9], [1, 11]],
        description: 'Contre-la-montre entre les oliviers, chaussée sèche et vent tiède.'
      },
      {
        id: 'midi-4',
        name: "Pic de l'Aigle Blanc",
        type: 'montagne',
        worldLength: 3500,
        displayKm: 184,
        seed: 551,
        biome: 'mediterraneen',
        periode: 'crepuscule',
        profile: [
          [0, 12], [0.2, 24], [0.36, 68], [0.48, 46],
          [0.66, 102], [0.76, 78], [0.92, 138], [1, 130]
        ],
        description: "Arrivée au sommet du Pic de l'Aigle Blanc, dans la roche calcaire, sous le soleil couchant.",
        climbs: [
          { at: 0.36, name: 'Col de Cassaigne', category: 2 },
          { at: 0.66, name: 'Col des Salines', category: 1 },
          { at: 0.92, name: "Pic de l'Aigle Blanc", category: 0 }
        ]
      },
      {
        id: 'midi-5',
        name: 'Corniche de la Baie',
        type: 'plaine',
        worldLength: 2800,
        displayKm: 158,
        seed: 566,
        biome: 'mediterraneen',
        profile: [[0, 10], [0.35, 16], [0.65, 8], [1, 6]],
        description:
          "Dernière étape le long de la baie. La corniche à découvert peut scinder le peloton avant l'arrivée, où le vainqueur du Tour du Midi lève les bras.",
        sprints: [{ at: 0.6, name: 'Sprint de la Baie' }],
        vent: [{ from: 0.3, to: 0.48, name: 'Corniche de la Baie' }],
        mer: true
      }
    ]
  },

  /* ------------------------------------------------------------------ */
  /* Épreuves suivantes : chacune tient sur une idée de course, pas sur  */
  /* une simple montée de difficulté — pavés, vent, altitude, chaleur.   */
  /* ------------------------------------------------------------------ */

  {
    id: 'ardoise',
    name: "Classique de l'Ardoise",
    region: 'Bassin de Vensac',
    requiredLevel: 17,
    requiredTour: 'midi',
    stages: [
      {
        id: 'ard-1',
        name: 'Trouée de Vensac',
        type: 'plaine',
        worldLength: 3000,
        displayKm: 186,
        seed: 611,
        profile: [[0, 12], [0.3, 18], [0.6, 10], [0.85, 16], [1, 12]],
        meteo: 'pluie',
        description:
          "Une classique pavée sous la pluie. Cinq secteurs, et des bordures dès que la route sort des bois.",
        sprints: [{ at: 0.45, name: 'Sprint de Vensac' }],
        paves: [
          { from: 0.14, to: 0.2, name: 'Trouée du Bois' },
          { from: 0.33, to: 0.39, name: 'Secteur des Ardoisières' },
          { from: 0.52, to: 0.58, name: 'Chemin de Kerlan' },
          { from: 0.7, to: 0.76, name: 'Pavés de Fayet' },
          { from: 0.86, to: 0.91, name: 'Dernier Secteur' }
        ],
        vent: [{ from: 0.24, to: 0.3, name: 'Plaine découverte' }]
      },
      {
        id: 'ard-2',
        name: 'Murs de Kerantec',
        type: 'vallonnee',
        worldLength: 3200,
        displayKm: 174,
        seed: 623,
        profile: [
          [0, 8], [0.12, 38], [0.24, 14], [0.4, 46], [0.54, 18],
          [0.68, 52], [0.82, 22], [0.92, 40], [1, 16]
        ],
        description: 'Murs courts et raides enchaînés sans répit. Terrain de puncheurs.',
        climbs: [
          { at: 0.4, name: 'Mur de Kerantec', category: 3 },
          { at: 0.68, name: "Mur de l'Ardoise", category: 2 }
        ],
        sprints: [{ at: 0.55, name: 'Sprint de Kerantec' }],
        paves: [{ from: 0.6, to: 0.65, name: 'Rampe pavée' }]
      },
      {
        id: 'ard-3',
        name: 'Chrono des Ardoisières',
        type: 'clm',
        worldLength: 2000,
        displayKm: 27,
        seed: 637,
        profile: [[0, 10], [0.4, 18], [0.7, 12], [1, 15]],
        periode: 'crepuscule',
        description: "Contre-la-montre court et sec, entre les carrières, dans la lumière du soir."
      },
      {
        id: 'ard-4',
        name: 'Bois de Fayet',
        type: 'vallonnee',
        worldLength: 3100,
        displayKm: 168,
        seed: 649,
        profile: [[0, 12], [0.3, 44], [0.5, 20], [0.75, 50], [1, 18]],
        meteo: 'pluie',
        description: "Sous-bois détrempés et chemins gras. L'étape où l'on perd le tour.",
        climbs: [{ at: 0.75, name: 'Côte du Bois', category: 2 }],
        sprints: [{ at: 0.5, name: 'Sprint de Fayet' }],
        paves: [
          { from: 0.4, to: 0.46, name: 'Chemin du Bois' },
          { from: 0.62, to: 0.68, name: 'Secteur de Fayet' }
        ]
      },
      {
        id: 'ard-5',
        name: "Arrivée de l'Ardoise",
        type: 'plaine',
        worldLength: 2700,
        displayKm: 122,
        seed: 661,
        profile: [[0, 14], [0.4, 20], [0.7, 12], [1, 16]],
        description: "Dernier acte sur le pavé du centre. Le vainqueur lève les bras sur l'ardoise.",
        sprints: [{ at: 0.7, name: "Sprint de l'Ardoise" }],
        paves: [{ from: 0.2, to: 0.27, name: 'Pavés du Centre' }]
      }
    ]
  },

  {
    id: 'toundra',
    name: 'Grand Nord',
    region: 'Toundra de Nordvik',
    requiredLevel: 20,
    requiredTour: 'ardoise',
    stages: [
      {
        id: 'nor-1',
        name: 'Fjord de Nordvik',
        type: 'plaine',
        worldLength: 2900,
        displayKm: 158,
        seed: 672,
        profile: [[0, 12], [0.3, 18], [0.6, 10], [0.85, 16], [1, 12]],
        periode: 'aube',
        description: "Départ au bord du fjord, dans la lumière rasante d'une aube du Nord.",
        sprints: [{ at: 0.55, name: 'Sprint de Nordvik' }],
        vent: [{ from: 0.3, to: 0.45, name: 'Bouche du Fjord' }],
        mer: true
      },
      {
        id: 'nor-2',
        name: 'Plateau Gelé',
        type: 'vallonnee',
        worldLength: 3300,
        displayKm: 182,
        seed: 684,
        profile: [[0, 20], [0.25, 60], [0.45, 34], [0.68, 68], [0.85, 40], [1, 30]],
        meteo: 'pluie',
        description: 'Plateau nu battu par les rafales. Rien pour s\'abriter sur des kilomètres.',
        climbs: [{ at: 0.68, name: 'Rampe du Plateau', category: 2 }],
        sprints: [{ at: 0.45, name: 'Sprint du Plateau' }],
        vent: [
          { from: 0.12, to: 0.22, name: 'Plateau Gelé' },
          { from: 0.5, to: 0.6, name: 'Passe du Nord' }
        ]
      },
      {
        id: 'nor-3',
        name: 'Chrono de Nordvik',
        type: 'clm',
        worldLength: 2100,
        displayKm: 30,
        seed: 696,
        profile: [[0, 10], [0.4, 18], [0.7, 13], [1, 15]],
        periode: 'nuit',
        description: 'Contre-la-montre sous le soleil de minuit. Une clarté bleue qui ne tombe jamais.'
      },
      {
        id: 'nor-4',
        name: 'Mur de Glace',
        type: 'montagne',
        worldLength: 3500,
        displayKm: 176,
        seed: 708,
        profile: [
          [0, 18], [0.2, 40], [0.36, 86], [0.48, 60],
          [0.66, 118], [0.76, 92], [0.92, 152], [1, 144]
        ],
        description: "Arrivée au sommet du Mur de Glace, la plus haute du Nord.",
        climbs: [
          { at: 0.36, name: 'Col de Nordvik', category: 2 },
          { at: 0.66, name: 'Col Blanc', category: 1 },
          { at: 0.92, name: 'Mur de Glace', category: 0 }
        ]
      },
      {
        id: 'nor-5',
        name: 'Retour au Fjord',
        type: 'plaine',
        worldLength: 2600,
        displayKm: 114,
        seed: 720,
        profile: [[0, 12], [0.3, 18], [0.6, 10], [0.85, 16], [1, 12]],
        periode: 'crepuscule',
        description: 'Descente vers la mer pour conclure, dans un crépuscule qui traîne.',
        sprints: [{ at: 0.68, name: 'Sprint du Fjord' }],
        mer: true
      }
    ]
  },

  {
    id: 'sierra',
    name: 'Vuelta de la Sierra',
    region: 'Sierra de Cassaigne',
    requiredLevel: 23,
    requiredTour: 'toundra',
    stages: [
      {
        id: 'sie-1',
        name: 'Meseta',
        type: 'plaine',
        worldLength: 3000,
        displayKm: 192,
        seed: 731,
        profile: [[0, 12], [0.3, 18], [0.6, 10], [0.85, 16], [1, 12]],
        biome: 'mediterraneen',
        description: "Haut plateau brûlé par le soleil. Longue étape d'attente.",
        sprints: [{ at: 0.6, name: 'Sprint de la Meseta' }],
        vent: [{ from: 0.35, to: 0.5, name: 'Meseta découverte' }]
      },
      {
        id: 'sie-2',
        name: 'Alto de Cassaigne',
        type: 'montagne',
        worldLength: 3400,
        displayKm: 168,
        seed: 743,
        biome: 'mediterraneen',
        profile: [
          [0, 16], [0.22, 46], [0.4, 92], [0.52, 66],
          [0.72, 124], [0.84, 96], [0.95, 146], [1, 142]
        ],
        description: "Premier grand col de la Sierra, pentes sèches et sans ombre.",
        climbs: [
          { at: 0.4, name: 'Alto Menor', category: 2 },
          { at: 0.72, name: 'Puerto de Cassaigne', category: 1 },
          { at: 0.95, name: 'Alto de Cassaigne', category: 0 }
        ]
      },
      {
        id: 'sie-3',
        name: 'Oliveraies',
        type: 'vallonnee',
        worldLength: 3100,
        displayKm: 176,
        seed: 755,
        biome: 'mediterraneen',
        profile: [[0, 22], [0.28, 56], [0.5, 30], [0.74, 62], [1, 26]],
        description: "Entre les oliviers en terrasses, sur des routes qui n'en finissent pas de tourner.",
        climbs: [{ at: 0.74, name: 'Alto del Olivar', category: 2 }],
        sprints: [{ at: 0.5, name: 'Sprint des Oliveraies' }]
      },
      {
        id: 'sie-4',
        name: 'Crono de Solenne',
        type: 'clm',
        worldLength: 2100,
        displayKm: 29,
        seed: 767,
        biome: 'mediterraneen',
        periode: 'crepuscule',
        description: 'Chrono en côte dans la chaleur du soir.',
        profile: [[0, 14], [0.5, 40], [1, 62]]
      },
      {
        id: 'sie-5',
        name: 'Angliru de Cassaigne',
        type: 'montagne',
        worldLength: 3300,
        displayKm: 156,
        seed: 779,
        biome: 'mediterraneen',
        profile: [
          [0, 20], [0.25, 52], [0.45, 40], [0.62, 104],
          [0.74, 82], [0.9, 178], [1, 172]
        ],
        description: "Le mur de la Sierra : des pentes à faire poser pied à terre. L'étape reine.",
        climbs: [
          { at: 0.62, name: 'Alto Intermedio', category: 1 },
          { at: 0.9, name: 'Angliru de Cassaigne', category: 0 }
        ]
      },
      {
        id: 'sie-6',
        name: 'Paseo de Solenne',
        type: 'plaine',
        worldLength: 2600,
        displayKm: 108,
        seed: 791,
        profile: [[0, 12], [0.3, 18], [0.6, 10], [0.85, 16], [1, 12]],
        biome: 'mediterraneen',
        description: 'Parade finale et sprint sur le paseo.',
        sprints: [{ at: 0.72, name: 'Sprint de Solenne' }]
      }
    ]
  },

  {
    id: 'archipel',
    name: "Tour de l'Archipel",
    region: 'Îles de Kerantec',
    requiredLevel: 26,
    requiredTour: 'sierra',
    stages: [
      {
        id: 'arc-1',
        name: 'Digue Nord',
        type: 'plaine',
        worldLength: 2800,
        displayKm: 146,
        seed: 802,
        profile: [[0, 12], [0.3, 18], [0.6, 10], [0.85, 16], [1, 12]],
        description: "Sur la digue, entre deux mers. Le vent décide de tout.",
        sprints: [{ at: 0.5, name: 'Sprint de la Digue' }],
        vent: [
          { from: 0.2, to: 0.32, name: 'Digue Nord' },
          { from: 0.58, to: 0.7, name: 'Passe des Îles' }
        ],
        mer: true
      },
      {
        id: 'arc-2',
        name: 'Falaises de Kerlan',
        type: 'vallonnee',
        worldLength: 3200,
        displayKm: 172,
        seed: 814,
        profile: [[0, 6], [0.2, 42], [0.35, 16], [0.55, 50], [0.72, 20], [0.9, 44], [1, 14]],
        meteo: 'pluie',
        description: "Corniche battue par les embruns, à-pic sur la mer.",
        climbs: [
          { at: 0.55, name: 'Falaise de Kerlan', category: 2 },
          { at: 0.9, name: 'Pointe Noire', category: 3 }
        ],
        sprints: [{ at: 0.72, name: 'Sprint de la Pointe' }],
        mer: true
      },
      {
        id: 'arc-3',
        name: 'Marais Salants',
        type: 'plaine',
        worldLength: 2900,
        displayKm: 164,
        seed: 826,
        profile: [[0, 12], [0.3, 18], [0.6, 10], [0.85, 16], [1, 12]],
        periode: 'aube',
        description: "À travers les marais salants, au ras de l'eau, dans la brume du matin.",
        sprints: [{ at: 0.55, name: 'Sprint des Salants' }],
        paves: [{ from: 0.36, to: 0.42, name: 'Chaussée submersible' }],
        vent: [{ from: 0.62, to: 0.74, name: 'Marais découverts' }]
      },
      {
        id: 'arc-4',
        name: "Chrono de l'Île",
        type: 'clm',
        worldLength: 2000,
        displayKm: 26,
        seed: 838,
        profile: [[0, 10], [0.4, 18], [0.7, 13], [1, 15]],
        description: "Contre-la-montre en boucle sur l'île, face au vent au retour.",
        mer: true
      },
      {
        id: 'arc-5',
        name: 'Mont Kerantec',
        type: 'montagne',
        worldLength: 3200,
        displayKm: 152,
        seed: 850,
        profile: [
          [0, 8], [0.22, 34], [0.4, 72], [0.55, 48],
          [0.75, 106], [0.86, 84], [0.96, 132], [1, 128]
        ],
        description: "L'unique sommet de l'archipel, une arrivée face au large.",
        climbs: [
          { at: 0.4, name: 'Col des Bruyères', category: 2 },
          { at: 0.75, name: 'Col du Phare', category: 1 },
          { at: 0.96, name: 'Mont Kerantec', category: 0 }
        ],
        mer: true
      },
      {
        id: 'arc-6',
        name: 'Port de Kerantec',
        type: 'plaine',
        worldLength: 2600,
        displayKm: 106,
        seed: 862,
        profile: [[0, 12], [0.3, 18], [0.6, 10], [0.85, 16], [1, 12]],
        periode: 'crepuscule',
        description: 'Arrivée sur le port, au soleil couchant.',
        sprints: [{ at: 0.7, name: 'Sprint du Port' }],
        mer: true
      }
    ]
  },

  {
    id: 'volcans',
    name: 'Route des Volcans',
    region: 'Chaîne de Volcania',
    requiredLevel: 29,
    requiredTour: 'archipel',
    stages: [
      {
        id: 'vol-1',
        name: 'Plaine de Lave',
        type: 'plaine',
        worldLength: 2900,
        displayKm: 172,
        seed: 873,
        profile: [[0, 12], [0.3, 18], [0.6, 10], [0.85, 16], [1, 12]],
        description: "Champs de lave noire à perte de vue. Un paysage minéral et vide.",
        sprints: [{ at: 0.58, name: 'Sprint de Lave' }]
      },
      {
        id: 'vol-2',
        name: 'Caldeira',
        type: 'montagne',
        worldLength: 3400,
        displayKm: 164,
        seed: 885,
        profile: [
          [0, 24], [0.2, 58], [0.38, 104], [0.5, 78],
          [0.7, 138], [0.82, 110], [0.94, 164], [1, 158]
        ],
        description: "Montée dans la caldeira, entre les coulées refroidies.",
        climbs: [
          { at: 0.38, name: 'Col de Cendre', category: 2 },
          { at: 0.7, name: 'Col du Cratère', category: 1 },
          { at: 0.94, name: 'Caldeira', category: 0 }
        ]
      },
      {
        id: 'vol-3',
        name: 'Gorges de Volcania',
        type: 'vallonnee',
        worldLength: 3100,
        displayKm: 168,
        seed: 897,
        profile: [[0, 30], [0.3, 66], [0.5, 40], [0.75, 72], [1, 34]],
        description: "Route encaissée entre deux parois. Impossible de s'échapper sans se montrer.",
        climbs: [{ at: 0.75, name: 'Sortie des Gorges', category: 2 }],
        sprints: [{ at: 0.5, name: 'Sprint des Gorges' }]
      },
      {
        id: 'vol-4',
        name: 'Chrono de Cendre',
        type: 'clm',
        worldLength: 2100,
        displayKm: 28,
        seed: 909,
        profile: [[0, 10], [0.4, 18], [0.7, 13], [1, 15]],
        meteo: 'pluie',
        description: 'Contre-la-montre sur route mouillée, la cendre colle aux pneus.'
      },
      {
        id: 'vol-5',
        name: 'Pic de Volcania',
        type: 'montagne',
        worldLength: 3600,
        displayKm: 182,
        seed: 921,
        periode: 'crepuscule',
        profile: [
          [0, 26], [0.18, 62], [0.34, 118], [0.46, 90],
          [0.64, 156], [0.76, 124], [0.92, 196], [1, 190]
        ],
        description: "Le toit de la chaîne, au coucher du soleil. La plus dure du jeu.",
        climbs: [
          { at: 0.34, name: 'Col des Scories', category: 1 },
          { at: 0.64, name: 'Col de Feu', category: 0 },
          { at: 0.92, name: 'Pic de Volcania', category: 0 }
        ]
      },
      {
        id: 'vol-6',
        name: 'Descente sur Origo',
        type: 'plaine',
        worldLength: 2700,
        displayKm: 118,
        seed: 933,
        profile: [[0, 12], [0.3, 18], [0.6, 10], [0.85, 16], [1, 12]],
        description: 'Longue descente vers la plaine et sprint final.',
        sprints: [{ at: 0.72, name: "Sprint d'Origo" }]
      }
    ]
  },

  {
    id: 'steppe',
    name: 'Traversée de la Steppe',
    region: 'Steppes de Ferro',
    requiredLevel: 32,
    requiredTour: 'volcans',
    stages: [
      {
        id: 'ste-1',
        name: 'Grande Steppe',
        type: 'plaine',
        worldLength: 3100,
        displayKm: 204,
        seed: 944,
        profile: [[0, 12], [0.3, 18], [0.6, 10], [0.85, 16], [1, 12]],
        description: "La plus longue étape du jeu, droit dans la steppe. Le vent est le seul relief.",
        sprints: [
          { at: 0.35, name: 'Sprint de Ferro' },
          { at: 0.75, name: 'Sprint de la Steppe' }
        ],
        vent: [
          { from: 0.18, to: 0.32, name: 'Steppe Ouverte' },
          { from: 0.52, to: 0.66, name: 'Corridor du Vent' }
        ]
      },
      {
        id: 'ste-2',
        name: 'Pistes de Ferro',
        type: 'plaine',
        worldLength: 2900,
        displayKm: 178,
        seed: 956,
        profile: [[0, 12], [0.3, 18], [0.6, 10], [0.85, 16], [1, 12]],
        meteo: 'pluie',
        description: "Chemins de terre battue sur des dizaines de kilomètres, sous l'averse.",
        sprints: [{ at: 0.6, name: 'Sprint des Pistes' }],
        paves: [
          { from: 0.2, to: 0.3, name: 'Piste Nord' },
          { from: 0.45, to: 0.54, name: 'Piste Centrale' },
          { from: 0.68, to: 0.78, name: 'Piste Sud' }
        ]
      },
      {
        id: 'ste-3',
        name: 'Monts de Ferro',
        type: 'montagne',
        worldLength: 3400,
        displayKm: 166,
        seed: 968,
        profile: [
          [0, 30], [0.22, 64], [0.4, 110], [0.54, 82],
          [0.72, 142], [0.84, 116], [0.95, 172], [1, 166]
        ],
        description: "Les seuls sommets de la steppe, isolés au milieu de rien.",
        climbs: [
          { at: 0.4, name: 'Col de Ferro', category: 2 },
          { at: 0.72, name: 'Col des Steppes', category: 1 },
          { at: 0.95, name: 'Mont Ferro', category: 0 }
        ]
      },
      {
        id: 'ste-4',
        name: 'Chrono de la Steppe',
        type: 'clm',
        worldLength: 2200,
        displayKm: 32,
        seed: 980,
        profile: [[0, 10], [0.4, 18], [0.7, 13], [1, 15]],
        periode: 'aube',
        description: 'Long contre-la-montre plat, seul face au vent, au petit matin.'
      },
      {
        id: 'ste-5',
        name: 'Arrivée de Ferro',
        type: 'plaine',
        worldLength: 2700,
        displayKm: 124,
        seed: 992,
        profile: [[0, 12], [0.3, 18], [0.6, 10], [0.85, 16], [1, 12]],
        description: "Fin de la traversée. Un sprint pour clore trois semaines de plat.",
        sprints: [{ at: 0.7, name: 'Sprint de Ferro' }],
        vent: [{ from: 0.4, to: 0.5, name: 'Dernière Bordure' }]
      }
    ]
  },

  {
    id: 'dolomites',
    name: 'Giro des Aiguilles',
    region: 'Aiguilles de Nimbus',
    requiredLevel: 35,
    requiredTour: 'steppe',
    stages: [
      {
        id: 'dol-1',
        name: 'Vallée de Nimbus',
        type: 'plaine',
        worldLength: 2800,
        displayKm: 152,
        seed: 1003,
        profile: [[0, 12], [0.3, 18], [0.6, 10], [0.85, 16], [1, 12]],
        description: "Fond de vallée, entre des parois qui montent à pic des deux côtés.",
        sprints: [{ at: 0.6, name: 'Sprint de Nimbus' }]
      },
      {
        id: 'dol-2',
        name: 'Passo delle Aquile',
        type: 'montagne',
        worldLength: 3500,
        displayKm: 172,
        seed: 1015,
        profile: [
          [0, 28], [0.2, 66], [0.36, 116], [0.48, 88],
          [0.66, 150], [0.78, 122], [0.93, 180], [1, 174]
        ],
        description: "Trois cols d'affilée, lacets serrés sur des parois verticales.",
        climbs: [
          { at: 0.36, name: 'Passo Basso', category: 2 },
          { at: 0.66, name: 'Passo di Mezzo', category: 1 },
          { at: 0.93, name: "Passo delle Aquile", category: 0 }
        ]
      },
      {
        id: 'dol-3',
        name: 'Tunnels de Nimbus',
        type: 'vallonnee',
        worldLength: 3200,
        displayKm: 178,
        seed: 1027,
        profile: [[0, 34], [0.3, 70], [0.5, 44], [0.75, 78], [1, 38]],
        periode: 'nuit',
        description: "Une succession de tunnels creusés dans la roche, de nuit. On roule à l'aveugle.",
        climbs: [{ at: 0.75, name: 'Sortie des Tunnels', category: 2 }],
        sprints: [{ at: 0.5, name: 'Sprint des Tunnels' }]
      },
      {
        id: 'dol-4',
        name: 'Cronoscalata',
        type: 'clm',
        worldLength: 2000,
        displayKm: 24,
        seed: 1039,
        profile: [[0, 20], [0.4, 62], [1, 116]],
        description: 'Contre-la-montre en côte, du premier au dernier mètre.'
      },
      {
        id: 'dol-5',
        name: 'Cima Nimbus',
        type: 'montagne',
        worldLength: 3600,
        displayKm: 178,
        seed: 1051,
        profile: [
          [0, 30], [0.16, 70], [0.32, 132], [0.44, 104],
          [0.62, 168], [0.74, 138], [0.9, 208], [1, 202]
        ],
        description: "La Cima : le point le plus haut jamais atteint dans le jeu.",
        climbs: [
          { at: 0.32, name: 'Passo del Sole', category: 1 },
          { at: 0.62, name: 'Passo della Luna', category: 0 },
          { at: 0.9, name: 'Cima Nimbus', category: 0 }
        ]
      },
      {
        id: 'dol-6',
        name: 'Circuito di Nimbus',
        type: 'plaine',
        worldLength: 2600,
        displayKm: 102,
        seed: 1063,
        profile: [[0, 12], [0.3, 18], [0.6, 10], [0.85, 16], [1, 12]],
        description: 'Circuit final en ville et sprint sur le corso.',
        sprints: [{ at: 0.72, name: 'Sprint del Corso' }],
        paves: [{ from: 0.3, to: 0.36, name: 'Corso pavé' }]
      }
    ]
  },

  {
    id: 'delta',
    name: 'Boucles du Delta',
    region: 'Delta de Brumelac',
    requiredLevel: 38,
    requiredTour: 'dolomites',
    stages: [
      {
        id: 'del-1',
        name: 'Bras du Delta',
        type: 'plaine',
        worldLength: 2900,
        displayKm: 168,
        seed: 1074,
        profile: [[0, 12], [0.3, 18], [0.6, 10], [0.85, 16], [1, 12]],
        periode: 'aube',
        description: "Entre les bras d'eau et les roselières, sur des digues étroites.",
        sprints: [{ at: 0.55, name: 'Sprint du Delta' }],
        vent: [{ from: 0.3, to: 0.44, name: 'Digue du Delta' }],
        mer: true
      },
      {
        id: 'del-2',
        name: 'Étangs de Brumelac',
        type: 'plaine',
        worldLength: 3000,
        displayKm: 182,
        seed: 1086,
        profile: [[0, 12], [0.3, 18], [0.6, 10], [0.85, 16], [1, 12]],
        meteo: 'pluie',
        description: "Étangs à perte de vue sous la pluie, et des chemins de halage défoncés.",
        sprints: [{ at: 0.6, name: 'Sprint des Étangs' }],
        paves: [
          { from: 0.28, to: 0.35, name: 'Chemin de Halage' },
          { from: 0.6, to: 0.67, name: 'Digue Pavée' }
        ]
      },
      {
        id: 'del-3',
        name: 'Coteaux du Delta',
        type: 'vallonnee',
        worldLength: 3100,
        displayKm: 170,
        seed: 1098,
        profile: [[0, 4], [0.28, 40], [0.48, 16], [0.72, 46], [1, 12]],
        description: 'Les premiers reliefs après des jours de plat. Les jambes le sentent.',
        climbs: [
          { at: 0.28, name: 'Coteau Nord', category: 3 },
          { at: 0.72, name: 'Coteau de Brumelac', category: 2 }
        ],
        sprints: [{ at: 0.48, name: 'Sprint des Coteaux' }]
      },
      {
        id: 'del-4',
        name: 'Chrono du Delta',
        type: 'clm',
        worldLength: 2100,
        displayKm: 29,
        seed: 1110,
        profile: [[0, 10], [0.4, 18], [0.7, 13], [1, 15]],
        description: 'Chrono plat le long du fleuve, sans un virage pour se relever.'
      },
      {
        id: 'del-5',
        name: 'Embouchure',
        type: 'plaine',
        worldLength: 2700,
        displayKm: 128,
        seed: 1122,
        profile: [[0, 12], [0.3, 18], [0.6, 10], [0.85, 16], [1, 12]],
        periode: 'crepuscule',
        description: "Arrivée à l'embouchure, là où le fleuve rejoint la mer.",
        sprints: [{ at: 0.7, name: "Sprint de l'Embouchure" }],
        vent: [{ from: 0.45, to: 0.58, name: 'Embouchure' }],
        mer: true
      }
    ]
  },

  {
    id: 'canyon',
    name: 'Canyons du Sud',
    region: 'Canyons de Solmagne',
    requiredLevel: 41,
    requiredTour: 'delta',
    stages: [
      {
        id: 'can-1',
        name: 'Plateau Rouge',
        type: 'plaine',
        worldLength: 3000,
        displayKm: 186,
        seed: 1133,
        profile: [[0, 12], [0.3, 18], [0.6, 10], [0.85, 16], [1, 12]],
        biome: 'mediterraneen',
        description: "Plateau désertique, roche rouge et chaleur écrasante.",
        sprints: [{ at: 0.58, name: 'Sprint du Plateau' }],
        vent: [{ from: 0.32, to: 0.46, name: 'Plateau Rouge' }]
      },
      {
        id: 'can-2',
        name: 'Gorges de Solmagne',
        type: 'vallonnee',
        worldLength: 3200,
        displayKm: 174,
        seed: 1145,
        biome: 'mediterraneen',
        profile: [[0, 26], [0.3, 64], [0.5, 36], [0.74, 70], [1, 30]],
        description: 'Au fond des gorges, entre deux murailles de roche.',
        climbs: [{ at: 0.74, name: 'Sortie des Gorges', category: 2 }],
        sprints: [{ at: 0.5, name: 'Sprint des Gorges' }]
      },
      {
        id: 'can-3',
        name: 'Corniche du Canyon',
        type: 'montagne',
        worldLength: 3400,
        displayKm: 162,
        seed: 1157,
        biome: 'mediterraneen',
        profile: [
          [0, 28], [0.22, 62], [0.4, 108], [0.54, 84],
          [0.72, 146], [0.84, 118], [0.95, 174], [1, 168]
        ],
        description: "Une corniche taillée dans la paroi, le vide juste à côté.",
        climbs: [
          { at: 0.4, name: 'Balcon Bas', category: 2 },
          { at: 0.72, name: 'Balcon Haut', category: 1 },
          { at: 0.95, name: 'Corniche du Canyon', category: 0 }
        ]
      },
      {
        id: 'can-4',
        name: 'Chrono des Mesas',
        type: 'clm',
        worldLength: 2100,
        displayKm: 28,
        seed: 1169,
        profile: [[0, 10], [0.4, 18], [0.7, 13], [1, 15]],
        biome: 'mediterraneen',
        periode: 'crepuscule',
        description: 'Chrono entre les mesas, ombres longues sur la roche rouge.'
      },
      {
        id: 'can-5',
        name: 'Grand Canyon',
        type: 'montagne',
        worldLength: 3500,
        displayKm: 170,
        seed: 1181,
        biome: 'mediterraneen',
        profile: [
          [0, 24], [0.2, 58], [0.36, 112], [0.5, 82],
          [0.68, 152], [0.8, 124], [0.93, 186], [1, 180]
        ],
        description: "Le grand final au-dessus du canyon. Une arrivée suspendue.",
        climbs: [
          { at: 0.36, name: 'Mesa Basse', category: 1 },
          { at: 0.68, name: 'Mesa Haute', category: 0 },
          { at: 0.93, name: 'Grand Canyon', category: 0 }
        ]
      },
      {
        id: 'can-6',
        name: 'Solmagne',
        type: 'plaine',
        worldLength: 2600,
        displayKm: 110,
        seed: 1193,
        profile: [[0, 12], [0.3, 18], [0.6, 10], [0.85, 16], [1, 12]],
        biome: 'mediterraneen',
        description: 'Retour en ville pour le sprint de clôture.',
        sprints: [{ at: 0.72, name: 'Sprint de Solmagne' }]
      }
    ]
  },

  {
    id: 'mondial',
    name: 'Championnat du Monde',
    region: 'Circuit d\'Altis',
    requiredLevel: 44,
    requiredTour: 'canyon',
    stages: [
      {
        id: 'mon-1',
        name: 'Chrono du Monde',
        type: 'clm',
        worldLength: 2200,
        displayKm: 34,
        seed: 1204,
        description: "Le chrono du championnat. Un seul jour, un seul maillot.",
        profile: [[0, 12], [0.35, 26], [0.65, 16], [1, 20]]
      },
      {
        id: 'mon-2',
        name: 'Circuit en Ligne',
        type: 'vallonnee',
        worldLength: 3600,
        displayKm: 268,
        seed: 1216,
        profile: [
          [0, 14], [0.12, 46], [0.24, 18], [0.36, 50], [0.48, 20],
          [0.6, 52], [0.72, 22], [0.84, 54], [0.94, 24], [1, 18]
        ],
        description:
          "La course en ligne : un circuit répété jusqu'à l'épuisement, avec la même côte à chaque tour. La plus longue du jeu.",
        climbs: [
          { at: 0.36, name: "Côte d'Altis", category: 2 },
          { at: 0.6, name: "Côte d'Altis", category: 2 },
          { at: 0.84, name: "Côte d'Altis", category: 2 }
        ],
        sprints: [{ at: 0.48, name: 'Sprint du Circuit' }],
        paves: [{ from: 0.28, to: 0.32, name: 'Secteur du Circuit' }]
      }
    ]
  },

  {
    id: 'legende',
    name: 'Tour de Légende',
    region: 'Les cols mythiques',
    requiredLevel: 48,
    requiredTour: 'mondial',
    stages: [
      {
        id: 'leg-1',
        name: 'Prologue de Légende',
        type: 'clm',
        worldLength: 1900,
        displayKm: 18,
        seed: 1227,
        profile: [[0, 10], [0.4, 18], [0.7, 13], [1, 15]],
        periode: 'crepuscule',
        description: "Prologue d'ouverture. Ensuite, il n'y aura plus que des cols."
      },
      {
        id: 'leg-2',
        name: 'Pavés de Légende',
        type: 'plaine',
        worldLength: 3000,
        displayKm: 176,
        seed: 1239,
        profile: [[0, 12], [0.3, 18], [0.6, 10], [0.85, 16], [1, 12]],
        meteo: 'pluie',
        description: "Six secteurs pavés sous la pluie, pour trier le peloton avant la montagne.",
        sprints: [{ at: 0.5, name: 'Sprint de Légende' }],
        paves: [
          { from: 0.1, to: 0.16, name: 'Secteur I' },
          { from: 0.24, to: 0.3, name: 'Secteur II' },
          { from: 0.38, to: 0.44, name: 'Secteur III' },
          { from: 0.54, to: 0.6, name: 'Secteur IV' },
          { from: 0.7, to: 0.76, name: 'Secteur V' },
          { from: 0.86, to: 0.92, name: 'Secteur VI' }
        ],
        vent: [{ from: 0.32, to: 0.38, name: 'Plaine de Légende' }]
      },
      {
        id: 'leg-3',
        name: 'Les Trois Cols',
        type: 'montagne',
        worldLength: 3600,
        displayKm: 192,
        seed: 1251,
        profile: [
          [0, 22], [0.14, 78], [0.26, 48], [0.42, 142],
          [0.54, 96], [0.72, 186], [0.84, 140], [0.95, 214], [1, 208]
        ],
        description: "Trois cols hors catégorie dans la même journée. Personne n'en sort indemne.",
        climbs: [
          { at: 0.42, name: 'Col de Légende', category: 0 },
          { at: 0.72, name: 'Col des Géants', category: 0 },
          { at: 0.95, name: 'Cime de Légende', category: 0 }
        ]
      },
      {
        id: 'leg-4',
        name: 'Chrono des Géants',
        type: 'clm',
        worldLength: 2200,
        displayKm: 32,
        seed: 1263,
        profile: [[0, 30], [0.45, 88], [1, 152]],
        description: "Contre-la-montre en montagne, l'exercice le plus cruel qui soit."
      },
      {
        id: 'leg-5',
        name: 'Nuit des Cimes',
        type: 'montagne',
        worldLength: 3400,
        displayKm: 168,
        seed: 1275,
        periode: 'nuit',
        profile: [
          [0, 26], [0.2, 68], [0.38, 126], [0.5, 98],
          [0.68, 162], [0.8, 132], [0.92, 196], [1, 190]
        ],
        description: "Arrivée au sommet de nuit, sous les projecteurs. Du jamais vu.",
        climbs: [
          { at: 0.38, name: 'Col Nocturne', category: 1 },
          { at: 0.68, name: 'Col des Étoiles', category: 0 },
          { at: 0.92, name: 'Cime de Nuit', category: 0 }
        ]
      },
      {
        id: 'leg-6',
        name: 'Apothéose',
        type: 'montagne',
        worldLength: 3600,
        displayKm: 186,
        seed: 1287,
        profile: [
          [0, 28], [0.15, 82], [0.3, 52], [0.46, 152],
          [0.58, 112], [0.76, 202], [0.86, 168], [0.96, 236], [1, 230]
        ],
        description:
          "La dernière étape du jeu, au point le plus haut de tous. Celui qui la gagne a tout gagné.",
        climbs: [
          { at: 0.46, name: 'Col du Silence', category: 0 },
          { at: 0.76, name: 'Col de la Fin', category: 0 },
          { at: 0.96, name: 'Apothéose', category: 0 }
        ]
      },
      {
        id: 'leg-7',
        name: "Tour d'Honneur",
        type: 'plaine',
        worldLength: 2500,
        displayKm: 96,
        seed: 1299,
        profile: [[0, 12], [0.3, 18], [0.6, 10], [0.85, 16], [1, 12]],
        description: "Le tour d'honneur. Champagne, puis un dernier sprint pour la forme.",
        sprints: [{ at: 0.74, name: "Sprint d'Honneur" }],
        paves: [{ from: 0.34, to: 0.4, name: "Pavés d'Honneur" }]
      }
    ]
  }
];

/** points attribués selon la catégorie du col (1er au sommet) */
export const KOM_POINTS: Record<number, number[]> = {
  0: [20, 15, 12, 9, 6, 4, 2],
  1: [12, 9, 7, 5, 3, 2, 1],
  2: [8, 6, 4, 3, 2, 1],
  3: [5, 3, 2, 1],
  4: [3, 2, 1]
};

/** points du classement par points : sprint intermédiaire puis arrivée */
export const SPRINT_POINTS = [15, 12, 10, 8, 6, 5, 4, 3, 2, 1];
export const FINISH_POINTS: Record<string, number[]> = {
  plaine: [50, 40, 32, 26, 22, 18, 15, 12, 10, 8, 6, 5, 4, 3, 2],
  vallonnee: [35, 28, 24, 20, 17, 14, 12, 10, 8, 6, 5, 4, 3, 2, 1],
  montagne: [25, 20, 16, 13, 11, 9, 7, 6, 5, 4, 3, 2, 1],
  clm: [20, 16, 13, 11, 9, 7, 6, 5, 4, 3, 2, 1]
};
