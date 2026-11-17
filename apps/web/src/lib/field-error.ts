export function fieldErrorAttributes(errorId: string, error?: string, description?: string) {
  return {
    'aria-invalid': Boolean(error),
    'aria-describedby':
      [description, error ? errorId : undefined].filter(Boolean).join(' ') || undefined,
  };
}
