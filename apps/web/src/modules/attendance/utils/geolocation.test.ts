import { afterEach, expect, it, vi } from 'vite-plus/test';
import { requestLocation } from './geolocation';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function setup(getCurrentPosition: ReturnType<typeof vi.fn> = vi.fn()) {
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
  return getCurrentPosition;
}

it('requests only finite contract evidence, without the device timestamp or extra position data', async () => {
  const geo = setup(
    vi.fn((success) =>
      success({
        coords: { latitude: 16.85, longitude: -99.9, accuracy: 4, altitude: 800 },
        timestamp: 1234,
      }),
    ),
  );
  expect(await requestLocation()).toEqual({ latitude: 16.85, longitude: -99.9, accuracy: 4 });
  expect(geo.mock.calls[0][2]).toEqual({ timeout: 15000, maximumAge: 0, enableHighAccuracy: true });
});

it.each([
  [1, 'permission_denied'],
  [2, 'position_unavailable'],
  [3, 'timeout'],
  [99, 'unexpected_error'],
])('maps browser error %s to %s', async (code, missingReason) => {
  setup(
    vi.fn((_success, failure) =>
      failure({ code, message: 'Sensitive browser error must be ignored' }),
    ),
  );
  expect(await requestLocation()).toEqual({ missingReason });
});

it('supports unavailable browser APIs and insecure contexts without calling GPS', async () => {
  const geo = setup();
  vi.stubGlobal('isSecureContext', false);
  expect(await requestLocation()).toEqual({ missingReason: 'insecure_context' });
  expect(geo).not.toHaveBeenCalled();
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('navigator', {});
  expect(await requestLocation()).toEqual({ missingReason: 'unsupported' });
});

it.each([
  { latitude: NaN, longitude: 1, accuracy: 4 },
  { latitude: 1, longitude: Infinity, accuracy: 4 },
  { latitude: 91, longitude: 1, accuracy: 4 },
  { latitude: 1, longitude: -181, accuracy: 4 },
  { latitude: 1, longitude: 1, accuracy: -1 },
  { latitude: 1, longitude: 1, accuracy: 10000000 },
])('falls back for evidence outside the actual backend contract: %j', async (coords) => {
  setup(vi.fn((success) => success({ coords })));
  expect(await requestLocation()).toEqual({ missingReason: 'unexpected_error' });
});

it('handles thrown API errors without retaining their messages', async () => {
  setup(
    vi.fn(() => {
      throw new Error('Sensitive device error');
    }),
  );
  expect(await requestLocation()).toEqual({ missingReason: 'unexpected_error' });
});

it('bounds permission waits even when the browser never calls back and ignores late locations', async () => {
  vi.useFakeTimers();
  const geo = setup();
  const pending = requestLocation();
  await vi.advanceTimersByTimeAsync(15000);
  expect(await pending).toEqual({ missingReason: 'timeout' });
  geo.mock.calls[0][0]({ coords: { latitude: 16, longitude: -99, accuracy: 1 } });
  expect(await pending).toEqual({ missingReason: 'timeout' });
});
