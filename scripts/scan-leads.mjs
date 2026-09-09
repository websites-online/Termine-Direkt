import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dryRun = process.env.DRY_RUN === 'true';
if (!dryRun && (!supabaseUrl || !serviceRoleKey)) {
  throw new Error('SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein.');
}

const supabase = dryRun
  ? null
  : createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
const maxNewLeads = Math.min(Math.max(Number(process.env.MAX_NEW_LEADS || 75), 1), 200);
const maxPerRegion = Math.min(Math.max(Number(process.env.MAX_PER_REGION || 25), 1), 60);
const maxChecked = Math.min(Math.max(Number(process.env.MAX_CHECKED || 240), 10), 500);
const forcedRegion = String(process.env.SCAN_REGION || '')
  .trim()
  .toLocaleLowerCase('de');
const userAgent = 'NexTimeLeadResearch/1.0 (+https://nextime-booking.de/impressum)';
const overpassEndpoints = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

// Nach Entfernung zu Nürnberg priorisiert. Überlappende OSM-Treffer werden dedupliziert.
const regions = [
  { name: 'Nürnberg', lat: 49.4521, lon: 11.0767, radius: 7000 },
  { name: 'Fürth', lat: 49.4771, lon: 10.9887, radius: 5000 },
  { name: 'Stein', lat: 49.4156, lon: 11.015, radius: 4000 },
  { name: 'Zirndorf', lat: 49.4424, lon: 10.9541, radius: 4500 },
  { name: 'Schwabach', lat: 49.3297, lon: 11.0207, radius: 5500 },
  { name: 'Erlangen', lat: 49.5897, lon: 11.0119, radius: 6500 },
  { name: 'Lauf an der Pegnitz', lat: 49.513, lon: 11.2825, radius: 5000 },
  { name: 'Herzogenaurach', lat: 49.568, lon: 10.8828, radius: 5000 },
  { name: 'Roth', lat: 49.2457, lon: 11.0911, radius: 5000 },
  { name: 'Forchheim', lat: 49.7175, lon: 11.0588, radius: 5500 },
  { name: 'Neumarkt in der Oberpfalz', lat: 49.2803, lon: 11.4628, radius: 6000 },
  { name: 'Ansbach', lat: 49.3004, lon: 10.5719, radius: 6000 },
  { name: 'Bamberg', lat: 49.8988, lon: 10.9028, radius: 6500 },
];

const selectedRegions = forcedRegion
  ? regions.filter((region) => region.name.toLocaleLowerCase('de').includes(forcedRegion))
  : regions;
if (selectedRegions.length === 0) {
  throw new Error(`Unbekannte Region: ${process.env.SCAN_REGION}`);
}

const bookingProviders = [
  ['Treatwell', /treatwell\.(?:de|com)/i],
  ['Planity', /planity\.(?:com|de)/i],
  ['Booksy', /booksy\.(?:com|de)/i],
  ['Salonkee', /salonkee\./i],
  ['Shore', /shore\.com/i],
  ['Studiobookr', /studiobookr\.com/i],
  ['SimplyBook', /simplybook\.(?:me|it)/i],
  ['eTermin', /etermin\.net/i],
  ['Calendly', /calendly\.com/i],
  ['OpenTable', /opentable\.(?:de|com)/i],
  ['Quandoo', /quandoo\.(?:de|com)/i],
  ['TheFork', /thefork\.(?:de|com)/i],
  ['Resmio', /resmio\.(?:com|de)/i],
  ['Dish', /dish\.co/i],
  ['Zenchef', /zenchef\.(?:com|de)/i],
  ['Google Reserve', /reserve\.withgoogle\.com/i],
];

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const normalizeUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const hostname = url.hostname.toLowerCase();
    const blocked =
      hostname === 'localhost' ||
      hostname.endsWith('.local') ||
      /^(?:127\.|10\.|192\.168\.|169\.254\.)/.test(hostname) ||
      /^172\.(?:1[6-9]|2\d|3[01])\./.test(hostname);
    return blocked || !['http:', 'https:'].includes(url.protocol) ? '' : url.toString();
  } catch {
    return '';
  }
};

const cleanText = (value) =>
  String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();

const firstValue = (...values) => values.map(cleanText).find(Boolean) || '';

const fetchText = async (url, timeout = 10_000) => {
  const response = await fetch(url, {
    headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': userAgent },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/') && !type.includes('application/xhtml')) return '';
  return (await response.text()).slice(0, 1_000_000);
};

const robotsCache = new Map();
const isPathAllowed = async (url) => {
  const parsed = new URL(url);
  if (!robotsCache.has(parsed.origin)) {
    try {
      const robots = await fetchText(`${parsed.origin}/robots.txt`, 5000);
      const rules = [];
      let applies = false;
      for (const rawLine of robots.split(/\r?\n/)) {
        const line = rawLine.replace(/#.*$/, '').trim();
        const [field, ...rest] = line.split(':');
        const value = rest.join(':').trim();
        if (field?.toLowerCase() === 'user-agent') applies = value === '*';
        if (applies && field?.toLowerCase() === 'disallow' && value) rules.push(value);
      }
      robotsCache.set(parsed.origin, rules);
    } catch {
      robotsCache.set(parsed.origin, []);
    }
  }
  return !(robotsCache.get(parsed.origin) || []).some((path) => parsed.pathname.startsWith(path));
};

const extractLinks = (html, baseUrl) => {
  const links = [];
  for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    try {
      links.push(new URL(match[1], baseUrl).toString());
    } catch {
      // Ungültige Links werden ignoriert.
    }
  }
  return Array.from(new Set(links));
};

const extractEmail = (html) => {
  const mailto = html.match(/mailto:([^?"'\s>]+)/i)?.[1];
  const candidates = [mailto, ...(html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])]
    .map((value) => cleanText(value).toLowerCase())
    .filter(
      (value) =>
        value &&
        !value.includes('example.') &&
        !value.includes('sentry.') &&
        !/\.(?:png|jpe?g|gif|webp|svg)$/i.test(value),
    );
  return candidates[0] || '';
};

const extractPhone = (html) => {
  const value = html.match(/href\s*=\s*["']tel:([^"']+)/i)?.[1];
  return value ? cleanText(decodeURIComponent(value)).replace(/^\+49\s?/, '+49 ') : '';
};

const inspectBookingSystem = (html, links) => {
  const haystack = `${html}\n${links.join('\n')}`;
  for (const [name, pattern] of bookingProviders) {
    if (pattern.test(haystack)) {
      return { found: true, name, evidence: `Link oder Einbindung von ${name} erkannt.` };
    }
  }
  const bookingLink = links.find((link) =>
    /(?:online[-_/]?(?:booking|buchung|termin|reserv)|(?:book|booking|buchen|reservieren|termin-buchen))/i.test(
      link,
    ),
  );
  if (bookingLink) {
    return {
      found: true,
      name: 'Eigenes Online-Buchungssystem',
      evidence: `Buchungslink erkannt: ${bookingLink.slice(0, 220)}`,
    };
  }
  if (
    /(?:termin|tisch|platz)\s+(?:online\s+)?(?:buchen|reservieren)/i.test(haystack) &&
    /<(?:form|iframe)[\s>]/i.test(html)
  ) {
    return {
      found: true,
      name: 'Eingebettetes Buchungsformular',
      evidence: 'Online-Buchungstext zusammen mit einem Formular oder iFrame erkannt.',
    };
  }
  return {
    found: false,
    name: '',
    evidence: 'Auf den geprüften Seiten wurde kein Online-Buchungssystem erkannt.',
  };
};

const inspectWebsite = async (website) => {
  const normalized = normalizeUrl(website);
  if (!normalized) {
    return {
      website: '',
      email: '',
      phone: '',
      contactUrl: '',
      pagesChecked: 0,
      booking: {
        found: false,
        name: '',
        evidence: 'Keine Website angegeben; manuelle Prüfung empfohlen.',
      },
      confidence: 52,
    };
  }

  try {
    if (!(await isPathAllowed(normalized))) {
      return {
        website: normalized,
        email: '',
        phone: '',
        contactUrl: '',
        pagesChecked: 0,
        booking: { found: false, name: '', evidence: 'Website schließt automatisches Prüfen aus.' },
        confidence: 30,
      };
    }
    const homeHtml = await fetchText(normalized);
    const homeUrl = normalized;
    const homeLinks = extractLinks(homeHtml, homeUrl);
    const origin = new URL(homeUrl).origin;
    const detailLinks = homeLinks
      .filter((link) => {
        try {
          const parsed = new URL(link);
          return (
            parsed.origin === origin &&
            /(?:kontakt|contact|impressum|termin|reserv|buch|booking)/i.test(parsed.pathname)
          );
        } catch {
          return false;
        }
      })
      .slice(0, 3);
    const pages = [{ url: homeUrl, html: homeHtml }];
    for (const link of detailLinks) {
      try {
        if (await isPathAllowed(link)) pages.push({ url: link, html: await fetchText(link, 8000) });
      } catch {
        // Einzelne Unterseiten dürfen ausfallen.
      }
    }
    const combinedHtml = pages.map((page) => page.html).join('\n');
    const combinedLinks = pages.flatMap((page) => extractLinks(page.html, page.url));
    const contactUrl =
      pages.find((page) => /(?:kontakt|contact|impressum)/i.test(page.url))?.url || '';
    return {
      website: homeUrl,
      email: extractEmail(combinedHtml),
      phone: extractPhone(combinedHtml),
      contactUrl,
      pagesChecked: pages.length,
      booking: inspectBookingSystem(combinedHtml, combinedLinks),
      confidence: pages.length >= 2 ? 88 : 78,
    };
  } catch (error) {
    return {
      website: normalized,
      email: '',
      phone: '',
      contactUrl: '',
      pagesChecked: 0,
      booking: {
        found: false,
        name: '',
        evidence: `Website konnte nicht vollständig geprüft werden (${String(error?.message || error).slice(0, 100)}).`,
      },
      confidence: 35,
    };
  }
};

const fetchPlaces = async (region) => {
  const query = `[out:json][timeout:50];(
    nwr["amenity"="restaurant"](around:${region.radius},${region.lat},${region.lon});
    nwr["shop"="hairdresser"](around:${region.radius},${region.lat},${region.lon});
  );out center tags;`;
  let lastError;
  for (const endpoint of overpassEndpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': userAgent,
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(70_000),
      });
      if (!response.ok) throw new Error(`Overpass HTTP ${response.status}`);
      const payload = await response.json();
      return Array.isArray(payload.elements) ? payload.elements : [];
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Overpass konnte nicht erreicht werden.');
};

const loadExistingLeads = async () => {
  if (dryRun) return new Map();
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('sales_leads')
      .select('source_key,status,notes,discovered_at,last_scanned_at,contacted_at')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < 1000) break;
    from += 1000;
  }
  return new Map(rows.map((row) => [row.source_key, row]));
};

const getAddress = (tags) => {
  const street = firstValue(tags['addr:street']);
  const number = firstValue(tags['addr:housenumber']);
  const place = firstValue(tags['addr:city'], tags['addr:place']);
  return [street && `${street}${number ? ` ${number}` : ''}`, place].filter(Boolean).join(', ');
};

const processPlace = async (element, region, existing) => {
  const tags = element.tags || {};
  const sourceKey = `osm:${element.type}:${element.id}`;
  const category = tags.shop === 'hairdresser' ? 'friseur' : 'restaurant';
  const website = firstValue(tags.website, tags['contact:website'], tags.url);
  const inspection = await inspectWebsite(website);
  const email = firstValue(tags.email, tags['contact:email'], inspection.email);
  const phone = firstValue(tags.phone, tags['contact:phone'], inspection.phone);
  const contactUrl = firstValue(inspection.contactUrl);
  const hasContact = Boolean(email || phone || contactUrl);
  const shouldExclude = inspection.booking.found || !hasContact;
  const now = new Date().toISOString();
  return {
    source_key: sourceKey,
    source_type: 'openstreetmap',
    source_id: `${element.type}/${element.id}`,
    name: cleanText(tags.name),
    category,
    city: firstValue(tags['addr:city'], tags['addr:place'], region.name),
    postcode: firstValue(tags['addr:postcode']) || null,
    address: getAddress(tags) || null,
    website: inspection.website || normalizeUrl(website) || null,
    phone: phone || null,
    email: email || null,
    contact_url: contactUrl || null,
    source_url: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    scan_region: region.name,
    has_booking_system: inspection.booking.found,
    booking_system: inspection.booking.name || null,
    booking_evidence: hasContact
      ? inspection.booking.evidence
      : `${inspection.booking.evidence} Keine öffentliche Kontaktmöglichkeit gefunden.`,
    confidence: inspection.confidence,
    status: shouldExclude ? 'excluded' : existing?.status || 'new',
    notes: existing?.notes || null,
    discovered_at: existing?.discovered_at || now,
    last_scanned_at: now,
    contacted_at: existing?.contacted_at || null,
    updated_at: now,
  };
};

const existingLeads = await loadExistingLeads();
const seenThisRun = new Set();
let newLeadCount = 0;
let checkedCount = 0;
let excludedCount = 0;

for (const region of selectedRegions) {
  if (newLeadCount >= maxNewLeads || checkedCount >= maxChecked) break;
  console.log(`Prüfe ${region.name} …`);
  const places = (await fetchPlaces(region))
    .filter((element) => cleanText(element.tags?.name))
    .filter((element) => {
      const key = `osm:${element.type}:${element.id}`;
      if (seenThisRun.has(key)) return false;
      seenThisRun.add(key);
      const existing = existingLeads.get(key);
      if (!existing?.last_scanned_at) return true;
      return Date.now() - new Date(existing.last_scanned_at).getTime() > 90 * 86_400_000;
    })
    .slice(0, 100);

  let newInRegion = 0;
  for (let index = 0; index < places.length; index += 4) {
    if (newLeadCount >= maxNewLeads || newInRegion >= maxPerRegion || checkedCount >= maxChecked)
      break;
    const batch = places.slice(index, index + 4);
    const records = await Promise.all(
      batch.map((place) => {
        const key = `osm:${place.type}:${place.id}`;
        return processPlace(place, region, existingLeads.get(key));
      }),
    );
    for (const record of records) {
      const wasKnown = existingLeads.has(record.source_key);
      if (!dryRun) {
        const { error } = await supabase
          .from('sales_leads')
          .upsert(record, { onConflict: 'source_key' });
        if (error) throw error;
      }
      checkedCount += 1;
      if (record.status === 'new' && !wasKnown) {
        newLeadCount += 1;
        newInRegion += 1;
        console.log(
          `  + ${record.name} · ${record.email || 'keine E-Mail'} · ${record.phone || 'kein Telefon'} · ${record.confidence}%`,
        );
      } else if (record.status === 'excluded') {
        excludedCount += 1;
      }
      existingLeads.set(record.source_key, record);
    }
    await pause(350);
  }
  console.log(`${region.name}: ${newInRegion} neue Leads.`);
}

console.log(
  JSON.stringify(
    {
      regions: selectedRegions.map((region) => region.name),
      checked: checkedCount,
      newLeads: newLeadCount,
      excluded: excludedCount,
    },
    null,
    2,
  ),
);
