import { useEffect, useState } from 'react';

/** Retorna os milissegundos restantes até `expiresAt` (ou null se não houver). */
export function useCountdown(expiresAt) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!expiresAt) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return expiresAt ? expiresAt - now : null;
}
