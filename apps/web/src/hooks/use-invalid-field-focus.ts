import { useRef } from 'react';
import { useConfirmationFocus } from './use-confirmation-focus';

export function useInvalidFieldFocus() {
  const formRef = useRef<HTMLFormElement>(null);
  const invalidValidation = useRef<symbol | null>(null);
  const requestFocus = useConfirmationFocus();
  const prepareInvalidFocus = () => {
    const validation = Symbol();
    // Capture intent before the resolver runs, but wait for committed error attributes.
    requestFocus(() =>
      invalidValidation.current === validation
        ? (formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]:not(:disabled)') ??
          null)
        : null,
    );
    return () => {
      invalidValidation.current = validation;
    };
  };
  return { formRef, prepareInvalidFocus };
}
