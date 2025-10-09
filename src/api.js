// src/api.js
const JSON_HEADERS = { Accept: "application/geo+json" };

/** Geocode a city/ZIP -> { lat, lon, label } */
export async function geocodePlace(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    name
  )}&count=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const data = await res.json();
  if (!data.results?.length) throw new Error("Place not found");
  const r = data.results[0];
  return {
    lat: r.latitude,
    lon: r.longitude,
    label: [r.name, r.admin1, r.country_code].filter(Boolean).join(", "),
  };
}

/** NWS points lookup -> stations URL + nice label */
async function getPoint(lat, lon) {
  const res = await fetch(`https://api.weather.gov/points/${lat},${lon}`, {
    headers: JSON_HEADERS,
  });
  if (!res.ok) throw new Error(`NWS /points error (${res.status})`);
  const data = await res.json();
  const stationsUrl = data?.properties?.observationStations;
  if (!stationsUrl) throw new Error("No observationStations for that point.");
  const rel = data?.properties?.relativeLocation?.properties;
  const prettyLabel =
    rel ? `${rel.city}, ${rel.state}` : `Lat ${lat.toFixed(3)}, Lon ${lon.toFixed(3)}`;
  return { stationsUrl, prettyLabel };
}

/** Get an array of nearby station IDs (first N) */
async function listNearbyStationIds(stationsUrl, take = 6) {
  const res = await fetch(stationsUrl, { headers: JSON_HEADERS });
  if (!res.ok) throw new Error(`NWS stations error (${res.status})`);
  const data = await res.json();
  return (data?.features || [])
    .slice(0, take)
    .map((f) => f?.properties?.stationIdentifier)
    .filter(Boolean);
}

/** Decide if an observation has usable data */
function hasUsable(obs) {
  const v = (x) => x && typeof x.value === "number";
  // "Usable" if at least one of these is present
  return obs && (v(obs.temperature) || v(obs.windSpeed) || v(obs.relativeHumidity));
}

/** Try latest, then recent observations for first usable one */
async function getLatestUsableObservation(stationId) {
  // 1) latest
  let r = await fetch(
    `https://api.weather.gov/stations/${stationId}/observations/latest`,
    { headers: JSON_HEADERS }
  );
  if (r.ok) {
    const latest = await r.json();
    if (hasUsable(latest?.properties)) return latest.properties;
  }
  // 2) recent list
  r = await fetch(
    `https://api.weather.gov/stations/${stationId}/observations?limit=8`,
    { headers: JSON_HEADERS }
  );
  if (!r.ok) return null;
  const coll = await r.json();
  const item = (coll?.features || [])
    .map((f) => f?.properties)
    .find(hasUsable);
  return item || null;
}

/** Public: get current conditions with fallback across nearby stations */
export async function getCurrentConditions(lat, lon, labelOverride) {
  const { stationsUrl, prettyLabel } = await getPoint(lat, lon);
  const stationIds = await listNearbyStationIds(stationsUrl, 8);
  for (const id of stationIds) {
    const obs = await getLatestUsableObservation(id);
    if (obs) return { label: labelOverride || prettyLabel, obs, stationId: id };
  }
  // none usable
  return { label: labelOverride || prettyLabel, obs: null, stationId: null };
}
