import { useEffect, useState } from 'react';

export function App() {
  const [status, setStatus] = useState('Verificando conexión con la API…');

  useEffect(() => {
    const controller = new AbortController();

    async function checkHealth() {
      try {
        const response = await fetch('/api/health', { signal: controller.signal });
        if (!response.ok) throw new Error('Health request failed');
        const body: unknown = await response.json();
        if (
          typeof body !== 'object' ||
          body === null ||
          !('status' in body) ||
          body.status !== 'ok'
        ) {
          throw new Error('Unexpected health response');
        }
        if (!controller.signal.aborted) setStatus('API conectada.');
      } catch {
        if (!controller.signal.aborted) setStatus('No se pudo conectar con la API.');
      }
    }

    void checkHealth();
    return () => controller.abort();
  }, []);

  return (
    <main>
      <h1>Heroínas y Héroes Paisanos</h1>
      <p>Base técnica del sistema de gestión operativa para Guerrero.</p>
      <output aria-live="polite">{status}</output>
    </main>
  );
}
