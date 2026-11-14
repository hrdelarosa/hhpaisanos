import { useQuery } from '@tanstack/react-query';
import { getHealth } from '../api/health';

export function HealthPage() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => getHealth(signal),
  });

  return (
    <section className="space-y-4">
      <h1 className="text-heading font-semibold">Heroínas y Héroes Paisanos</h1>
      <p className="text-foreground-secondary">
        Base técnica del sistema de gestión operativa para Guerrero.
      </p>
      <output aria-live="polite" className="block">
        {health.isPending
          ? 'Verificando conexión con la API…'
          : health.isError
            ? 'No se pudo conectar con la API.'
            : 'API conectada.'}
      </output>
    </section>
  );
}
