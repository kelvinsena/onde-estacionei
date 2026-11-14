import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';

import { useBarometer } from '../hooks/useBarometer';
import { useCountdown } from '../hooks/useCountdown';
import { cancelAlerts, scheduleParkingAlerts, setupNotifications } from '../services/notifications';
import { fetchWalkingRoute } from '../services/routing';
import { clearParking, loadParking, saveParking, updateParking } from '../services/storage';
import {
  formatClock,
  formatDistance,
  formatRemaining,
  haversine,
  pressureToAltitude,
} from '../utils/geo';
import { refreshWidget } from '../widget/updateWidget';

const DURATIONS = [
  { label: 'Sem tempo', minutes: null },
  { label: '30 min', minutes: 30 },
  { label: '1 h', minutes: 60 },
  { label: '2 h', minutes: 120 },
];

const DEFAULT_REGION = {
  latitude: -23.5505,
  longitude: -46.6333,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export default function HomeScreen() {
  const mapRef = useRef(null);
  const routeOriginRef = useRef(null);
  const fetchingRouteRef = useRef(false);
  const lastSyncRef = useRef({ time: 0, distance: null });

  const [booting, setBooting] = useState(true);
  const [parking, setParking] = useState(null);
  const [position, setPosition] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [route, setRoute] = useState([]);
  const [saving, setSaving] = useState(false);

  const [selectedDuration, setSelectedDuration] = useState(1);
  const [customMinutes, setCustomMinutes] = useState('');
  const [note, setNote] = useState('');

  const { available: baroAvailable, pressure } = useBarometer();
  const remaining = useCountdown(parking?.expiresAt);

  // ---------- Inicialização: notificações + dados salvos ----------
  useEffect(() => {
    (async () => {
      await setupNotifications();
      const saved = await loadParking();
      setParking(saved);
      setBooting(false);
      refreshWidget();
    })();
  }, []);

  // ---------- Localização em tempo real ----------
  useEffect(() => {
    let active = true;
    let subscription = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!active) return;
      if (status !== 'granted') {
        setPermissionDenied(true);
        return;
      }

      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 5, timeInterval: 3000 },
        (loc) => setPosition(loc.coords)
      );
      if (!active && subscription) subscription.remove();
    })();

    return () => {
      active = false;
      if (subscription) subscription.remove();
    };
  }, []);

  // ---------- Distância até o veículo ----------
  const distance = useMemo(() => {
    if (!parking || !position) return null;
    return haversine(position, parking);
  }, [parking, position]);

  // ---------- Enquadra o mapa ----------
  const fitAll = useCallback(() => {
    if (!mapRef.current) return;
    if (parking && position) {
      mapRef.current.fitToCoordinates(
        [
          { latitude: parking.latitude, longitude: parking.longitude },
          { latitude: position.latitude, longitude: position.longitude },
        ],
        { edgePadding: { top: 80, right: 60, bottom: 80, left: 60 }, animated: true }
      );
    } else if (position) {
      mapRef.current.animateToRegion(
        {
          latitude: position.latitude,
          longitude: position.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        600
      );
    }
  }, [parking, position]);

  useEffect(() => {
    if (!position) return undefined;
    const timer = setTimeout(fitAll, 400);
    return () => clearTimeout(timer);
    // Reenquadra só quando a posição aparece pela 1ª vez ou quando a vaga muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!position, parking?.savedAt]);

  // ---------- Rota a pé (refeita se o usuário se mover > 40 m) ----------
  useEffect(() => {
    if (!parking || !position) return;
    const origin = routeOriginRef.current;
    if (origin && haversine(origin, position) < 40) return;
    if (fetchingRouteRef.current) return;

    fetchingRouteRef.current = true;
    routeOriginRef.current = { latitude: position.latitude, longitude: position.longitude };
    fetchWalkingRoute(position, parking)
      .then(setRoute)
      .finally(() => {
        fetchingRouteRef.current = false;
      });
  }, [parking, position]);

  // ---------- Sincroniza distância com o widget (no máx. a cada 30 s ou 20 m) ----------
  useEffect(() => {
    if (!parking || distance == null) return;
    const last = lastSyncRef.current;
    const recent = Date.now() - last.time < 30000;
    if (last.distance != null && recent && Math.abs(last.distance - distance) < 20) return;

    lastSyncRef.current = { time: Date.now(), distance };
    updateParking({ lastDistance: Math.round(distance) }).then((next) => {
      if (next) refreshWidget();
    });
  }, [distance, parking?.savedAt]);

  // ---------- Ações ----------
  async function handleSave() {
    const custom = customMinutes.trim();
    let minutes = DURATIONS[selectedDuration].minutes;
    if (custom) {
      minutes = parseInt(custom, 10);
      if (Number.isNaN(minutes) || minutes <= 0) {
        Alert.alert('Tempo inválido', 'Digite um número de minutos maior que zero.');
        return;
      }
    }

    if (!position) {
      Alert.alert('Aguarde', 'Ainda não conseguimos sua localização. Verifique o GPS e a permissão.');
      return;
    }

    setSaving(true);
    try {
      // Pega uma leitura mais precisa no momento de gravar a vaga.
      let coords = position;
      try {
        const fresh = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        coords = fresh.coords;
      } catch {
        // usa a última posição conhecida
      }

      const granted = await setupNotifications();
      const now = Date.now();
      const expiresAt = minutes ? now + minutes * 60 * 1000 : null;

      let notificationIds = [];
      if (expiresAt && granted) {
        notificationIds = await scheduleParkingAlerts(expiresAt);
      } else if (expiresAt && !granted) {
        Alert.alert(
          'Notificações desativadas',
          'O tempo será contado, mas você não receberá o aviso. Ative as notificações nas configurações do aparelho.'
        );
      }

      const record = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        savedAt: now,
        expiresAt,
        note: note.trim(),
        altitude: pressure ? Math.round(pressureToAltitude(pressure)) : null,
        pressure: pressure ? Number(pressure.toFixed(1)) : null,
        notificationIds,
        lastDistance: 0,
      };

      await saveParking(record);
      routeOriginRef.current = null;
      lastSyncRef.current = { time: 0, distance: null };
      setRoute([]);
      setParking(record);
      setNote('');
      setCustomMinutes('');
      refreshWidget();
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar a vaga. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  function handleClear() {
    Alert.alert('Já pegou o veículo?', 'A vaga e os alertas do parquímetro serão removidos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sim, remover',
        style: 'destructive',
        onPress: async () => {
          await cancelAlerts(parking?.notificationIds);
          await clearParking();
          routeOriginRef.current = null;
          setRoute([]);
          setParking(null);
          refreshWidget();
        },
      },
    ]);
  }

  // ---------- Render ----------
  if (booting) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  const nearCar = distance != null && distance < 15;
  const warning = remaining != null && remaining > 0 && remaining <= 10 * 60 * 1000;
  const expired = remaining != null && remaining <= 0;
  const timerColor = expired ? '#DC2626' : warning ? '#D97706' : '#16A34A';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" />

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={DEFAULT_REGION}
        showsUserLocation
        showsMyLocationButton
      >
        {parking && (
          <Marker
            coordinate={{ latitude: parking.latitude, longitude: parking.longitude }}
            title="Seu veículo"
            description={parking.note || 'Vaga salva'}
            pinColor="#2563EB"
          />
        )}
        {parking && !nearCar && route.length > 1 && (
          <Polyline coordinates={route} strokeColor="#2563EB" strokeWidth={5} lineDashPattern={[1]} />
        )}
      </MapView>

      <ScrollView
        style={styles.panel}
        contentContainerStyle={styles.panelContent}
        keyboardShouldPersistTaps="handled"
      >
        {permissionDenied && (
          <View style={[styles.card, styles.cardAlert]}>
            <Text style={styles.alertText}>
              Permissão de localização negada. Ative-a nas configurações do aparelho para usar o app.
            </Text>
          </View>
        )}

        {parking ? (
          <>
            <Text style={styles.title}>🚗 Veículo estacionado</Text>

            <View style={styles.card}>
              {parking.expiresAt ? (
                <>
                  <Text style={styles.label}>Tempo restante do parquímetro</Text>
                  <Text style={[styles.timer, { color: timerColor }]}>{formatRemaining(remaining)}</Text>
                  <Text style={styles.muted}>Vence às {formatClock(parking.expiresAt)}</Text>
                </>
              ) : (
                <Text style={styles.label}>Sem controle de tempo (sem parquímetro)</Text>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Distância até o veículo</Text>
              <Text style={styles.distance}>
                {nearCar ? 'Você está ao lado do veículo! 🎉' : formatDistance(distance)}
              </Text>
              {parking.altitude != null && (
                <Text style={styles.muted}>
                  Altitude aprox. na vaga: {parking.altitude} m (pressão {parking.pressure} hPa)
                </Text>
              )}
              {!!parking.note && <Text style={styles.muted}>📝 {parking.note}</Text>}
            </View>

            <TouchableOpacity style={styles.secondaryButton} onPress={fitAll}>
              <Text style={styles.secondaryButtonText}>Ver rota completa no mapa</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dangerButton} onPress={handleClear}>
              <Text style={styles.dangerButtonText}>Já peguei o veículo</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>📍 Guardar vaga</Text>

            <Text style={styles.label}>Tempo do parquímetro / Zona Azul</Text>
            <View style={styles.chips}>
              {DURATIONS.map((d, index) => {
                const active = !customMinutes && selectedDuration === index;
                return (
                  <TouchableOpacity
                    key={d.label}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => {
                      setSelectedDuration(index);
                      setCustomMinutes('');
                    }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{d.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Outro tempo (em minutos)"
              keyboardType="number-pad"
              value={customMinutes}
              onChangeText={setCustomMinutes}
            />

            <View style={styles.card}>
              <Text style={styles.label}>Barômetro</Text>
              {baroAvailable && pressure ? (
                <Text style={styles.muted}>
                  Altitude aprox.: {Math.round(pressureToAltitude(pressure))} m · {pressure.toFixed(1)} hPa
                  {'\n'}Será salva junto com a vaga.
                </Text>
              ) : (
                <Text style={styles.muted}>
                  {baroAvailable
                    ? 'Lendo sensor...'
                    : 'Barômetro indisponível neste aparelho. Use o campo abaixo para anotar o andar.'}
                </Text>
              )}
            </View>

            <TextInput
              style={styles.input}
              placeholder="Andar / observação (ex.: 2º subsolo, vaga 45)"
              value={note}
              onChangeText={setNote}
            />

            <TouchableOpacity
              style={[styles.primaryButton, (saving || !position) && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={saving || !position}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {position ? 'Salvar vaga aqui' : 'Aguardando GPS...'}
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  map: { flex: 1 },
  panel: {
    maxHeight: '55%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  panelContent: { padding: 20, paddingBottom: 32 },
  title: { fontSize: 20, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  label: { fontSize: 13, color: '#475569', marginBottom: 6, fontWeight: '600' },
  muted: { fontSize: 13, color: '#64748B', marginTop: 4 },
  card: {
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  cardAlert: { backgroundColor: '#FEE2E2' },
  alertText: { color: '#991B1B', fontSize: 13 },
  timer: { fontSize: 38, fontWeight: '800' },
  distance: { fontSize: 24, fontWeight: '700', color: '#0F172A' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: '#2563EB' },
  chipText: { color: '#334155', fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  buttonDisabled: { opacity: 0.5 },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 10,
  },
  secondaryButtonText: { color: '#2563EB', fontWeight: '700' },
  dangerButton: {
    backgroundColor: '#FEE2E2',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  dangerButtonText: { color: '#B91C1C', fontWeight: '700' },
});
