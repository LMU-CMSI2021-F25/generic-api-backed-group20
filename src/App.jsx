import { useState } from "react";
import "./App.css";
import { geocodePlace, getCurrentConditions } from "./api";


export default function App() {
  const [q, setQ] = useState("");
  const [out, setOut] = useState("Type a city (e.g., Seattle) or latitude,longitude (e.g., 34.05,-118.25).");

  function parseLatLon(text) {
    const m = text.trim().match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    return m ? { lat: parseFloat(m[1]), lon: parseFloat(m[2]) } : null;
  }
 
  async function getWeather(e) {
    e.preventDefault();
    setOut("Loading…");
    try {
      // 1) Resolve input to lat/lon
      let lat, lon, label;
      const ll = parseLatLon(q);
      if (ll) {
        ({ lat, lon } = ll);
        label = `Lat ${lat.toFixed(3)}, Lon ${lon.toFixed(3)}`;
      } else {
        const g = await geocodePlace(q);
        lat = g.lat; lon = g.lon; label = g.label;
      }

      // 2) Use API module to get current conditions
      const { label: pretty, obs } = await getCurrentConditions(lat, lon, label);
      if (!obs) throw new Error("No observation data");

      // tiny format helpers
      const num = (x) => (x && typeof x.value === "number" ? x.value : null);
      const c2f = (c) => (c == null ? null : Math.round((c * 9) / 5 + 32));
      const temp = c2f(num(obs.temperature));
      const feels = c2f(num(obs.apparentTemperature));
      const rh = num(obs.relativeHumidity);
      const windMps = num(obs.windSpeed);
      const windMph = windMps == null ? "—" : Math.round(windMps * 2.23694) + " mph";

      setOut(
        `${pretty}\n` +
        `Now: ${obs.textDescription || "—"}\n` +
        `Temp: ${temp == null ? "—" : temp + "°F"} · Feels like: ${feels == null ? "—" : feels + "°F"}\n` +
        `Humidity: ${rh == null ? "—" : Math.round(rh) + "%"} · Wind: ${windMph}\n` +
        `Updated: ${obs.timestamp ? new Date(obs.timestamp).toLocaleString() : "—"}`
      );
    } catch (err) {
      setOut(`Error: ${err.message || String(err)}`);
    }
  }

  return (
    <div className="card">
      <h1>Current Weather (NWS)</h1>
      <img src="/weather.png" alt="Weather icon" width="120" height="120" />
      <form onSubmit={getWeather}>
        <input
          type="text"
          placeholder='City or "latitude,longitude"'
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