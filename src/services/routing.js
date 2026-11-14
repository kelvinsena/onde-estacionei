/**
 * Busca a rota a pé entre dois pontos usando o roteador público do OpenStreetMap
 * (sem chave de API). Se a requisição falhar, devolve uma linha reta entre os
 * pontos, para o app continuar funcionando offline.
 */
export async function fetchWalkingRoute(from, to) {
  const fallback = [
    { latitude: from.latitude, longitude: from.longitude },
    { latitude: to.latitude, longitude: to.longitude },
  ];

  try {
    const url =
      'https://routing.openstreetmap.de/routed-foot/route/v1/foot/' +
      `${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
      '?overview=full&geometries=geojson';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    const json = await response.json();
    const coords = json?.routes?.[0]?.geometry?.coordinates;
    if (!coords || coords.length < 2) return fallback;

    return coords.map(([longitude, latitude]) => ({ latitude, longitude }));
  } catch {
    return fallback;
  }
}
