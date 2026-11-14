const EARTH_RADIUS_M = 6371000;

const toRad = (deg) => (deg * Math.PI) / 180;
const pad = (n) => String(n).padStart(2, '0');

/** Distância em metros entre duas coordenadas (fórmula de Haversine). */
export function haversine(a, b) {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** 85 -> "85 m" | 1530 -> "1.5 km" */
export function formatDistance(meters) {
  if (meters == null || Number.isNaN(meters)) return '--';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** Milissegundos restantes -> "1h 05min" ou "09:42". */
export function formatRemaining(ms) {
  if (ms == null) return '--';
  if (ms <= 0) return 'Expirado';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${pad(m)}min`;
  return `${pad(m)}:${pad(s)}`;
}

/** Timestamp -> "15:30" (manual, para funcionar também no contexto do widget). */
export function formatClock(timestamp) {
  const d = new Date(timestamp);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Altitude aproximada (m) a partir da pressão (hPa), pela fórmula barométrica
 * padrão. É uma estimativa: varia com o clima do dia.
 */
export function pressureToAltitude(hPa, seaLevelHPa = 1013.25) {
  return 44330 * (1 - Math.pow(hPa / seaLevelHPa, 1 / 5.255));
}
