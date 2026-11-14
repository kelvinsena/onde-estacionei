import React from 'react';
import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { ParkingWidget } from './ParkingWidget';
import { loadParking } from '../services/storage';

/** Redesenha o widget com os dados mais recentes salvos no AsyncStorage. */
export async function refreshWidget() {
  if (Platform.OS !== 'android') return;
  try {
    const parking = await loadParking();
    await requestWidgetUpdate({
      widgetName: 'Parking',
      renderWidget: () => <ParkingWidget parking={parking} />,
      widgetNotFound: () => {},
    });
  } catch {
    // Sem widget na tela inicial ou ambiente sem suporte: ignora.
  }
}
