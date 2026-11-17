import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '../../../components/ui/button';
import { ObserverField } from '../../observers/components/ObserverField';
import { observersKey } from '../../observers/api/observers';
import { changeUserStatus, editUser, userQuery, usersKey } from '../api/users';
import { editUserSchema, statusSchema, type UserAccount } from '../schemas/users';
import { sameUser, userError } from '../utils/feedback';

export function ManageUser({
  account,
  operation,
}: {
  account: UserAccount;
  operation: 'edit' | 'status';
}) {
  const client = useQueryClient();
  const lock = useRef(false);
  const [preparing, setPreparing] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    account: UserAccount;
    fullName?: string;
    reason: string;
  } | null>(null);
  const [notice, setNotice] = useState('');
  const [needsReload, setNeedsReload] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{ fullName?: string; reason: string }>({
    resolver: zodResolver(operation === 'edit' ? editUserSchema : statusSchema),
    defaultValues: { fullName: account.fullName, reason: '' },
  });
  const read = () => client.fetchQuery({ ...userQuery(account.id), staleTime: 0 });
  const mutation = useMutation({
    retry: false,
    mutationFn: async (confirmed: NonNullable<typeof confirmation>) => {
      let current: UserAccount;
      try {
        current = await read();
      } catch {
        throw new Error('preflight_failed');
      }
      if (!sameUser(current, confirmed.account)) throw new Error('state_changed');
      if (operation === 'edit')
        await editUser(account.id, { fullName: confirmed.fullName!, reason: confirmed.reason });
      else
        await changeUserStatus(account.id, {
          active: !confirmed.account.active,
          reason: confirmed.reason,
        });
    },
    onSuccess: () => setNotice('Cambio de cuenta confirmado por el servidor.'),
    onError: (error) => setNotice(userError(error, true)),
    onSettled: async () => {
      setConfirmation(null);
      setNeedsReload(true);
      await Promise.all([
        client.invalidateQueries({ queryKey: usersKey }),
        client.invalidateQueries({ queryKey: observersKey }),
      ]);
      lock.current = false;
    },
  });
  return (
    <section className="max-w-form space-y-4 rounded-lg border bg-card p-4 sm:p-6">
      <h2 className="text-heading-sm">
        {operation === 'edit' ? 'Editar nombre de la cuenta' : 'Estado de la cuenta'}
      </h2>
      {notice && <p role={mutation.isSuccess ? 'status' : 'alert'}>{notice}</p>}
      {needsReload ? (
        <Button
          variant="secondary"
          disabled={preparing}
          onClick={async () => {
            if (lock.current) return;
            lock.current = true;
            setPreparing(true);
            try {
              const current = await read();
              reset({ fullName: current.fullName, reason: '' });
              setNeedsReload(false);
            } catch (error) {
              setNotice(userError(error));
            } finally {
              lock.current = false;
              setPreparing(false);
            }
          }}
        >
          Cargar datos actuales para {operation === 'edit' ? 'edición' : 'estado'}
        </Button>
      ) : confirmation ? (
        <section
          className="space-y-4 rounded-md border bg-muted p-4"
          aria-label="Confirmación de cuenta"
        >
          <h3 className="text-subheading">Revisar cambio de cuenta</h3>
          <p className="break-words">
            Usuario: {confirmation.account.username}.{' '}
            {operation === 'edit'
              ? `Nuevo nombre: ${confirmation.fullName}`
              : `La cuenta quedará ${confirmation.account.active ? 'inactiva' : 'activa'}.`}
          </p>
          {operation === 'status' && (
            <p>
              Desactivar revoca las sesiones; reactivar no las recupera. No se modifica el perfil,
              el vínculo ni las asignaciones.
            </p>
          )}
          <p className="break-words whitespace-pre-wrap">Motivo: {confirmation.reason}</p>
          <div className="flex flex-wrap gap-4">
            <Button
              variant={
                operation === 'status' && confirmation.account.active ? 'destructive' : 'primary'
              }
              disabled={mutation.isPending}
              onClick={() => {
                if (lock.current) return;
                lock.current = true;
                mutation.mutate(confirmation);
              }}
            >
              Confirmar cambio de cuenta
            </Button>
            <Button
              variant="secondary"
              disabled={mutation.isPending}
              onClick={() => setConfirmation(null)}
            >
              Cancelar
            </Button>
          </div>
        </section>
      ) : (
        <form
          noValidate
          className="space-y-6"
          onSubmit={(event) => {
            void handleSubmit(async (input) => {
              if (lock.current) return;
              lock.current = true;
              setPreparing(true);
              setNotice('');
              mutation.reset();
              try {
                const current = await read();
                if (!sameUser(current, account)) {
                  setNeedsReload(true);
                  setNotice(userError(new Error('state_changed')));
                } else if (operation === 'edit' && input.fullName === current.fullName)
                  setNotice('No hay cambios de nombre.');
                else setConfirmation({ account: current, ...input });
              } catch (error) {
                setNotice(userError(error));
              } finally {
                lock.current = false;
                setPreparing(false);
              }
            })(event);
          }}
        >
          {operation === 'edit' && (
            <ObserverField
              id="edit-account-name"
              label="Nuevo nombre completo"
              error={errors.fullName?.message}
              disabled={preparing}
              {...register('fullName')}
            />
          )}
          <ObserverField
            id={`account-${operation}-reason`}
            label={
              operation === 'edit' ? 'Motivo de edición de cuenta' : 'Motivo del estado de cuenta'
            }
            error={errors.reason?.message}
            disabled={preparing}
            {...register('reason')}
          />
          <div className="flex justify-end border-t pt-4">
            <Button variant="secondary" type="submit" disabled={preparing}>
              {operation === 'edit'
                ? 'Revisar edición de cuenta'
                : account.active
                  ? 'Revisar desactivación de cuenta'
                  : 'Revisar activación de cuenta'}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
