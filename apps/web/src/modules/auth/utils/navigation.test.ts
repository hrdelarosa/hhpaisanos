import { expect, it } from 'vite-plus/test';
import type { AuthUser } from '../schemas/auth';
import { availableSections, navigationSections, sectionDestination } from './navigation';

const identity = (role: string, permissions: string[]): AuthUser => ({
  id: 'synthetic',
  username: 'synthetic',
  fullName: 'Synthetic account',
  role,
  permissions,
  mustChangePassword: false,
});

it.each(['ADMIN', 'ENLACE', 'OBSERVADOR'])('does not infer access from the %s role', (role) => {
  expect(availableSections(identity(role, []))).toEqual([]);
});

it.each(navigationSections.filter((section) => 'create' in section))(
  'retains create-only navigation for $id without linking a denied list',
  (section) => {
    if (!('create' in section)) throw new Error('Expected creation capability');
    const sections = availableSections(identity('ADMIN', [section.create.permission]));
    expect(sections).toHaveLength(1);
    expect(sections[0].canRead).toBe(false);
    expect(sectionDestination(sections[0]).path).toBe(section.create.path);
  },
);

it('retains the approved role conditions and explicit Assignments exception', () => {
  const permissions = navigationSections.flatMap((section) => [
    section.permission,
    ...('create' in section ? [section.create.permission] : []),
  ]);
  expect(
    availableSections(identity('OBSERVADOR', permissions)).map((section) => section.id),
  ).toEqual(['personal', 'assignments']);
  expect(
    availableSections(identity('ENLACE', permissions)).some((section) => section.id === 'users'),
  ).toBe(false);
  expect(
    availableSections(identity('CUSTOM', ['assignments:create'])).map(sectionDestination),
  ).toEqual([
    { label: 'Crear asignación', path: '/asignaciones/nueva', permission: 'assignments:create' },
  ]);
});

it('keeps granted creation as a separate quick action when a list is also readable', () => {
  const [section] = availableSections(identity('ADMIN', ['operatives:read', 'operatives:create']));
  expect(sectionDestination(section).path).toBe('/operativos');
  expect(section.create?.path).toBe('/operativos/nuevo');
  expect(availableSections(null)).toEqual([]);
});
