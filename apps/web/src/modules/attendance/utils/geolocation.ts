import { locationSchema, type CaptureLocation } from '../schemas/capture';

const timeout = 15_000;

export function requestLocation(): Promise<CaptureLocation> {
  if (!window.isSecureContext) return Promise.resolve({ missingReason: 'insecure_context' });
  if (!navigator.geolocation) return Promise.resolve({ missingReason: 'unsupported' });
  return new Promise((resolve) => {
    // The browser's own timeout may exclude time spent waiting for permission.
    const timer = window.setTimeout(() => finish({ missingReason: 'timeout' }), timeout);
    function finish(location: CaptureLocation) {
      window.clearTimeout(timer);
      resolve(location);
    }
    try {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          const result = locationSchema.safeParse({
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy,
          });
          finish(result.success ? result.data : { missingReason: 'unexpected_error' });
        },
        ({ code }) =>
          finish({
            missingReason:
              code === 1
                ? 'permission_denied'
                : code === 2
                  ? 'position_unavailable'
                  : code === 3
                    ? 'timeout'
                    : 'unexpected_error',
          }),
        { timeout, maximumAge: 0, enableHighAccuracy: true },
      );
    } catch {
      finish({ missingReason: 'unexpected_error' });
    }
  });
}
