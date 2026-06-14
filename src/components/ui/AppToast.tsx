import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

type ToastType = 'success' | 'error';

type ToastItem = {
  message: string;
  type: ToastType;
};

let emitToast: ((message: string, type?: ToastType) => void) | null = null;

export function toast(message: string, type: ToastType = 'success') {
  if (emitToast) {
    emitToast(message, type);
    return;
  }
  window.alert(message);
}

export default function AppToastHost() {
  const [item, setItem] = useState<ToastItem | null>(null);

  useEffect(() => {
    emitToast = (message, type = 'success') => {
      setItem({ message, type });
      window.setTimeout(() => setItem(null), 4000);
    };
    return () => {
      emitToast = null;
    };
  }, []);

  if (!item) return null;

  const isError = item.type === 'error';

  return (
    <div
      role="status"
      className={`fixed z-[60] left-4 right-4 bottom-24 lg:left-auto lg:right-6 lg:bottom-6 lg:max-w-md flex items-start gap-3 px-5 py-4 rounded-2xl shadow-2xl font-semibold text-base ${
        isError ? 'bg-rose-700 text-white' : 'bg-[#002B8F] text-white'
      }`}
    >
      {isError ? (
        <AlertCircle size={22} className="shrink-0 mt-0.5" />
      ) : (
        <CheckCircle2 size={22} className="shrink-0 mt-0.5" />
      )}
      <span className="leading-snug">{item.message}</span>
    </div>
  );
}