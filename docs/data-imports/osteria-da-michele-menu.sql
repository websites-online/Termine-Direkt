-- Prepared import from OSTERIAMICHELE-Speisekarte-korrigiert.pdf.
-- Deploy the matching API/frontend first: older versions truncate menus to 60 entries.
-- Only this company's menu fields change. Existing photos and profile texts remain.
begin;
do $import$
declare
  target record;
  menu_data jsonb := $menu${
  "menu": [
    {
      "id": "michele-1",
      "category": "Vorspeisen",
      "description": "schwarze Oliven mit Brot · 5",
      "name": "Olive Nere con Pane",
      "price": 5.4
    },
    {
      "id": "michele-2",
      "category": "Vorspeisen",
      "description": "Käseteller, Honig, Brot · A1, B",
      "name": "Misto di Formaggio",
      "price": 11.8
    },
    {
      "id": "michele-3",
      "category": "Vorspeisen",
      "description": "Parmaschinken, Salami und Käse · 3, B",
      "name": "Antipasto Rustico",
      "price": 11.6
    },
    {
      "id": "michele-4",
      "category": "Vorspeisen",
      "description": "hauchdünne Scheiben vom Rinderfilet mit Rucola, Parmesan · B",
      "name": "Carpaccio di Manzo",
      "price": 12.6
    },
    {
      "id": "michele-5",
      "category": "Vorspeisen",
      "description": "Tomaten mit Büffelmozzarella und Basilikum · B",
      "name": "Insalata Caprese",
      "price": 10.2
    },
    {
      "id": "michele-6",
      "category": "Vorspeisen",
      "description": "gemischte vegetarische Vorspeise",
      "name": "Antipasti Misti",
      "price": 9.8
    },
    {
      "id": "michele-7",
      "category": "Vorspeisen",
      "description": "4 knusprige Weißbrotscheiben mit Tomatenstückchen · A1",
      "name": "Bruschetta",
      "price": 5.6
    },
    {
      "id": "michele-8",
      "category": "Vorspeisen",
      "description": "Gamberetti in Knoblauchsoße · A1, F",
      "name": "Scampetti all’Aglio",
      "price": 11.8
    },
    {
      "id": "michele-9",
      "category": "Vorspeisen",
      "description": "mit Tomatenstücken, Knoblauch, Oregano · A1",
      "name": "Pizza Pane Bruschetta",
      "price": 7.8
    },
    {
      "id": "michele-10",
      "category": "Suppen",
      "description": "selbstgemachte Tomatensuppe",
      "name": "Zuppa di Pomodoro",
      "price": 5.4
    },
    {
      "id": "michele-11",
      "category": "Suppen",
      "description": "mit gefüllten Nudeln in Kraftbrühe · A1",
      "name": "Zuppa di Tortellini",
      "price": 5.4
    },
    {
      "id": "michele-12",
      "category": "Suppen",
      "description": "",
      "name": "Tagessuppe",
      "price": 5.4
    },
    {
      "id": "michele-13",
      "category": "Salate",
      "description": "Tomatensalat mit Zwiebeln",
      "name": "Insalata di Pomodori",
      "price": 4.8
    },
    {
      "id": "michele-14",
      "category": "Salate",
      "description": "kleiner bunter Gartensalat",
      "name": "Insalata Dell‘Orto",
      "price": 6.8
    },
    {
      "id": "michele-17",
      "category": "Salate",
      "description": "großer gemischter Salat mit Schinken, Käse, Ei, Thunfisch · B, C, D, 3, 6, 7",
      "name": "Insalata Italia",
      "price": 10.8
    },
    {
      "id": "michele-18",
      "category": "Salate",
      "description": "kleiner gemischter Salat mit Schinken, Käse, Ei, Thunfisch · B, C, D, 3, 6, 7",
      "name": "Insalata Italia Piccola",
      "price": 7.8
    },
    {
      "id": "michele-20",
      "category": "Salate",
      "description": "Rucola, Kirschtomaten, Grana Padano · B",
      "name": "Insalata Rucola",
      "price": 8.2
    },
    {
      "id": "michele-21",
      "category": "Salate",
      "description": "gemischter Salat mit Hähnchenbrust, Parmesansplitter · B, 3, 6, 7",
      "name": "Insalata Pollo",
      "price": 13.2
    },
    {
      "id": "michele-22",
      "category": "Salate",
      "description": "großer gemischter Salat mit Krabben · D, E",
      "name": "Insalata con Gamberetti",
      "price": 13.8
    },
    {
      "id": "michele-36",
      "category": "Pasta",
      "description": "mit Tomaten-Sauce · A1",
      "name": "Spaghetti Napoli",
      "price": 9.8
    },
    {
      "id": "michele-37",
      "category": "Pasta",
      "description": "mit Hackfleisch-Sauce · A1, E",
      "name": "Spaghetti Bologna",
      "price": 11.4
    },
    {
      "id": "michele-39",
      "category": "Pasta",
      "description": "mit Guanciale und Ei · A1, C",
      "name": "Spaghetti alla Carbonara",
      "price": 12.2
    },
    {
      "id": "michele-40",
      "category": "Pasta",
      "description": "pikant mit Knoblauch, Olivenöl und Peperoncino · 9, C",
      "name": "Spaghetti Aglio e Olio",
      "price": 10.4
    },
    {
      "id": "michele-43",
      "category": "Pasta",
      "description": "mit Meeresfrüchten, Knoblauch und Tomaten-Sauce · A1, D",
      "name": "Spaghetti Frutti di Mare",
      "price": 14.2
    },
    {
      "id": "michele-49",
      "category": "Pasta",
      "description": "mit Hackfleisch-Sauce und Schinken, mit Käse überbacken · A1, B, E, 3, 6, 7",
      "name": "Rigatoni al Forno",
      "price": 11.8
    },
    {
      "id": "michele-50",
      "category": "Pasta",
      "description": "mit Gorgonzola-Sahne-Sauce · A1, B",
      "name": "Rigatoni al Gorgonzola",
      "price": 11.2
    },
    {
      "id": "michele-51",
      "category": "Pasta",
      "description": "mit Knoblauch und scharfer Tomaten-Sauce · A1",
      "name": "Penne all’Arrabiata",
      "price": 10.8
    },
    {
      "id": "michele-53",
      "category": "Pasta",
      "description": "getrocknete Feigen, Parmaschinken, Kirschtomaten · A1",
      "name": "Tagliatelle Parma e Fichi",
      "price": 15.8
    },
    {
      "id": "michele-55",
      "category": "Pasta",
      "description": "mit Lachs, Zucchini und Tomaten-Sauce · A1, D, 5",
      "name": "Tagliatelle „Salmone“",
      "price": 15.6
    },
    {
      "id": "michele-56",
      "category": "Pasta",
      "description": "mit Schinken-Sahne-Sauce · A1, B, 3, 6, 7",
      "name": "Tortellini alla Panna",
      "price": 11.6
    },
    {
      "id": "michele-58",
      "category": "Pasta",
      "description": "mit Steinpilzen und Tomatensauce · A1, B",
      "name": "Orecchiette Salsiccia",
      "price": 15.2
    },
    {
      "id": "michele-59",
      "category": "Pasta",
      "description": "mit Garnelen, Meeresfrüchten und Pilzen · A1, F",
      "name": "Orecchiette Terra & Mare",
      "price": 16.8
    },
    {
      "id": "michele-61",
      "category": "Pasta",
      "description": "Schichtnudeln mit Hackfleisch-Sauce, mit Käse überbacken · A1, B, E",
      "name": "Lasagne",
      "price": 11.2
    },
    {
      "id": "michele-62",
      "category": "Pasta",
      "description": "Ricotta mit Spinat (vegetarisch) · A1",
      "name": "Cannelloni",
      "price": 11.2
    },
    {
      "id": "michele-71",
      "category": "Pizza",
      "description": "Kennzeichnungen: A1",
      "name": "Pizza Brot",
      "price": 4.8
    },
    {
      "id": "michele-72",
      "category": "Pizza",
      "description": "Büffelmozzarella, Basilikum und Kirschtomaten · A1, B",
      "name": "Sophia Loren",
      "price": 11.8
    },
    {
      "id": "michele-74",
      "category": "Pizza",
      "description": "Fior di latte Mozarella · A1, B",
      "name": "Margherita",
      "price": 9.4
    },
    {
      "id": "michele-77",
      "category": "Pizza",
      "description": "Salami · A1",
      "name": "Salame",
      "price": 9.8
    },
    {
      "id": "michele-78",
      "category": "Pizza",
      "description": "Schinken · A1, 3, 6, 7",
      "name": "Prosciutto",
      "price": 9.8
    },
    {
      "id": "michele-82",
      "category": "Pizza",
      "description": "Schinken, frische Champignons · A1, 3, 6, 7",
      "name": "Regina",
      "price": 10.6
    },
    {
      "id": "michele-83",
      "category": "Pizza",
      "description": "Schinken, Ananas · A1, 3, 6, 7",
      "name": "Hawaii",
      "price": 10.6
    },
    {
      "id": "michele-84",
      "category": "Pizza",
      "description": "Thunfisch, Zwiebeln · A1, D",
      "name": "Tonno Cipolle",
      "price": 11.2
    },
    {
      "id": "michele-85",
      "category": "Pizza",
      "description": "Salami, Peperoni, Paprika, Champignon · A1, 1, 3, 7",
      "name": "Mista",
      "price": 11.2
    },
    {
      "id": "michele-88",
      "category": "Pizza",
      "description": "Salami, Schinken, Paprika, Artischocken, Champignon · A1, 1, 3, 6, 7",
      "name": "Da Michele Speciale",
      "price": 11.2
    },
    {
      "id": "michele-89",
      "category": "Pizza",
      "description": "Schinken, Champignon, Artischocken, Oliven · A1, 3, 5, 6, 7",
      "name": "Capriciosa",
      "price": 11.2
    },
    {
      "id": "michele-91",
      "category": "Pizza",
      "description": "scharfe Salami, Gorgonzola · A1, 1, 3",
      "name": "Da Noi",
      "price": 11.2
    },
    {
      "id": "michele-94",
      "category": "Pizza",
      "description": "Sardellen, Knoblauch, Zwiebeln, Peperoni, Oliven · A1, D, 5",
      "name": "Alla Contadina",
      "price": 11.2
    },
    {
      "id": "michele-95",
      "category": "Pizza",
      "description": "Mozzarella, Grana Padano, Gorgonzola, Scamorza · A1, B",
      "name": "Quattro Formaggi",
      "price": 11.2
    },
    {
      "id": "michele-96",
      "category": "Pizza",
      "description": "gefüllt mit Salami, Schinken, Paprika, Champignon · A1, 1, 3, 6, 7",
      "name": "Calzone",
      "price": 11.2
    },
    {
      "id": "michele-97",
      "category": "Pizza",
      "description": "verschiedenes Gemüse · A1, vegan",
      "name": "Vegetaria",
      "price": 11.2
    },
    {
      "id": "michele-98",
      "category": "Pizza",
      "description": "Meeresfrüchte · A1, D",
      "name": "Frutti di Mare",
      "price": 11.8
    },
    {
      "id": "michele-100",
      "category": "Pizza",
      "description": "scharfe Salami, Oliven, Peperoni · A1, 1, 3",
      "name": "Diavolo",
      "price": 11.2
    },
    {
      "id": "michele-101",
      "category": "Pizza",
      "description": "Parmaschinken, Rucola, Grana Padano · A1, 3",
      "name": "Parma",
      "price": 12.8
    },
    {
      "id": "michele-102",
      "category": "Pizza",
      "description": "Rucola, Grana Padano, Kirschtomaten · A1, B, vegan",
      "name": "Estate",
      "price": 11.8
    },
    {
      "id": "michele-103",
      "category": "Pizza",
      "description": "Auberginen, Zucchini, Champignon, Rucola · A1, vegan",
      "name": "Ortolana",
      "price": 12.2
    },
    {
      "id": "michele-105",
      "category": "Pizza",
      "description": "Rinderschinken, Rucola, Grana Padano · A1",
      "name": "Bresaola",
      "price": 14.8
    },
    {
      "id": "michele-106",
      "category": "Pizza",
      "description": "Bianca, Trüffelcreme, Rucola, Kirschtomaten, Grana Padano · A1, 3",
      "name": "Tartufata",
      "price": 13.8
    },
    {
      "id": "michele-107",
      "category": "Pizza",
      "description": "Bianca, Salami pikante, Champignon · A1, 3, 6, 7",
      "name": "Scamorza",
      "price": 13.8
    },
    {
      "id": "michele-108",
      "category": "Pizza",
      "description": "Bianca, Meeresfrüchte, Gamberetti, Champignon, Knoblauch, Spinat, Kirschtomaten · A1, F",
      "name": "Terra & Mare",
      "price": 15.8
    },
    {
      "id": "michele-111",
      "category": "Fleisch",
      "description": "Kalbsschnitzel paniert mit Pommes frites und Salat · A1, C",
      "name": "Cotoletta alla Milanese",
      "price": 18.8
    },
    {
      "id": "michele-128",
      "category": "Fleisch",
      "description": "Kalbslende in Zitronen-Sauce mit Kartoffeln, Gemüse und Salat",
      "name": "Scaloppina al Limone",
      "price": 20.8
    },
    {
      "id": "michele-129",
      "category": "Fleisch",
      "description": "Kalbsschnitzel mit Parmaschinken, Salbei, Kartoffeln, Gemüse und Salat · 3",
      "name": "Saltimbocca alla Romana",
      "price": 21.8
    },
    {
      "id": "michele-130",
      "category": "Fleisch",
      "description": "Putenfilet in Gorgonzola-Sauce mit Kartoffeln, Gemüse und Salat",
      "name": "Filetto di Tacchino al Gorgonzola",
      "price": 17.8
    },
    {
      "id": "michele-131",
      "category": "Fleisch",
      "description": "Putenfilet mit Steinpilzen, Kartoffeln, Gemüse und Salat · B",
      "name": "Filetto di Tacchino ai Porcini",
      "price": 17.8
    },
    {
      "id": "michele-161",
      "category": "Fisch",
      "description": "gebackener Tintenfisch mit Bruschetta oder Pommes Frites und Salat · A1, D",
      "name": "Calamari Fritti",
      "price": 16.8
    },
    {
      "id": "michele-163",
      "category": "Fisch",
      "description": "gegrillte Calamari mit Kartoffeln, Gemüse und Salat · D",
      "name": "Calamari alla Griglia",
      "price": 18.8
    },
    {
      "id": "michele-164",
      "category": "Fisch",
      "description": "gegrillte Calamari, Garnele und Lachs mit Kartoffeln, Gemüse und Salat · D",
      "name": "Grigliata Mista di Pesce",
      "price": 21.8
    },
    {
      "id": "michele-165",
      "category": "Fisch",
      "description": "gegrillte Riesen-Garnelen mit Bruschetta und Salat · A1, F, 8, 12",
      "name": "Gamberoni alla Griglia",
      "price": 19.9
    },
    {
      "id": "michele-166",
      "category": "Fisch",
      "description": "Lachs-Steak gegrillt mit Kartoffeln, Gemüse und Salat · G",
      "name": "Salmone alla Griglia",
      "price": 19.4
    },
    {
      "id": "michele-181",
      "category": "Desserts",
      "description": "Kennzeichnungen: B",
      "name": "Tiramisu",
      "price": 5.9
    },
    {
      "id": "michele-182",
      "category": "Desserts",
      "description": "Kennzeichnungen: B",
      "name": "Tartufo al Pistacchio",
      "price": 6.4
    },
    {
      "id": "michele-183",
      "category": "Desserts",
      "description": "Schokoladen-Eis · B",
      "name": "Tartufo Nero",
      "price": 5.9
    },
    {
      "id": "michele-184",
      "category": "Desserts",
      "description": "mit Schoko-, Karamell- oder Erdbeer-Sauce · B",
      "name": "Panna Cotta",
      "price": 5.9
    },
    {
      "id": "michele-185",
      "category": "Desserts",
      "description": "Schokoladen-Soufflé mit Vanilleeis · B",
      "name": "Soufflé di Cioccolato",
      "price": 6.8
    },
    {
      "id": "michele-186",
      "category": "Desserts",
      "description": "Kennzeichnungen: B",
      "name": "Affogato al Caffè",
      "price": 4.6
    },
    {
      "id": "michele-200",
      "category": "Kaffee & Tee",
      "description": "",
      "name": "Tee",
      "price": 2.2
    },
    {
      "id": "michele-201",
      "category": "Kaffee & Tee",
      "description": "",
      "name": "Espresso",
      "price": 2.3
    },
    {
      "id": "michele-202",
      "category": "Kaffee & Tee",
      "description": "",
      "name": "Espresso Doppio",
      "price": 3.2
    },
    {
      "id": "michele-203",
      "category": "Kaffee & Tee",
      "description": "",
      "name": "Espresso Macchiato",
      "price": 2.5
    },
    {
      "id": "michele-204",
      "category": "Kaffee & Tee",
      "description": "",
      "name": "Espresso Coretto",
      "price": 3.3
    },
    {
      "id": "michele-205",
      "category": "Kaffee & Tee",
      "description": "",
      "name": "Tasse Kaffee",
      "price": 2.7
    },
    {
      "id": "michele-206",
      "category": "Kaffee & Tee",
      "description": "Kennzeichnungen: B",
      "name": "Cappuccino",
      "price": 3.2
    },
    {
      "id": "michele-207",
      "category": "Kaffee & Tee",
      "description": "Kennzeichnungen: B",
      "name": "Latte Macchiato",
      "price": 3.8
    },
    {
      "id": "michele-390",
      "category": "Aperitifs",
      "description": "Kennzeichnungen: G",
      "name": "Crodino Alkoholfrei",
      "price": 4.6,
      "priceLabel": "1/8 l · 4,60 €"
    },
    {
      "id": "michele-391",
      "category": "Aperitifs",
      "description": "Kennzeichnungen: 1",
      "name": "Campari Soda",
      "price": 4.6,
      "priceLabel": "1/8 l · 4,60 €"
    },
    {
      "id": "michele-392",
      "category": "Aperitifs",
      "description": "Kennzeichnungen: G",
      "name": "Campari Orange",
      "price": 4.9,
      "priceLabel": "5 cl · 4,90 €"
    },
    {
      "id": "michele-393",
      "category": "Aperitifs",
      "description": "Kennzeichnungen: G",
      "name": "Campari Spritz",
      "price": 6.8,
      "priceLabel": "1/8 l · 6,80 €"
    },
    {
      "id": "michele-396",
      "category": "Aperitifs",
      "description": "",
      "name": "Aperol Spritz",
      "price": 7.2,
      "priceLabel": "1/8 l · 7,20 €"
    },
    {
      "id": "michele-397",
      "category": "Aperitifs",
      "description": "",
      "name": "Sarti Spritz",
      "price": 7.2,
      "priceLabel": "1/8 l · 7,20 €"
    },
    {
      "id": "michele-398",
      "category": "Aperitifs",
      "description": "",
      "name": "Limoncello Spritz",
      "price": 6.8,
      "priceLabel": "1/8 l · 6,80 €"
    },
    {
      "id": "michele-395",
      "category": "Aperitifs",
      "description": "",
      "name": "Prosecco",
      "price": 3.9,
      "priceLabel": "1/8 l · 3,90 €"
    },
    {
      "id": "michele-290",
      "category": "Wein",
      "description": "",
      "name": "Primitivo",
      "price": 5.8,
      "priceLabel": "0,25 l · 5,80 €"
    },
    {
      "id": "michele-292",
      "category": "Wein",
      "description": "",
      "name": "Chianti",
      "price": 5.8,
      "priceLabel": "0,25 l · 5,80 €"
    },
    {
      "id": "michele-293",
      "category": "Wein",
      "description": "",
      "name": "Rosé",
      "price": 5.8,
      "priceLabel": "0,25 l · 5,80 €"
    },
    {
      "id": "michele-294",
      "category": "Wein",
      "description": "",
      "name": "Lambrusco",
      "price": 5.4,
      "priceLabel": "0,25 l · 5,40 €"
    },
    {
      "id": "michele-296",
      "category": "Wein",
      "description": "",
      "name": "Pinot Grigio",
      "price": 5.8,
      "priceLabel": "0,25 l · 5,80 €"
    },
    {
      "id": "michele-297",
      "category": "Wein",
      "description": "",
      "name": "Lugana",
      "price": 6.6,
      "priceLabel": "0,25 l · 6,60 €"
    },
    {
      "id": "michele-298",
      "category": "Wein",
      "description": "",
      "name": "Weinschorle",
      "priceLabel": "0,25 l · 4,80 €\n0,4 l · 6,60 €"
    },
    {
      "id": "michele-299",
      "category": "Wein",
      "description": "",
      "name": "Wein",
      "price": 3.2,
      "priceLabel": "1/8 l · 3,20 €"
    },
    {
      "id": "michele-230",
      "category": "Bier vom Fass",
      "description": "",
      "name": "Zirndorfer Landbier",
      "priceLabel": "0,3 l · 3,30 €\n0,5 l · 4,30 €"
    },
    {
      "id": "michele-233",
      "category": "Bier vom Fass",
      "description": "",
      "name": "Helles Hefeweizen",
      "priceLabel": "0,3 l · 3,40 €\n0,5 l · 4,40 €"
    },
    {
      "id": "michele-235",
      "category": "Bier vom Fass",
      "description": "",
      "name": "Lederer Pils",
      "priceLabel": "0,2 l · 2,90 €\n0,4 l · 4,00 €"
    },
    {
      "id": "michele-237",
      "category": "Bier vom Fass",
      "description": "",
      "name": "Radler",
      "price": 4.2,
      "priceLabel": "0,5 l · 4,20 €"
    },
    {
      "id": "michele-238",
      "category": "Bier vom Fass",
      "description": "",
      "name": "Cola Weizen",
      "price": 4.4,
      "priceLabel": "0,5 l · 4,40 €"
    },
    {
      "id": "michele-240",
      "category": "Flaschenbier",
      "description": "",
      "name": "Grüner Bier „Grünerla“",
      "price": 3.3,
      "priceLabel": "0,33 l · 3,30 €"
    },
    {
      "id": "michele-241",
      "category": "Flaschenbier",
      "description": "",
      "name": "Grüner Bier",
      "price": 4.2,
      "priceLabel": "0,5 l · 4,20 €"
    },
    {
      "id": "michele-242",
      "category": "Flaschenbier",
      "description": "",
      "name": "Zirndorfer Keller Bier",
      "price": 4.2,
      "priceLabel": "0,5 l · 4,20 €"
    },
    {
      "id": "michele-243",
      "category": "Flaschenbier",
      "description": "",
      "name": "Reifbräu Alkoholfrei",
      "price": 4.2,
      "priceLabel": "0,5 l · 4,20 €"
    },
    {
      "id": "michele-244",
      "category": "Flaschenbier",
      "description": "",
      "name": "Tucher Leichtes Hefeweizen",
      "price": 4.4,
      "priceLabel": "0,5 l · 4,40 €"
    },
    {
      "id": "michele-245",
      "category": "Flaschenbier",
      "description": "",
      "name": "Tucher Kristallweizen",
      "price": 4.4,
      "priceLabel": "0,5 l · 4,40 €"
    },
    {
      "id": "michele-246",
      "category": "Flaschenbier",
      "description": "",
      "name": "Tucher Alkoholfreies Weizen",
      "price": 4.4,
      "priceLabel": "0,5 l · 4,40 €"
    },
    {
      "id": "michele-247",
      "category": "Flaschenbier",
      "description": "",
      "name": "Grüner Natur Radler Alkoholfrei",
      "price": 4.2,
      "priceLabel": "0,5 l · 4,20 €"
    },
    {
      "id": "michele-211",
      "category": "Alkoholfreies",
      "description": "",
      "name": "Mineralwasser",
      "priceLabel": "0,2 l · 2,40 €\n0,4 l · 3,90 €"
    },
    {
      "id": "michele-213",
      "category": "Alkoholfreies",
      "description": "",
      "name": "Pepsi Cola",
      "price": 2.9,
      "priceLabel": "0,2 l · 2,90 €"
    },
    {
      "id": "michele-214",
      "category": "Alkoholfreies",
      "description": "",
      "name": "Mirinda",
      "price": 2.8,
      "priceLabel": "0,2 l · 2,80 €"
    },
    {
      "id": "michele-215",
      "category": "Alkoholfreies",
      "description": "",
      "name": "Sprite",
      "price": 2.9,
      "priceLabel": "0,2 l · 2,90 €"
    },
    {
      "id": "michele-216",
      "category": "Alkoholfreies",
      "description": "",
      "name": "Spezi",
      "price": 4.4,
      "priceLabel": "0,4 l · 4,40 €"
    },
    {
      "id": "michele-217",
      "category": "Alkoholfreies",
      "description": "",
      "name": "Bitter Lemon",
      "price": 2.9,
      "priceLabel": "0,2 l · 2,90 €"
    },
    {
      "id": "michele-218",
      "category": "Alkoholfreies",
      "description": "",
      "name": "San Pellegrino",
      "priceLabel": "0,2 l · 2,90 €\n0,75 l · 6,20 €"
    },
    {
      "id": "michele-220",
      "category": "Alkoholfreies",
      "description": "",
      "name": "Acqua Panna",
      "priceLabel": "0,2 l · 2,90 €\n0,75 l · 6,20 €"
    },
    {
      "id": "michele-222",
      "category": "Säfte",
      "description": "",
      "name": "Birne",
      "price": 2.9,
      "priceLabel": "0,2 l · 2,90 €"
    },
    {
      "id": "michele-223",
      "category": "Säfte",
      "description": "",
      "name": "Pfirsich",
      "price": 2.9,
      "priceLabel": "0,2 l · 2,90 €"
    },
    {
      "id": "michele-224",
      "category": "Säfte",
      "description": "",
      "name": "Maracuja",
      "price": 2.9,
      "priceLabel": "0,2 l · 2,90 €"
    },
    {
      "id": "michele-225",
      "category": "Säfte",
      "description": "",
      "name": "Johannisbeere",
      "price": 2.9,
      "priceLabel": "0,2 l · 2,90 €"
    },
    {
      "id": "michele-226",
      "category": "Säfte",
      "description": "",
      "name": "Orange",
      "price": 2.9,
      "priceLabel": "0,2 l · 2,90 €"
    },
    {
      "id": "michele-227",
      "category": "Säfte",
      "description": "",
      "name": "Apfel",
      "price": 2.9,
      "priceLabel": "0,2 l · 2,90 €"
    },
    {
      "id": "michele-228",
      "category": "Säfte",
      "description": "",
      "name": "Schorle",
      "priceLabel": "0,2 l · 2,80 €\n0,4 l · 4,40 €"
    },
    {
      "id": "michele-371",
      "category": "Spirituosen",
      "description": "",
      "name": "Ramazzotti",
      "price": 3.9,
      "priceLabel": "2 cl · 3,90 €"
    },
    {
      "id": "michele-372",
      "category": "Spirituosen",
      "description": "",
      "name": "Averna",
      "price": 3.9,
      "priceLabel": "2 cl · 3,90 €"
    },
    {
      "id": "michele-373",
      "category": "Spirituosen",
      "description": "",
      "name": "Fernet Branca",
      "price": 3.9,
      "priceLabel": "2 cl · 3,90 €"
    },
    {
      "id": "michele-374",
      "category": "Spirituosen",
      "description": "",
      "name": "Sambuca Molinari",
      "price": 3.9,
      "priceLabel": "2 cl · 3,90 €"
    },
    {
      "id": "michele-375",
      "category": "Spirituosen",
      "description": "",
      "name": "Amaretto",
      "price": 3.2,
      "priceLabel": "2 cl · 3,20 €"
    },
    {
      "id": "michele-376",
      "category": "Spirituosen",
      "description": "",
      "name": "Williamsbirne",
      "price": 3.9,
      "priceLabel": "2 cl · 3,90 €"
    },
    {
      "id": "michele-377",
      "category": "Spirituosen",
      "description": "",
      "name": "Grappa Riserva",
      "price": 3.9,
      "priceLabel": "2 cl · 3,90 €"
    },
    {
      "id": "michele-378",
      "category": "Spirituosen",
      "description": "",
      "name": "Grappa di Otto Lune",
      "price": 6.4,
      "priceLabel": "2 cl · 6,40 €"
    },
    {
      "id": "michele-380",
      "category": "Spirituosen",
      "description": "",
      "name": "Limoncello",
      "price": 3.2,
      "priceLabel": "2 cl · 3,20 €"
    },
    {
      "id": "michele-381",
      "category": "Spirituosen",
      "description": "",
      "name": "Haselnuss",
      "price": 3.9,
      "priceLabel": "2 cl · 3,90 €"
    },
    {
      "id": "michele-382",
      "category": "Spirituosen",
      "description": "",
      "name": "Amaro Montenegro",
      "price": 3.9,
      "priceLabel": "2 cl · 3,90 €"
    }
  ],
  "menuNotes": "Täglich wechselnde, frische und saisonale Gerichte finden Sie auf unserer Tagestafel.\nPasta und Pizza auf Wunsch glutenfrei: Aufschlag 1,50 €.\nFlaschenweine auf Anfrage.\n\nKennzeichnungen laut Originalkarte\nZusatzstoffe: 1 mit Farbstoff · 2 koffeinhaltig · 3 mit Konservierungsstoffen · 4 chininhaltig · 5 geschwärzt · 6 Vorderschinken · 7 mit Antioxidationsmittel.\nAllergene: A1 Weizen · A2 Roggen · A3 Gerste · B Milch · C Eier · D Fisch · E Sellerie · F Krebstiere · G Sulfite.\nWeitere Kennzeichnungen sind unverändert aus der Originalkarte übernommen.",
  "menuDocumentUrl": "/media/menus/osteria-da-michele.pdf",
  "offeringsTitle": "Unsere Speisekarte",
  "offeringsIntro": "Italienische Küche – von Antipasti und Pizza bis zu Pasta, Dolci und einem Glas Wein."
}$menu$::jsonb;
begin
  select id, public_profile into strict target
  from public.companies
  where id = 'b8a5f4c6-dee5-4fcb-ac52-8429b8eb1575'
    and slug = 'osteria-da-michele'
    and lower(trim(name)) = 'osteria da michele'
    and service_type = 'restaurant'
  for update;

  if coalesce(target.public_profile->'menu', '[]'::jsonb) <> '[]'::jsonb
    and target.public_profile->'menu' <> menu_data->'menu' then
    raise exception 'The company already has a different menu. Review it before replacing it.';
  end if;

  update public.companies
  set public_profile = coalesce(public_profile, '{}'::jsonb) || menu_data
  where id = target.id;
end;
$import$;
commit;

select slug, jsonb_array_length(public_profile->'menu') as menu_items
from public.companies
where id = 'b8a5f4c6-dee5-4fcb-ac52-8429b8eb1575';
