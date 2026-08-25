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
  ['Hüftdysplasie', 'Hüfte', 'M5 · H5.4 · 216–240'],
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
  ['Adolescente Scoliose', 'WS', 'M8 · H4.4 · 95–119'],
  ['Spondylolisthesen', 'WS', 'M8'],
  ['M. Bechterew', 'WS', 'M8'],
  ['12J mit Spondylolisthesis grad III mit verlängerter pars (Isthmisch Wiltse IIb), spina bifida occulta', 'WS', 'M8'],
  ['TLIF', 'WS', 'M8'],
]);

const paediatrics = cases('reserve-peds', [
  ['Neurofibromatose', 'HEFTI', 'H14.2.29.7–9 / H4.11.1 · M3+M9 · 163–164 / 812–814'],
  ['CP', 'HEFTI', 'H15.3.1 · M3+M10 · 877–881'],
  ['Osgood Schlatter', 'HEFTI', 'H6.3.3 · M3+M4 · 339–340'],
  ['Tibia Bowing', 'HEFTI', 'H6.6.6–7 · M3 · 370–374'],
  ['Sichelfuss/Metatarsus adductus', 'HEFTI', 'H7.6 · M3+M6 · 471–474'],
  ['Vertical talus', 'HEFTI', 'H7.4 · M3+M6 · 451–455'],
  ['Klumpfuss', 'HEFTI', 'H7.3 · M3+M6 · 435–450'],
  ['Coalitio', 'HEFTI', 'H7.5.2 · M3+M6 · 458–461'],
  ['SCFE', 'HEFTI', 'H5.6 · M3+M5 · 255–264'],
  ['M. Perthes', 'HEFTI', 'H5.5 · M3+M5 · 241–254'],
  ['M. Blount', 'HEFTI', 'H10.1 · M3+M5 · 639–640'],
  ['Kongenitale Tibiapseudarthrose', 'HEFTI', 'H6.6.6 · M3 · 370–373'],
  ['Salter-Harris und Übergangsfrakturen', 'HEFTI', 'H9.3.3 / H7.11.1 · M3+M11 · 511–515 / 618–619'],
  ['Kindesmisshandlung', 'HEFTI', 'H9.4.2 · M3+M11 · 620–621'],
  ['Schenkelhalsfrakturen Kind', 'HEFTI', 'H5.9.2 · M3+M11 · 294–297'],
  ['Femurfrakturen Kind (D-Klassifikation)', 'HEFTI', 'H5.9.3 · M3+M11 · 298–300'],
  ['Ellenbogenluxations Kind', 'HEFTI', 'H8.7.11 · M3+M11 · 591–592'],
  ['Radiusfraktur Kind', 'HEFTI', 'H8.7.13–14 · M3+M11 · 595–600'],
  ['Suprakondyläre Kind', 'HEFTI', 'H8.7.6 · M3+M11 · 580–584'],
  ['Salter Harris III Fraktur distales Femur', 'HEFTI', 'H6.9.1 · M3+M11 · 394–397'],
  ['Unicameral bone cyst zufallsbefund bei femurfraktur beim kind', 'HEFTI', 'H13.2.7.1 / H9.4.3 · M3+M9 · 621 / 709–711'],
  ['Idiopathische Beinlängendifferenz mit VKB Aplasie', 'HEFTI', 'H10.2 / H6.6.5 · M3 · 369–370 / 645–658'],
]);

export const phases: StudyPhase[] = [
  { id: 'trauma', name: 'Trauma', start: '2026-08-25', end: '2026-09-27', window: '25 AUG – 27 SEP', miller: 'M11 · M8 SPINE', pages: '810–869 · 721–740', items: trauma },
  { id: 'upper', name: 'Upper extremity', start: '2026-09-28', end: '2026-10-05', window: '28 SEP – 05 OCT', miller: 'M4 · M5 · M7', pages: '326–357 · 468–475 · 589–684', items: upperExtremity },
  { id: 'foot', name: 'Foot & ankle', start: '2026-10-06', end: '2026-10-11', window: '06 – 11 OCT', miller: 'M6', pages: '480–588', items: foot },
  { id: 'knee', name: 'Knee', start: '2026-10-12', end: '2026-10-19', window: '12 – 19 OCT', miller: 'M4 · M5 · M11', pages: '284–320 · 415–468 · 842–848', items: knee },
  { id: 'hip', name: 'Hip', start: '2026-10-20', end: '2026-10-27', window: '20 – 27 OCT', miller: 'M4 · M5 · M11', pages: '320–325 · 370–414 · 825–841', items: hip },
  { id: 'peds', name: 'Paediatrics', start: '2026-10-28', end: '2026-11-11', window: '28 OCT – 11 NOV', miller: 'HEFTI 3E · MILLER M3', pages: 'H4–10 · H13–15', items: paediatrics },
  { id: 'spine', name: 'Spine', start: '2026-11-12', end: '2026-11-16', window: '12 – 16 NOV', miller: 'M8', pages: '685–744', items: spine },
];

const general = cases('reserve-general', [
  ['Kristallarthropathie', 'mixed', 'M1'],
  ['Osteoporose (inkl. transiente Osteoporose)', 'mixed', 'M1'],
  ['Protheseninfekte', 'mixed', 'M5'],
  ['RA', 'mixed', 'M1'],
  ['Tumor oder ossäre metastase trochanter major', 'mixed', 'M9'],
]);

export const reserveGroups = [
  { name: 'GENERAL · CASE LIST', items: general },
];

const allSideChapters = cases('side', [
  ['Basic Sciences · pp 1–96', 'MILLER', 'M1'],
  ['Anatomy · pp 97–214', 'MILLER', 'M2'],
  ['Pediatric Orthopaedics · pp 215–283', 'MILLER', 'M3'],
  ['Orthopaedic Pathology · pp 745–782', 'MILLER', 'M9'],
  ['Rehabilitation · pp 783–809', 'MILLER', 'M10'],
  ['Principles of Practice · pp 870–877', 'MILLER', 'M12'],
  ['Biostatistics and Research Design · pp 878–891', 'MILLER', 'M13'],
]);

export const sideChapters = allSideChapters.filter((item) => item.id !== 'side-03');
