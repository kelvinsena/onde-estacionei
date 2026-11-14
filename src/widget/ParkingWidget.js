import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { formatClock, formatDistance, formatRemaining } from '../utils/geo';

function statusFrom(parking) {
  if (!parking) {
    return { title: 'Nenhum veículo salvo', detail: 'Abra o app para guardar a vaga', color: '#94A3B8' };
  }

  if (!parking.expiresAt) {
    return { title: 'Sem parquímetro', detail: 'Tempo livre', color: '#38BDF8' };
  }

  const remaining = parking.expiresAt - Date.now();
  if (remaining <= 0) {
    return { title: 'Expirado', detail: `Venceu às ${formatClock(parking.expiresAt)}`, color: '#F87171' };
  }

  // O widget não atualiza a cada segundo, então mostra em minutos.
  const minutes = Math.max(1, Math.ceil(remaining / 60000));
  const title = remaining >= 3600000 ? formatRemaining(remaining) : `${minutes} min`;
  return {
    title,
    detail: `Vence às ${formatClock(parking.expiresAt)}`,
    color: remaining <= 10 * 60 * 1000 ? '#FBBF24' : '#4ADE80',
  };
}

export function ParkingWidget({ parking }) {
  const status = statusFrom(parking);
  const distance =
    parking && parking.lastDistance != null ? formatDistance(parking.lastDistance) : '--';

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#0F172A',
        borderRadius: 20,
        padding: 14,
        justifyContent: 'space-between',
      }}
    >
      <TextWidget
        text="🚗 Onde estacionei?"
        style={{ fontSize: 12, color: '#94A3B8' }}
      />

      <FlexWidget style={{ flexDirection: 'column' }}>
        <TextWidget
          text={status.title}
          style={{ fontSize: 28, fontWeight: 'bold', color: status.color }}
        />
        <TextWidget text={status.detail} style={{ fontSize: 12, color: '#CBD5E1' }} />
      </FlexWidget>

      {parking ? (
        <TextWidget
          text={`📍 ${distance} até o veículo`}
          style={{ fontSize: 13, color: '#E2E8F0' }}
        />
      ) : (
        <TextWidget text=" " style={{ fontSize: 13, color: '#E2E8F0' }} />
      )}
    </FlexWidget>
  );
}
