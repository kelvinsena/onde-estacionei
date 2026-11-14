import React from 'react';
import { ParkingWidget } from './ParkingWidget';
import { loadParking } from '../services/storage';

export async function widgetTaskHandler(props) {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const parking = await loadParking();
      props.renderWidget(<ParkingWidget parking={parking} />);
      break;
    }
    default:
      break;
  }
}
