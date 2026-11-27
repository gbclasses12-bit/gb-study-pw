import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  kind: ToastKind;
  text: string;
}

type Listener = (msg: ToastMessage) => void;

const listeners = new Set<Listener>();
let nextId = 1;

function emit(kind: ToastKind, text: string) {
  const item: ToastMessage = { id: nextId++, kind, text };
  listeners.forEach((fn) => fn(item));
}

export const toast = Object.assign((text: string) => emit('info', text), {
  success: (text: string) => emit('success', text),
  error: (text: string) => emit('error', text),
  info: (text: string) => emit('info', text),
});

export function ToastViewport() {
  const [items, setItems] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const onToast: Listener = (msg) => {
      setItems((prev) => [...prev.slice(-3), msg]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== msg.id));
      }, 3600);
    };
    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[9999] flex max-w-sm flex-col gap-2 pointer-events-none"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={`pointer-events-auto flex items-center gap-3 rounded-lg border bg-background px-4 py-3 text-sm text-foreground shadow-lg transition-all duration-200 ${
            item.kind === 'error'
              ? 'border-red-500/40'
              : item.kind === 'success'
                ? 'border-green-500/40'
                : 'border-border'
          }`}
        >
          {item.kind === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
          ) : item.kind === 'error' ? (
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
          ) : (
            <Info className="h-4 w-4 shrink-0 text-[#5a4bda]" />
          )}
          <span className="flex-1 leading-5">{item.text}</span>
          <button
            type="button"
            onClick={() => setItems((prev) => prev.filter((x) => x.id !== item.id))}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close notification"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
