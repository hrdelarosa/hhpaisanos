import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { parseAsInteger, useQueryState } from 'nuqs';
import { BrowserRouter, Route, Routes } from 'react-router';
import { afterEach, expect, it } from 'vite-plus/test';
import { AppLayout } from './layouts/AppLayout';

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

function UrlStateProbe() {
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  return (
    <button type="button" onClick={() => void setPage(page + 1)}>
      Página {page}
    </button>
  );
}

it('connects nuqs to the actual React Router adapter and preserves unrelated URL state', async () => {
  window.history.replaceState(null, '', '/?page=2&context=synthetic');
  render(
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<UrlStateProbe />} />
        </Route>
      </Routes>
    </BrowserRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Página 2' }));
  await screen.findByRole('button', { name: 'Página 3' });
  await waitFor(() => expect(window.location.search).toBe('?page=3&context=synthetic'));
});
