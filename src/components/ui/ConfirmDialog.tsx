import type { ReactNode } from 'react';
import { AlertTriangle, Check } from 'lucide-react';

type ConfirmTone = 'danger' | 'success' | 'neutral';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

const toneStyles: Record<
  ConfirmTone,
  { iconBg: string; iconColor: string; confirmBtn: string }
> = {
  danger: {
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    confirmBtn: 'bg-rose-600 hover:bg-rose-700 text-white',
  },
  success: {
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  neutral: {
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
    confirmBtn: 'bg-[#002B8F] hover:bg-[#001E66] text-white',
  },
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Batal',
  tone = 'neutral',
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  if (!open) return null;

  const styles = toneStyles[tone];
  const Icon = tone === 'success' ? Check : AlertTriangle;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
          <div className={`p-3 rounded-2xl ${styles.iconBg}`}>
            <Icon size={28} className={styles.iconColor} />
          </div>
          <h3 id="confirm-dialog-title" className="text-2xl font-extrabold text-slate-900 leading-tight">
            {title}
          </h3>
        </div>

        <p className="text-base font-medium text-slate-600 leading-relaxed">{description}</p>

        {children ? <div className="space-y-3">{children}</div> : null}

        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto px-6 py-4 border-2 border-slate-300 text-slate-700 hover:bg-slate-50 font-bold rounded-2xl text-base min-h-[48px]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`w-full sm:w-auto px-6 py-4 font-bold rounded-2xl text-base min-h-[48px] ${styles.confirmBtn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}