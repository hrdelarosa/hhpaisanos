import { Component, Suspense, type ReactNode } from 'react';

type Props = { pathname: string; children: ReactNode };
type State = { pathname: string; failed: boolean };

export class RouteContentBoundary extends Component<Props, State> {
  state: State = { pathname: this.props.pathname, failed: false };

  static getDerivedStateFromProps(props: Props, state: State) {
    return props.pathname !== state.pathname ? { pathname: props.pathname, failed: false } : null;
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed)
      return (
        <section className="space-y-4 rounded-lg border bg-card p-4 sm:p-6">
          <h1 className="text-heading">No se pudo cargar esta sección</h1>
          <p role="alert">
            Vuelve a Inicio para consultar otra sección o recarga esta página manualmente. La carga
            fallida no se reintenta automáticamente.
          </p>
          <p>
            Recargar descarta los intentos de captura en memoria. Consulta el estado de tus
            registros antes de iniciar otra operación. No se reenviaron operaciones automáticamente.
          </p>
        </section>
      );
    return (
      <Suspense
        key={this.props.pathname}
        fallback={
          <output className="block rounded-lg border bg-card p-6">Cargando sección…</output>
        }
      >
        {this.props.children}
      </Suspense>
    );
  }
}
