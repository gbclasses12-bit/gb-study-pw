import { Download, Eye, FileText, Play, X } from 'lucide-react';
import { openWatchPlayer } from '../lib/api';

export interface NoteCardData {
  id: string;
  pdfId: string;
  attachmentId?: string;
  title: string;
  dateText?: string;
  isDpp?: boolean;
  batchId: string;
  subjectId: string;
  attachment?: Record<string, any>;
}

export function NoteCardSkeleton() {
  return (
    <article
      aria-hidden="true"
      className="rounded-2xl border bg-background p-3"
    >
      <div className="flex items-center gap-3">
        <div className="skeleton-shimmer h-[72px] w-[72px] shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="skeleton-shimmer h-3 w-24 rounded" />
          <div className="skeleton-shimmer h-4 w-full rounded" />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <div className="skeleton-shimmer h-9 flex-1 rounded-md" />
        <div className="skeleton-shimmer h-9 w-12 rounded-md" />
      </div>
    </article>
  );
}

export function NoteCard({
  note,
  onView,
  onDownload,
}: {
  note: NoteCardData;
  onView: () => void;
  onDownload: () => void;
}) {
  return (
    <article className="rounded-2xl border bg-background p-3 shadow-sm transition hover:shadow-md">
      <div className="flex items-center gap-3">
        <img
          src={note.isDpp ? '/assets/img/dpp-icon.svg' : '/assets/img/notes-icon.svg'}
          alt={note.isDpp ? 'DPP PDF' : 'Notes'}
          className={`h-[72px] w-[72px] shrink-0 rounded-xl object-contain ${
            note.isDpp ? 'bg-amber-100' : 'bg-sky-100'
          }`}
        />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2 text-xs uppercase text-muted-foreground">
            <span>{note.isDpp ? 'DPP PDF' : 'Notes'}</span>
            {note.dateText && <span>• {note.dateText}</span>}
          </div>
          <h3 className="truncate text-sm font-semibold sm:text-base" title={note.title}>
            {note.title}
          </h3>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onView}
          className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-md bg-muted px-4 py-2 text-sm font-medium transition hover:bg-[#7567ee] hover:text-white"
        >
          <Eye className="h-5 w-5" />
          <span>{note.isDpp ? 'View DPP PDF' : 'View Note'}</span>
        </button>
        <button
          type="button"
          onClick={onDownload}
          className="flex w-12 shrink-0 items-center justify-center rounded-md bg-muted transition hover:bg-[#7567ee] hover:text-white"
          aria-label={note.isDpp ? 'Download DPP PDF' : 'Download note'}
        >
          <Download className="h-5 w-5" />
        </button>
      </div>
    </article>
  );
}

export interface AttachmentModalProps {
  open: boolean;
  loading: boolean;
  error: string;
  schedule: Record<string, any> | null;
  batchId: string;
  subjectId: string;
  onClose: () => void;
  onOpenPdf: (attachment: Record<string, any> | undefined, pdfId: string, title: string, isDpp?: boolean) => void;
}

function asList<T>(val: T | T[] | undefined | null): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

export function extractAttachmentsFromSchedule(schedule: Record<string, any> | null) {
  if (!schedule) return { notes: [], dppPdfs: [], dppVideos: [] };

  const parentScheduleId = String(schedule._id || '');
  const notes: { id: string; pdfId: string; title: string; attachment?: Record<string, any> }[] = [];
  for (const hw of asList<Record<string, any>>(schedule.homeworkIds)) {
    const attachments = asList<Record<string, any>>(hw?.attachmentIds);
    attachments.forEach((att, idx) => {
      notes.push({
        id: String(att?._id || hw?._id || `note-${idx}`),
        pdfId: parentScheduleId || String(hw?._id || att?._id || ''),
        title: String(att?.name || hw?.topic || hw?.name || 'Class Notes'),
        attachment: att,
      });
    });
  }

  const dppPdfs: { id: string; pdfId: string; title: string; attachment?: Record<string, any> }[] = [];
  const dppVideos: Record<string, any>[] = [];

  const childSchedules = [
    ...asList<Record<string, any>>(schedule.dppScheduleId),
    ...asList<Record<string, any>>(schedule.dppScheduleIds),
    ...asList<Record<string, any>>(schedule.dppSchedules),
    ...asList<Record<string, any>>(schedule.childSchedules),
    ...(schedule.dpp && typeof schedule.dpp === 'object' ? [schedule.dpp] : []),
  ];

  childSchedules.forEach((child, cIdx) => {
    if (!child || typeof child !== 'object') return;
    const childScheduleId = String(child._id || parentScheduleId || '');
    for (const hw of asList<Record<string, any>>(child.homeworkIds)) {
      for (const att of asList<Record<string, any>>(hw?.attachmentIds)) {
        dppPdfs.push({
          id: String(att?._id || hw?._id || `dpp-pdf-${cIdx}`),
          pdfId: childScheduleId || String(hw?._id || att?._id || ''),
          title: String(att?.name || hw?.topic || hw?.name || 'DPP PDF'),
          attachment: att,
        });
      }
    }
    if (child.videoDetails || child.urlType || child.url) {
      dppVideos.push(child);
    }
  });

  return { notes, dppPdfs, dppVideos };
}

export function AttachmentModal({
  open,
  loading,
  error,
  schedule,
  batchId,
  subjectId,
  onClose,
  onOpenPdf,
}: AttachmentModalProps) {
  if (!open) return null;

  const { notes, dppPdfs, dppVideos } = extractAttachmentsFromSchedule(schedule);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lecture-attachments-title"
        className="w-full max-w-md overflow-hidden rounded-xl bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b px-5 py-4">
          <h2 id="lecture-attachments-title" className="text-lg font-semibold">
            Attachments
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 hover:bg-muted"
            aria-label="Close attachments"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="max-h-[75vh] space-y-6 overflow-y-auto p-5">
          {loading && (
            <div className="space-y-5" aria-label="Loading attachments">
              <div className="skeleton-shimmer h-4 w-20 rounded" />
              <div className="skeleton-shimmer h-16 w-full rounded-lg" />
              <div className="skeleton-shimmer h-4 w-16 rounded" />
              <div className="skeleton-shimmer h-20 w-full rounded-lg" />
            </div>
          )}

          {!loading && error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          )}

          {!loading && (
            <>
              <section>
                <h3 className="mb-3 text-sm font-semibold">NOTES</h3>
                <div className="space-y-2">
                  {notes.length > 0 ? (
                    notes.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => onOpenPdf(n.attachment, n.pdfId, n.title, false)}
                        className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition hover:bg-muted/50"
                      >
                        <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {n.title}
                        </span>
                        <Eye className="h-4 w-4 shrink-0" />
                      </button>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                      No notes are attached to this lecture.
                    </div>
                  )}
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-semibold">DPP PDFs</h3>
                <div className="space-y-2">
                  {dppPdfs.length > 0 ? (
                    dppPdfs.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => onOpenPdf(n.attachment, n.pdfId, n.title, true)}
                        className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition hover:bg-muted/50"
                      >
                        <FileText className="h-5 w-5 shrink-0 text-amber-600" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {n.title}
                        </span>
                        <Eye className="h-4 w-4 shrink-0" />
                      </button>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                      No DPP PDF is attached to this lecture.
                    </div>
                  )}
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-semibold">DPP Videos</h3>
                <div className="space-y-2">
                  {dppVideos.length > 0 ? (
                    dppVideos.map((vid, idx) => (
                      <button
                        key={String(vid._id || idx)}
                        type="button"
                        onClick={() => {
                          onClose();
                          openWatchPlayer({
                            batchId,
                            subjectId,
                            childId: String(vid._id || ''),
                            type: String(vid.urlType || 'penpencilvdo'),
                            videoUrl: String(vid.videoDetails?.videoUrl || vid.url || ''),
                            isLocked: Boolean(vid.isLocked),
                            topicId: String(vid.slug || ''),
                          });
                        }}
                        className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition hover:bg-muted/50"
                      >
                        <img
                          src="/assets/img/dpp-icon.svg"
                          alt="DPP Video"
                          className="h-12 w-12 shrink-0 rounded-lg bg-amber-100 object-contain"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {String(vid.topic || vid.videoDetails?.name || 'DPP Solution Video')}
                          </span>
                          <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <Play className="h-3.5 w-3.5" />
                            Watch solution
                          </span>
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                      No DPP video is attached to this lecture.
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
