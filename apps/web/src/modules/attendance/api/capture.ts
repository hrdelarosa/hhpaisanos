import { HttpError, http } from '../../../lib/http';
import { captureResultSchema, type CaptureInput, type CaptureOperation } from '../schemas/capture';

export const terminalCaptureCodes = [
  'ineligible',
  'day_changed',
  'initial_mark_exists',
  'invalid_order',
];

export async function captureAttendance(
  operation: CaptureOperation,
  key: string,
  input: CaptureInput,
) {
  try {
    const response = await http(`/api/attendance/me/${operation}`, {
      method: 'POST',
      headers: { 'Idempotency-Key': key },
      body: input,
      signal: AbortSignal.timeout(25_000),
    });
    const result = captureResultSchema.safeParse(response);
    if (!result.success) throw new Error('Invalid capture response');
    return result.data;
  } catch (error) {
    // Mutation errors must never retain response fragments or evidence.
    if (error instanceof HttpError)
      throw new HttpError(
        error.status,
        terminalCaptureCodes.includes(error.code ?? '') || error.code === 'PASSWORD_CHANGE_REQUIRED'
          ? error.code
          : undefined,
      );
    throw new Error('No se pudo confirmar el resultado de la captura.');
  }
}
