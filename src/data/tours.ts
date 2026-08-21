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
