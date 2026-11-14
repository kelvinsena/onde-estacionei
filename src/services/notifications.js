import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'parquimetro';
const WARNING_BEFORE_MS = 10 * 60 * 1000; // 10 minutos

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Cria o canal (Android) e pede permissão. Retorna true se concedida. */
export async function setupNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Parquímetro',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: current } = await Notifications.getPermissionsAsync();
  if (current === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function scheduleAt(title, body, date) {
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: CHANNEL_ID,
    },
  });
}

/**
 * Agenda o aviso de 10 minutos antes do vencimento e o aviso de tempo esgotado.
 * Se faltarem menos de 10 min, só o aviso final é agendado.
 */
export async function scheduleParkingAlerts(expiresAt) {
  const ids = [];
  const now = Date.now();
  const warnAt = expiresAt - WARNING_BEFORE_MS;

  if (warnAt > now + 1000) {
    ids.push(
      await scheduleAt(
        '⏰ Parquímetro vence em 10 minutos',
        'Hora de voltar ao veículo ou renovar o tempo.',
        new Date(warnAt)
      )
    );
  }

  if (expiresAt > now + 1000) {
    ids.push(
      await scheduleAt(
        '🚨 Tempo do parquímetro esgotado',
        'Seu tempo de estacionamento terminou.',
        new Date(expiresAt)
      )
    );
  }

  return ids;
}

export async function cancelAlerts(ids = []) {
  await Promise.all(
    ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}))
  );
}
