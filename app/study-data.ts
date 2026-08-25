export type CaseItem = {
  id: string;
  title: string;
  source: string;
  miller: string;
};

export type StudyPhase = {
  id: string;
  name: string;
  start: string;
  end: string;
  window: string;
  miller: string;
  pages: string;
  items: CaseItem[];
};

type CaseTuple = [title: string, source: string, miller: string];

const cases = (prefix: string, rows: CaseTuple[]): CaseItem[] => rows.map(([title, source, miller], index) => ({
  id: `${prefix}-${String(index + 1).padStart(2, '0')}`,
  title,
  source,
  miller,
}));

const trauma = cases('trauma', [
  ['SC-Verletzung', 'OE', 'M11 + M7'],
  ['AC-Verletzung', 'OE', 'M11 + M7'],
  ['Claviculafrakturen', 'OE', 'M11 + M7'],
  ['Floating Shoulder', 'OE', 'M11 + M7'],
  ['Glenoidfrakturen', 'OE', 'M11 + M7'],
  ['Humerusschaftfrakturen', 'OE', 'M11 + M7'],
  ['Proximal Humerusfraktur', 'OE', 'M11 + M7'],
  ['Schulterluxation (+/- Fraktur, ALPSA, Bankart, HillSachs, HAGL)', 'OE', 'M11 + M7'],
  ['Subscapruptur bei Sublixation', 'OE', 'M11 + M7'],
  ['Ant inf schulterlux mit rm massenruptur 62y', 'OE', 'M11 + M7'],
  ['Proximale humerusfx headsplit mit fehlinplantierte SchulterTP mit infekt + latissimusdorsi transfer', 'OE', 'M11 + M7'],
  ['Distale Bicepssehnenruptur (Arhtrex DBT bspw)', 'OE', 'M11 + M7'],
  ['Ellenbogenluxationsfraktur, inkl Zugänge für ORIF (Radiuskopfprothese vs resektion)', 'OE', 'M11 + M7'],
  ['Radiusköpfchenfraktur/luxation', 'OE', 'M11 + M7'],
  ['Unterarmfrakturen', 'OE', 'M11 + M7'],
  ['Radiusfraktur', 'OE', 'M11 + M7'],
  ['Kompartment Arm', 'OE', 'M11 + M7'],
  ['Monteggia/Galeazzi', 'OE', 'M11 + M7'],
  ['Sakrumfrakturen', 'WS', 'M8'],
  ['Wirbelkörperfrakturen', 'WS', 'M8'],
  ['Zervikale Dislokationsfrakturen', 'WS', 'M8'],
  ['Querschnitt', 'WS', 'M8'],
  ['Luxierte facettengelenksfx hwk 6/7 mit neurologie', 'WS', 'M8'],
  ['FFP-Frakturen', 'Hüfte', 'M11 + M5'],
  ['Schenkelhalsfrakturen (Versorgung, Cut out)', 'Hüfte', 'M11 + M5'],
  ['Hüftluxation/ Hüft tp Lux', 'Hüfte', 'M11 + M5'],
  ['Pipkin fraktur', 'Hüfte', 'M11 + M5'],
  ['Acetabulumfrakturen', 'Hüfte', 'M11 + M5'],
  ['Beckenringfrakturen', 'Hüfte', 'M11 + M5'],
  ['Prox Femurschaftfx mit Non-union', 'Hüfte', 'M11 + M5'],
  ['Acetabulum hinterwand FX bei cam mit flexions bagatelltrauma', 'Hüfte', 'M11 + M5'],
  ['Kompartment Unterschenkel', 'Knie', 'M11'],
  ['Tibiafraktur', 'Knie', 'M11'],
  ['Kniedislokation', 'Knie', 'M11 + M4'],
  ['VKB/HKB Ruptur', 'Knie', 'M11 + M4'],
  ['Patella Luxxation', 'Knie', 'M11 + M4'],
  ['Periprotetische femur fx mit einliegende ktp Und HTP', 'Knie', 'M11 + M5'],
  ['OSG Fraktur', 'Fuss', 'M11 + M6'],
  ['Talusfraktur', 'Fuss', 'M11 + M6'],
  ['Calcaneusfraktur', 'Fuss', 'M11 + M6'],
  ['Lisfranc frakturen', 'Fuss', 'M11 + M6'],
  ['USG Luxation', 'Fuss', 'M11 + M6'],
  ['Achillessehnenruptur', 'Fuss', 'M11 + M6'],
  ['Pilonfraktur inkl. Compartment', 'Fuss', 'M11 + M6'],
  ['Amputationsverletzungen', 'mixed', 'M11'],
  ['ATLS/Polytraumamanagment', 'mixed', 'M11'],
  ['Offene Frakturen', 'mixed', 'M11'],
  ['Schock', 'mixed', 'M11'],
]);

const upperExtremity = cases('upper', [
  ['Proximale Bicepssehnenruptur', 'OE', 'M7'],
  ['Rotatorenmaschettenruptur (Neer, Pate, Goutellier)', 'OE', 'M4 + M7'],
  ['Milwaukee Schulter', 'OE', 'M7'],
  ['Neuroarhtropathie bei Syringomyelie', 'OE', 'M7'],
  ['Schulterinstabilität (ISIS', 'OE', 'M4 + M7'],
  ['Omarthrose', 'OE', 'M5 + M7'],
  ['Schulterlux/Instabilität mit Latarjet', 'OE', 'M4 + M7'],
  ["Schulterschmerz mit I'm verlauf nekrose, anatomische conversion, ssc ausriss und anteriorer escape", 'OE', 'M5 + M7'],
  ['Ellenbogeninstabilität (PLRI)', 'OE', 'M4 + M7'],
  ['Ellenbogenzugänge', 'OE', 'M7'],
  ['ODC Ellenbogen inkl. Arthroskopie', 'OE', 'M4 + M7'],
]);

const foot = cases('foot', [
  ['CMT', 'Fuss', 'M6'],
  ['Tibialis posterior insuffizienz', 'Fuss', 'M6'],
  ['Tarsaltunnelsyndrom', 'Fuss', 'M6'],
  ['Morton Neurom', 'Fuss', 'M6'],
  ['Hallux Valgus', 'Fuss', 'M6'],
  ['Pes planovalgus', 'Fuss', 'M6'],
  ['Zehenfehlbildungen', 'Fuss', 'M6'],
  ['Charcot/diabetischer Fuss (onkl. Schuhversorgung)', 'Fuss', 'M6'],
]);

const knee = cases('knee', [
  ['Meniskusläsionen', 'Knie', 'M4'],
  ['OCD Knie', 'Knie', 'M4'],
  ['Knieinfekt (inkl. Gächter)', 'Knie', 'M5'],
  ['Knie Prothetik (inkl. Kurve Überlebensrate)', 'Knie', 'M5'],
  ['UniKnie', 'Knie', 'M5'],
  ['Schmerzhafte KTP', 'Knie', 'M5'],
  ['M. Ahlbäck', 'Knie', 'M5'],
  ['Protheseninfekt Hemiprothese knie (Borrelien)', 'Knie', 'M5'],
  ['mediale gonarthrose', 'Knie', 'M5'],
  ['Med mensikusläsion chondropathie femur 38y genu Varum -> hto', 'Knie', 'M4 + M5'],
  ['Patella Instabilität / Luxatione bei 17 u ohne Leidensdruck', 'Knie', 'M4'],
]);

const hip = cases('hip', [
  ['Umstellungsosteotomien Hüfte', 'Hüfte', 'M5'],
  ['Hüftdysplasie', 'Hüfte', 'M5'],
  ['FAI', 'Hüfte', 'M4'],
  ['Torsionswinkel Hüfte', 'Hüfte', 'M4'],
  ['Beckenosteotomie', 'Hüfte', 'M5'],
  ['Hüftendoprothetik', 'Hüfte', 'M5'],
  ['Pseudotumor b modularer TP', 'Hüfte', 'M5'],
  ['Schmerzhafte HTP', 'Hüfte', 'M5'],
  ['Aseptische Lockerung', 'Hüfte', 'M5'],
  ['Femurkopfnekrose', 'Hüfte', 'M5'],
  ['Septische Arthritis Hüfte bei Polytöxler', 'Hüfte', 'M5'],
]);

const spine = cases('spine', [
  ['Diskushernien', 'WS', 'M8'],
  ['Spinalkanalstenose', 'WS', 'M8'],
  ['Adolescente Scoliose', 'WS', 'M8'],
  ['Spondylolisthesen', 'WS', 'M8'],
  ['M. Bechterew', 'WS', 'M8'],
  ['12J mit Spondylolisthesis grad III mit verlängerter pars (Isthmisch Wiltse IIb), spina bifida occulta', 'WS', 'M8'],
  ['TLIF', 'WS', 'M8'],
]);

export const phases: StudyPhase[] = [
  { id: 'trauma', name: 'Trauma', start: '2026-08-25', end: '2026-09-13', window: '25 AUG – 13 SEP', miller: 'M11 · M8 SPINE', pages: '810–869 · 721–740', items: trauma },
  { id: 'upper', name: 'Upper extremity', start: '2026-09-14', end: '2026-09-27', window: '14 – 27 SEP', miller: 'M4 · M5 · M7', pages: '326–357 · 468–475 · 589–684', items: upperExtremity },
  { id: 'foot', name: 'Foot & ankle', start: '2026-09-28', end: '2026-10-11', window: '28 SEP – 11 OCT', miller: 'M6', pages: '480–588', items: foot },
  { id: 'knee', name: 'Knee', start: '2026-10-12', end: '2026-10-25', window: '12 – 25 OCT', miller: 'M4 · M5 · M11', pages: '284–320 · 415–468 · 842–848', items: knee },
  { id: 'hip', name: 'Hip', start: '2026-10-26', end: '2026-11-08', window: '26 OCT – 08 NOV', miller: 'M4 · M5 · M11', pages: '320–325 · 370–414 · 825–841', items: hip },
  { id: 'spine', name: 'Spine', start: '2026-11-09', end: '2026-11-15', window: '09 – 15 NOV', miller: 'M8', pages: '685–744', items: spine },
];

const paediatrics = cases('reserve-peds', [
  ['Neurofibromatose', 'Peds', 'M3 + M9'],
  ['CP', 'Peds', 'M3 + M10'],
  ['Osgood Schlatter', 'Peds', 'M3 + M4'],
  ['Tibia Bowing', 'Peds', 'M3'],
  ['Sichelfuss/Metatarsus adductus', 'Peds', 'M3 + M6'],
  ['Vertical talus', 'Peds', 'M3 + M6'],
  ['Klumpfuss', 'Peds', 'M3 + M6'],
  ['Coalitio', 'Peds', 'M3 + M6'],
  ['SCFE', 'Peds', 'M3 + M5'],
  ['M. Perthes', 'Peds', 'M3 + M5'],
  ['M. Blount', 'Peds', 'M3 + M5'],
  ['Kongenitale Tibiapseudarthrose', 'Peds', 'M3'],
  ['Salter-Harris und Übergangsfrakturen', 'Peds', 'M3 + M11'],
  ['Kindesmisshandlung', 'Peds', 'M3 + M11'],
  ['Schenkelhalsfrakturen Kind', 'Peds', 'M3 + M11'],
  ['Femurfrakturen Kind (D-Klassifikation)', 'Peds', 'M3 + M11'],
  ['Ellenbogenluxations Kind', 'Peds', 'M3 + M11'],
  ['Radiusfraktur Kind', 'Peds', 'M3 + M11'],
  ['Suprakondyläre Kind', 'Peds', 'M3 + M11'],
  ['Salter Harris III Fraktur distales Femur', 'Peds', 'M3 + M11'],
  ['Unicameral bone cyst zufallsbefund bei femurfraktur beim kind', 'Peds', 'M3 + M9'],
  ['Idiopathische Beinlängendifferenz mit VKB Aplasie', 'Peds', 'M3'],
]);

const general = cases('reserve-general', [
  ['Kristallarthropathie', 'mixed', 'M1'],
  ['Osteoporose (inkl. transiente Osteoporose)', 'mixed', 'M1'],
  ['Protheseninfekte', 'mixed', 'M5'],
  ['RA', 'mixed', 'M1'],
  ['Tumor oder ossäre metastase trochanter major', 'mixed', 'M9'],
]);

export const reserveGroups = [
  { name: 'PAEDIATRICS · CASE LIST', items: paediatrics },
  { name: 'GENERAL · CASE LIST', items: general },
];

export const sideChapters = cases('side', [
  ['Basic Sciences · pp 1–96', 'MILLER', 'M1'],
  ['Anatomy · pp 97–214', 'MILLER', 'M2'],
  ['Pediatric Orthopaedics · pp 215–283', 'MILLER', 'M3'],
  ['Orthopaedic Pathology · pp 745–782', 'MILLER', 'M9'],
  ['Rehabilitation · pp 783–809', 'MILLER', 'M10'],
  ['Principles of Practice · pp 870–877', 'MILLER', 'M12'],
  ['Biostatistics and Research Design · pp 878–891', 'MILLER', 'M13'],
]);
