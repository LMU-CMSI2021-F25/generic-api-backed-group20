// src/api.js
const JSON_HEADERS = { Accept: "application/geo+json" };

// Geocode a city/ZIP -> {lat, lon, label}
export async function geocodePlace(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1`;
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

async function getPoint(lat, lon) {
  const res = await fetch(`https://api.weather.gov/points/${lat},${lon}`, { headers: JSON_HEADERS });
  if (!res.ok) throw new Error(`NWS /points error (${res.status})`);
  const data = await res.json();
  const stationsUrl = data?.properties?.observationStations;
  if (!stationsUrl) throw new Error("No observationStations for that point.");
  const rel = data?.properties?.relativeLocation?.properties;
  const prettyLabel = rel ? `${rel.city}, ${rel.state}` : `Lat ${lat.toFixed(3)}, Lon ${lon.toFixed(3)}`;
  return { stationsUrl, prettyLabel };
}

async function getNearestStationId(stationsUrl) {
  const res = await fetch(stationsUrl, { headers: JSON_HEADERS });
  if (!res.ok) throw new Error(`NWS stations error (${res.status})`);
  const data = await res.json();
  const id = data?.features?.[0]?.properties?.stationIdentifier;
  if (!id) throw new Error("No nearby station found.");
  return id;
}

async function getLatestObservationByStation(stationId) {
  const res = await fetch(
    `https://api.weather.gov/stations/${stationId}/observations/latest`,
    { headers: JSON_HEADERS }
  );
  if (!res.ok) throw new Error(`NWS latest observation error (${res.status})`);
  const data = await res.json();
  return data?.properties ?? null;
}

export async function getCurrentConditions(lat, lon, labelOverride) {
  const { stationsUrl, prettyLabel } = await getPoint(lat, lon);
  const stationId = await getNearestStationId(stationsUrl);
  const obs = await getLatestObservationByStation(stationId);
  return { label: labelOverride || prettyLabel, obs };
}
