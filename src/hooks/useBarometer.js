import { useEffect, useState } from 'react';
import { Barometer } from 'expo-sensors';

/** Lê a pressão atmosférica (hPa), quando o aparelho tem barômetro. */
export function useBarometer() {
  const [available, setAvailable] = useState(false);
  const [pressure, setPressure] = useState(null);

  useEffect(() => {
    let active = true;
    let subscription = null;

    (async () => {
      try {
        const ok = await Barometer.isAvailableAsync();
        if (!active) return;
        setAvailable(ok);
        if (ok) {
          Barometer.setUpdateInterval(1000);
          subscription = Barometer.addListener((data) => setPressure(data.pressure));
        }
      } catch {
        if (active) setAvailable(false);
      }
    })();

    return () => {
      active = false;
      if (subscription) subscription.remove();
    };
  }, []);

  return { available, pressure };
}
