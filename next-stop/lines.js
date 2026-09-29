/* Next Stop — line data.
   Lines are inspired by real metro lines. Names and colors are used as
   place names and plain colors; no logos or brand marks. Later lines are
   faster and stricter. `unlock` is the total-stops count needed to open a line.

   Tuning fields (all in world px; 1 px ≈ 10 cm):
     v0     cruise speed at station 0            (px/s)
     dv     cruise speed added per station       (px/s)
     vmax   cruise speed cap                     (px/s)
     decel  brake deceleration                   (px/s²)
     wet    chance a station has wet rails       (0..1)
     express chance a station is a skip station  (0..1)
     good   [start, end] half-width of the "good" stop window
     perf   [start, end] half-width of the "perfect" stop window
     ramp   stations over which good/perf shrink from start to end
*/
window.NEXT_STOP_LINES = [
  {
    id: 'lis-azul', city: 'Lisboa', name: 'Linha Azul', color: '#2f7fd6', unlock: 0,
    v0: 240, dv: 10, vmax: 440, decel: 430, wet: 0.10, express: 0.10, good: [46, 28], perf: [10, 6], ramp: 26,
    stations: ['Reboleira', 'Amadora Este', 'Alfornelos', 'Pontinha', 'Carnide', 'Colégio Militar', 'Alto dos Moinhos', 'Laranjeiras', 'Jardim Zoológico', 'Praça de Espanha', 'São Sebastião', 'Parque', 'Marquês de Pombal', 'Avenida', 'Restauradores', 'Baixa-Chiado', 'Terreiro do Paço', 'Santa Apolónia'],
  },
  {
    id: 'por-amarela', city: 'Porto', name: 'Linha Amarela', color: '#f2c318', unlock: 30,
    v0: 255, dv: 11, vmax: 470, decel: 430, wet: 0.14, express: 0.12, good: [44, 26], perf: [9, 5.5], ramp: 24,
    stations: ['Hospital São João', 'IPO', 'Pólo Universitário', 'Salgueiros', 'Combatentes', 'Marquês', 'Faria Guimarães', 'Trindade', 'Aliados', 'São Bento', 'Jardim do Morro', 'General Torres', 'Câmara de Gaia', 'João de Deus', 'D. João II', 'Santo Ovídio'],
  },
  {
    id: 'lon-central', city: 'London', name: 'Central', color: '#dc241f', unlock: 80,
    v0: 270, dv: 12, vmax: 500, decel: 440, wet: 0.14, express: 0.16, good: [42, 25], perf: [9, 5], ramp: 24,
    stations: ['Notting Hill Gate', 'Queensway', 'Lancaster Gate', 'Marble Arch', 'Bond Street', 'Oxford Circus', 'Tottenham Court Road', 'Holborn', 'Chancery Lane', "St. Paul's", 'Bank', 'Liverpool Street', 'Bethnal Green', 'Mile End', 'Stratford'],
  },
  {
    id: 'par-6', city: 'Paris', name: 'Ligne 6', color: '#6eca97', unlock: 150,
    v0: 280, dv: 12, vmax: 520, decel: 440, wet: 0.10, express: 0.18, good: [40, 24], perf: [8.5, 5], ramp: 22,
    stations: ['Charles de Gaulle–Étoile', 'Kléber', 'Boissière', 'Trocadéro', 'Passy', 'Bir-Hakeim', 'Dupleix', 'La Motte-Picquet', 'Cambronne', 'Sèvres–Lecourbe', 'Pasteur', 'Montparnasse', 'Edgar Quinet', 'Raspail', 'Denfert-Rochereau', 'Saint-Jacques', 'Glacière', 'Corvisart', "Place d'Italie", 'Nationale', 'Chevaleret', 'Quai de la Gare', 'Bercy', 'Dugommier', 'Daumesnil', 'Bel-Air', 'Picpus', 'Nation'],
  },
  {
    id: 'ber-u9', city: 'Berlin', name: 'U9', color: '#f3791d', unlock: 240,
    v0: 290, dv: 13, vmax: 520, decel: 450, wet: 0.16, express: 0.16, good: [38, 23], perf: [8, 4.8], ramp: 22,
    stations: ['Osloer Straße', 'Nauener Platz', 'Leopoldplatz', 'Amrumer Straße', 'Westhafen', 'Birkenstraße', 'Turmstraße', 'Hansaplatz', 'Zoologischer Garten', 'Kurfürstendamm', 'Spichernstraße', 'Güntzelstraße', 'Berliner Straße', 'Bundesplatz', 'Friedrich-Wilhelm-Platz', 'Walther-Schreiber-Platz', 'Schloßstraße', 'Rathaus Steglitz'],
  },
  {
    id: 'nyc-7', city: 'New York', name: '7 Flushing', color: '#b933ad', unlock: 350,
    v0: 300, dv: 14, vmax: 530, decel: 450, wet: 0.12, express: 0.22, good: [37, 22], perf: [8, 4.6], ramp: 20,
    stations: ['Times Sq–42 St', '5 Av', 'Grand Central', 'Vernon Blvd', 'Hunters Point Av', 'Court Sq', 'Queensboro Plaza', '33 St–Rawson', '40 St–Lowery', '46 St–Bliss', '52 St', '61 St–Woodside', '69 St', '74 St–Broadway', '82 St–Jackson Hts', '90 St–Elmhurst', 'Junction Blvd', '103 St', '111 St', 'Mets–Willets Point', 'Flushing–Main St'],
  },
  {
    id: 'tok-tozai', city: 'Tokyo', name: 'Tozai', color: '#00a7db', unlock: 480,
    v0: 310, dv: 14, vmax: 540, decel: 460, wet: 0.14, express: 0.20, good: [36, 21], perf: [7.5, 4.4], ramp: 20,
    stations: ['Nakano', 'Ochiai', 'Takadanobaba', 'Waseda', 'Kagurazaka', 'Iidabashi', 'Kudanshita', 'Takebashi', 'Otemachi', 'Nihombashi', 'Kayabacho', 'Monzen-nakacho', 'Kiba', 'Toyocho', 'Minami-sunamachi', 'Nishi-kasai', 'Kasai', 'Urayasu', 'Minami-gyotoku', 'Gyotoku', 'Myoden', 'Baraki-nakayama', 'Nishi-funabashi'],
  },
  {
    id: 'mex-1', city: 'Mexico City', name: 'Línea 1', color: '#f04e98', unlock: 640,
    v0: 320, dv: 15, vmax: 550, decel: 460, wet: 0.16, express: 0.22, good: [35, 20], perf: [7.5, 4.2], ramp: 20,
    stations: ['Observatorio', 'Tacubaya', 'Juanacatlán', 'Chapultepec', 'Sevilla', 'Insurgentes', 'Cuauhtémoc', 'Balderas', 'Salto del Agua', 'Isabel la Católica', 'Pino Suárez', 'Merced', 'Candelaria', 'San Lázaro', 'Moctezuma', 'Balbuena', 'Blvd. Puerto Aéreo', 'Gómez Farías', 'Zaragoza', 'Pantitlán'],
  },
];
