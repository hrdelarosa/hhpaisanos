import { BrowserRouter, useRoutes } from 'react-router';
import { AppProviders } from './providers';
import { routes } from './routes';

function AppRoutes() {
  return useRoutes(routes);
}

export function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProviders>
  );
}
