import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@ondeestacionei:vehicle';

/**
 * Formato do registro salvo:
 * {
 *   latitude, longitude,
 *   savedAt,            // timestamp (ms)
 *   expiresAt,          // timestamp (ms) ou null (sem parquímetro)
 *   note,               // texto livre (andar, número da vaga...)
 *   altitude, pressure, // do barômetro (ou null)
 *   notificationIds,    // ids das notificações agendadas
 *   lastDistance        // última distância conhecida (m), usada pelo widget
 * }
 */

export async function loadParking() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveParking(data) {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}

export async function updateParking(patch) {
  const current = await loadParking();
  if (!current) return null;
  const next = { ...current, ...patch };
  await saveParking(next);
  return next;
}

export async function clearParking() {
  await AsyncStorage.removeItem(KEY);
}
