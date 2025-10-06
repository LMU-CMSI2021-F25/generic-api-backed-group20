import { useState } from "react";
import "./App.css";

export default function App() {
  const [q, setQ] = useState("");
  const [out, setOut] = useState("Type a city (e.g., Seattle) or lat,lon (e.g., 34.05,-118.25).");

  async function getWeather(e) {
    e.preventDefault();
    setOut("Loading…");

    try {
      // 0) turn input into lat/lon (accepts "lat,lon" or a city/ZIP via simple geocoder)
      let lat, lon, label;
      const m = q.trim().match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
      if (m) {
        lat = parseFloat(m[1]); lon = parseFloat(m[2]); label = `Lat ${lat.toFixed(3)}, Lon ${lon.toFixed(3)}`;
      } else {
        const g = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1`
        ).then(r => r.json());
        if (!g.results || g.results.length === 0) throw new Error("Place not found");
        lat = g.results[0].latitude; lon = g.results[0].longitude;
        label = [g.results[0].name, g.results[0].admin1, g.results[0].country_code].filter(Boolean).join(", ");
      }

      // required by weather.gov
      const HEADERS = {
        "User-Agent": "dougspaeth-weather-demo (doug@example.com)",
        Accept: "application/geo+json",
      };

      // 1) get NWS point info (to discover nearby stations and a nice city/state)
      const p = await fetch(`https://api.weather.gov/points/${lat},${lon}`, { headers: HEADERS }).then(r => r.json());
      const rel = p?.properties?.relativeLocation?.properties;
      if (rel) label = `${rel.city}, ${rel.state}`;
      const stationsUrl = p?.properties?.observationStations;
      if (!stationsUrl) throw new Error("No stations for that point");

      // 2) pick the nearest station
      const s = await fetch(stationsUrl, { headers: HEADERS }).then(r => r.json());
      const stationId = s?.features?.[0]?.properties?.stationIdentifier;
      if (!stationId) throw new Error("No nearby station found");

      // 3) fetch latest observation (current conditions)
      const obs = await fetch(
        `https://api.weather.gov/stations/${stationId}/observations/latest`,
        { headers: HEADERS }
      ).then(r => r.json());

      const o = obs?.properties;
      if (!o) throw new Error("No observation data");

      // tiny format helpers
      const num = (x) => (x && typeof x.value === "number" ? x.value : null);
      const tempC = num(o.temperature);
      const tempF = tempC == null ? "—" : Math.round((tempC * 9) / 5 + 32) + "°F";
      const feelsC = num(o.apparentTemperature);
      const feelsF = feelsC == null ? "—" : Math.round((feelsC * 9) / 5 + 32) + "°F";
      const rh = num(o.relativeHumidity);
      const windMps = num(o.windSpeed);
      const windMph = windMps == null ? "—" : Math.round(windMps * 2.23694) + " mph";
      const desc = o.textDescription || "—";
      const when = o.timestamp ? new Date(o.timestamp).toLocaleString() : "—";

      setOut(
        `${label}\n` +
        `Now: ${desc}\n` +
        `Temp: ${tempF} · Feels like: ${feelsF}\n` +
        `Humidity: ${rh == null ? "—" : Math.round(rh) + "%"} · Wind: ${windMph}\n` +
        `Updated: ${when}`
      );
    } catch (err) {
      setOut(`Error: ${err.message || String(err)}`);
    }
  }

  return (
    <div className="card">
      <h1>Current Weather (NWS)</h1>
      <form onSubmit={getWeather}>
        <input
          type="text"
          placeholder='City or "lat,lon"'
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Location"
        />
        <div className="btnrow">
          <button type="submit">Get Weather</button>
        </div>
      </form>
      <pre style={{ whiteSpace: "pre-wrap", marginTop: "0.75rem" }}>{out}</pre>
    </div>
  );
}
