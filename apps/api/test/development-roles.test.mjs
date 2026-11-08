import { describe, expect, it, vi } from 'vite-plus/test';
import { v7 } from 'uuid';
import { roles } from '../dist/database/schema/index.js';
import { initializeDevelopmentRoles } from '../tools/initialize-development-roles.mjs';

function database(existing = []) {
  const rows = structuredClone(existing);
  const values = vi.fn(async (missing) => {
    rows.push(...missing.map((role) => ({ ...role, id: v7() })));
  });
  const insert = vi.fn((table) => {
    expect(table).toBe(roles);
    return { values };
  });
  const tx = {
    select: () => ({
      from: (table) => {
        expect(table).toBe(roles);
        return {
          where: () => ({
            for: async () =>
              rows.filter((role) => ['ADMIN', 'ENLACE', 'OBSERVADOR'].includes(role.codigo)),
          }),
        };
      },
    }),
    insert,
  };
  return { transaction: (callback) => callback(tx), rows, insert, values };
}

describe('explicit development role initialization', () => {
  it('creates only the three approved active roles and writes nothing on repetition', async () => {
    const db = database();
    expect(await initializeDevelopmentRoles(db)).toEqual(['ADMIN', 'ENLACE', 'OBSERVADOR']);
    expect(db.values).toHaveBeenCalledWith([
      { codigo: 'ADMIN', nombre: 'Administrator', activo: true },
      { codigo: 'ENLACE', nombre: 'Enlace', activo: true },
      { codigo: 'OBSERVADOR', nombre: 'Observador', activo: true },
    ]);
    const initialized = structuredClone(db.rows);
    expect(await initializeDevelopmentRoles(db)).toEqual([]);
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(db.rows).toEqual(initialized);
  });

  it('preserves existing identifiers, metadata and unrelated roles', async () => {
    const existing = [
      { id: v7(), codigo: 'ADMIN', nombre: 'Existing admin', activo: true, descripcion: 'Keep' },
      { id: v7(), codigo: 'CUSTOM', nombre: 'Unrelated', activo: false },
    ];
    const db = database(existing);
    expect(await initializeDevelopmentRoles(db)).toEqual(['ENLACE', 'OBSERVADOR']);
    expect(db.rows.slice(0, existing.length)).toEqual(existing);
    expect(db.rows).toHaveLength(4);
  });

  it('rejects inactive approved roles without inserting or reactivating anything', async () => {
    const existing = [{ id: v7(), codigo: 'ENLACE', nombre: 'Inactive', activo: false }];
    const db = database(existing);
    await expect(initializeDevelopmentRoles(db)).rejects.toThrow('inactive');
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.rows).toEqual(existing);
  });
});
