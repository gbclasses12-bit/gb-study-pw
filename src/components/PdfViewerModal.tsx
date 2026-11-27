import { Download, ExternalLink, X } from 'lucide-react';

interface PdfViewerModalProps {
  url: string | null;
  title: string;
  onClose: () => void;
}

export function PdfViewerModal({ url, title, onClose }: PdfViewerModalProps) {
  if (!url) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-2 sm:p-5"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title || 'PDF Viewer'}
        className="flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold sm:text-base">
            {title || 'Document'}
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={url}
              download={title || 'document.pdf'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-muted transition-colors"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Download</span>
            </a>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#5a4bda] px-3 text-xs font-medium text-white hover:bg-[#4c3ec9] transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">Open Tab</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-md hover:bg-muted transition-colors"
              aria-label="Close PDF viewer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>
        <div className="flex-1 bg-muted/30">
          <iframe
            src={url}
            title={title || 'PDF Document'}
            className="h-full w-full border-0"
          />
        </div>
      </div>
    </div>
  );
}
