import 'reflect-metadata';
import { request as httpRequest } from 'node:http';
import { Controller, Module, Post, Req } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { v7 } from 'uuid';
import { expect, it, vi } from 'vite-plus/test';
import {
  instantMicros,
  localDate,
  receivedAt,
  scheduledInstant,
  timingFlags,
} from '../dist/modules/attendance/attendance-time.js';
import {
  normalizeMark,
  missingLocationReasons,
} from '../dist/modules/attendance/attendance-input.js';
import { AuthGuard } from '../dist/modules/auth/guards/auth.guard.js';
import { AttendancePersistence } from '../dist/modules/attendance/attendance.persistence.js';
import { captureRequestTimestamp, installRequestTimestamp } from '../dist/request-timestamp.js';

it('pads measured milliseconds to six digits and preserves supplied microseconds in comparisons', () => {
  expect(receivedAt(Date.parse('2026-11-12T15:15:00.123Z'))).toBe('2026-11-12 15:15:00.123000');
  expect(
    instantMicros('2026-11-12 15:15:00.000001') - instantMicros('2026-11-12 15:15:00.000000'),
  ).toBe(1n);
  expect(() => instantMicros('2026-02-30 15:15:00.000000')).toThrow();
  expect(() => instantMicros('2026-11-12 15:15:00.123')).toThrow();
});

it('uses inclusive arrival tolerance and exact departure boundaries without rounding', () => {
  const flags = (time, type = 'entrada') =>
    timingFlags(`2026-11-12 ${time}`, '2026-11-12', type, '09:00:00', '17:00:00', 15);
  expect(scheduledInstant('2026-11-12', '09:00:00')).toBe('2026-11-12 15:00:00.000000');
  expect(flags('15:15:00.000000').lateArrival).toBe(false);
  expect(flags('15:15:00.000001').lateArrival).toBe(true);
  expect(flags('22:59:59.999999', 'salida').earlyDeparture).toBe(true);
  expect(flags('23:00:00.000000', 'salida').earlyDeparture).toBe(false);
  expect(localDate('2026-11-13 05:59:59.999999')).toBe('2026-11-12');
  expect(localDate('2026-11-13 06:00:00.000000')).toBe('2026-11-13');
});

it('normalizes validated content and accepts only paired finite GPS or controlled absence', () => {
  const mark = {
    assignmentId: v7(),
    expectedDate: '2026-11-12',
    type: 'entrada',
    location: { latitude: 0, longitude: 0, accuracy: 0 },
  };
  expect(normalizeMark({ location: mark.location, ...mark })).toEqual(mark);
  for (const missingReason of missingLocationReasons)
    expect(normalizeMark({ ...mark, location: { missingReason } }).location).toEqual({
      missingReason,
    });
  for (const location of [
    null,
    {},
    { latitude: 0 },
    { latitude: 91, longitude: 0, accuracy: 1 },
    { latitude: 0, longitude: 181, accuracy: 1 },
    { latitude: 0, longitude: 0, accuracy: -1 },
    { latitude: NaN, longitude: 0, accuracy: 1 },
    { missingReason: 'other' },
    { ...mark.location, missingReason: 'timeout' },
  ]) {
    expect(() => normalizeMark({ ...mark, location })).toThrow('Invalid attendance content');
  }
  expect(() => normalizeMark({ ...mark, expectedDate: '2026-02-30' })).toThrow();
  expect(() => normalizeMark({ ...mark, observerId: v7() })).toThrow();
});

it('attaches the boundary timestamp before the asynchronous authentication wait', async () => {
  const request = {};
  const now = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-13T05:59:59.123Z'));
  try {
    captureRequestTimestamp(request, {}, () => {});
    const guard = new AuthGuard(
      { getAllAndOverride: () => false },
      {
        authenticate: async (req) => {
          expect(req.receivedAt).toBe('2026-11-13 05:59:59.123000');
          await Promise.resolve();
          now.mockReturnValue(Date.parse('2026-11-13T06:00:00.000Z'));
          return { user: { mustChangePassword: false } };
        },
      },
    );
    await guard.canActivate({
      getHandler() {},
      getClass() {},
      switchToHttp: () => ({ getRequest: () => request }),
    });
    expect(request.receivedAt).toBe('2026-11-13 05:59:59.123000');
  } finally {
    now.mockRestore();
  }
});

it('maps rolled-back deadlocks to retryable conflicts without exposing SQL or GPS', async () => {
  const persistence = new AttendancePersistence(
    {
      db: {
        transaction: async () => {
          throw new Error('sensitive SQL parameters', { cause: { code: 'ER_LOCK_DEADLOCK' } });
        },
      },
    },
    {},
  );
  await expect(persistence.complete({}, v7())).rejects.toThrow(
    'Concurrent attendance operation; reload and retry (personal capture uses the same key)',
  );
});

it('timestamps a fragmented HTTP request before the default JSON parser waits across midnight', async () => {
  class ProbeController {
    probe(request) {
      return { receivedAt: request.receivedAt, body: request.body };
    }
  }
  Controller()(ProbeController);
  Post('boundary-probe')(
    ProbeController.prototype,
    'probe',
    Object.getOwnPropertyDescriptor(ProbeController.prototype, 'probe'),
  );
  Req()(ProbeController.prototype, 'probe', 0);
  class ProbeModule {}
  Module({ controllers: [ProbeController] })(ProbeModule);
  const app = await NestFactory.create(ProbeModule, { logger: false });
  installRequestTimestamp(app);
  let arrived, request;
  const arrival = new Promise((resolve) => {
    arrived = resolve;
  });
  app.use((req, _res, next) => {
    arrived(req.receivedAt);
    next();
  });
  await app.listen(0, 'localhost');
  const baseUrl = await app.getUrl();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-13T05:59:59.123Z'));
  try {
    const response = new Promise((resolve, reject) => {
      request = httpRequest(
        `${baseUrl}/boundary-probe`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength('{"test":true}'),
          },
        },
        (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (data) => {
            body += data;
          });
          res.on('end', () => resolve(JSON.parse(body)));
          res.on('error', reject);
        },
      );
      request.on('error', reject);
      request.write('{"test":');
    });
    expect(await arrival).toBe('2026-11-13 05:59:59.123000');
    clock.mockReturnValue(Date.parse('2026-11-13T06:00:00.000Z'));
    request.end('true}');
    expect(await response).toEqual({
      receivedAt: '2026-11-13 05:59:59.123000',
      body: { test: true },
    });
  } finally {
    clock.mockRestore();
    request?.destroy();
    await app.close();
  }
});
