import { useTransitionPresence } from '../hooks/useTransitionPresence';
import { btnDanger, btnSecondary } from '../styles/ui';
import { Spinner } from './Spinner';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '确认删除',
  cancelLabel = '取消',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { mounted, visible } = useTransitionPresence(open, 300);
  if (!mounted) return null;

  return (
    <div
      role="presentation"
      onClick={onCancel}
      className={`fixed inset-0 z-30 flex items-center justify-center bg-ink/40 p-4 transition-opacity duration-300 ease-in-out ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm rounded-[24px] border border-tan/15 bg-white p-6 shadow-warm transition-all duration-300 ease-in-out ${
          visible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-2 scale-95 opacity-0'
        }`}
      >
        <h2 id="confirm-dialog-title" className="font-display text-lg font-semibold text-ink">
          {title}
        </h2>
        <p className="mt-2 text-sm font-medium text-red-600">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} disabled={loading} className={btnSecondary}>
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={loading} className={`gap-2 ${btnDanger}`}>
            {loading && <Spinner className="h-4 w-4" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
