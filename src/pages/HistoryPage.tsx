import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ExternalLink, FileText, Play, Trash2 } from 'lucide-react';
import {
  clearStudyHistory,
  getStudyHistory,
  StudyHistoryItem,
} from '../lib/api';
import { PdfViewerModal } from '../components/PdfViewerModal';
import { toast } from '../components/Toast';

export function HistoryPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<StudyHistoryItem[]>(() => getStudyHistory());
  const [pdfModal, setPdfModal] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    const sync = () => setItems(getStudyHistory());
    window.addEventListener('studyHistoryUpdated', sync);
    return () => window.removeEventListener('studyHistoryUpdated', sync);
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, StudyHistoryItem[]>();
    items.forEach((item) => {
      const dateObj = new Date(item.watchedAt);
      const label = Number.isNaN(dateObj.getTime())
        ? 'Recent'
        : dateObj.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
      const existing = map.get(label) || [];
      existing.push(item);
      map.set(label, existing);
    });
    return Array.from(map.entries());
  }, [items]);

  const handleOpenItem = (item: StudyHistoryItem) => {
    if (item.url) {
      setPdfModal({ url: item.url, title: item.title });
      return;
    }
    if (item.meta?.route) {
      navigate(item.meta.route);
      return;
    }
    if (item.meta?.batchId) {
      navigate(`/study/batches/${encodeURIComponent(item.meta.batchId)}`);
      return;
    }
    navigate('/study/batches');
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-muted/20 pb-12">
      <div className="container mx-auto max-w-[1100px] space-y-5 p-3 sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background px-5 py-4 divshadow">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#7567ee]/10 text-[#5a4bda] dark:bg-[#29ff94]/10 dark:text-[#29ff94]">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold sm:text-2xl">Study History</h1>
              <p className="text-xs text-muted-foreground">
                Recently opened lectures, notes, and DPPs
              </p>
            </div>
          </div>

          {items.length > 0 && (
            <button
              type="button"
              onClick={() => {
                clearStudyHistory();
                toast.success('History cleared.');
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-2 text-xs font-semibold text-destructive transition hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
              <span>Clear History</span>
            </button>
          )}
        </header>

        {grouped.length > 0 ? (
          <div className="space-y-6">
            {grouped.map(([dateLabel, groupItems]) => (
              <section key={dateLabel} className="space-y-3">
                <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {dateLabel}
                </h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {groupItems.map((item, idx) => {
                    const isVideo = item.type === 'lecture' || item.type === 'dpp-video';
                    const timeStr = new Date(item.watchedAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    return (
                      <button
                        key={`${item.type}-${item.contentId}-${idx}`}
                        type="button"
                        onClick={() => handleOpenItem(item)}
                        className="divshadow group flex items-center gap-3.5 rounded-xl border bg-background p-3.5 text-left transition hover:-translate-y-0.5 hover:border-[#7567ee]/50"
                      >
                        <div
                          className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${
                            isVideo
                              ? 'bg-[#7567ee]/15 text-[#5a4bda] dark:bg-[#29ff94]/15 dark:text-[#29ff94]'
                              : 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300'
                          }`}
                        >
                          {isVideo ? (
                            <Play className="h-5 w-5 fill-current" />
                          ) : (
                            <FileText className="h-5 w-5" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-0.5 flex items-center gap-2 text-[11px] uppercase text-muted-foreground">
                            <span className="font-semibold text-[#5a4bda] dark:text-[#29ff94]">
                              {item.type.replace('-', ' ')}
                            </span>
                            <span>• {timeStr}</span>
                          </div>
                          <p className="truncate text-sm font-semibold">{item.title}</p>
                        </div>
                        <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100" />
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed bg-background p-12 text-center divshadow">
            <Clock className="mx-auto h-8 w-8 text-[#7567ee]" />
            <h2 className="mt-3 text-base font-bold">No watch history yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Open any lecture or PDF from your batches to see it listed here.
            </p>
            <button
              type="button"
              onClick={() => navigate('/study/batches')}
              className="mt-4 rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
            >
              Explore Batches
            </button>
          </div>
        )}
      </div>

      <PdfViewerModal
        url={pdfModal?.url || null}
        title={pdfModal?.title || ''}
        onClose={() => setPdfModal(null)}
      />
    </div>
  );
}
