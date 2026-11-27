import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  EllipsisVertical,
  Search,
  X,
} from 'lucide-react';
import {
  BatchItem,
  fetchAboutMe,
  fetchPdfUrl,
  fetchTeacherDetails,
  fetchTodaysSchedule,
  getLocalEnrolledBatches,
  getScheduleTimingState,
  openWatchPlayer,
  recordStudyHistory,
} from '../lib/api';
import { NoteCard, NoteCardData, NoteCardSkeleton } from '../components/NoteCard';
import { PdfViewerModal } from '../components/PdfViewerModal';
import { toast } from '../components/Toast';

interface TeacherMeta {
  name: string;
  imageUrl: string;
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function resolveId(item: any): string {
  if (typeof item === 'string' || typeof item === 'number') return String(item);
  if (item && typeof item === 'object') return resolveId(item._id || item.id);
  return '';
}

export function StudyHomePage() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<BatchItem | null>(null);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerQuery, setDrawerQuery] = useState('');
  const [tempBatchId, setTempBatchId] = useState('');

  const [schedule, setSchedule] = useState<Record<string, any>[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [teachersMap, setTeachersMap] = useState<Record<string, TeacherMeta>>({});

  const [pdfModal, setPdfModal] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingBatches(true);
      let list: BatchItem[] = [];
      try {
        const res = await fetchAboutMe();
        list = (res?.enrolledBatches || []).map((b: any) => ({
          batchId: String(b.batchId || b._id || ''),
          batchName: String(b.name || b.batchName || 'Untitled Batch'),
          name: String(b.name || b.batchName || 'Untitled Batch'),
        }));
      } catch {
        list = getLocalEnrolledBatches();
      }
      if (list.length === 0) {
        list = getLocalEnrolledBatches();
      }
      if (cancelled) return;
      setBatches(list);
      let chosen: BatchItem | null = null;
      try {
        const saved = JSON.parse(localStorage.getItem('selectedBatch') || 'null');
        if (saved?.batchId) {
          chosen = list.find((b) => b.batchId === saved.batchId) || list[0] || null;
        }
      } catch {
        chosen = list[0] || null;
      }
      if (!chosen && list.length > 0) chosen = list[0];
      setSelectedBatch(chosen);
      setLoadingBatches(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedBatch?.batchId) {
      setSchedule([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingSchedule(true);
      setScheduleError('');
      try {
        const res = await fetchTodaysSchedule(selectedBatch.batchId);
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        if (cancelled) return;
        setSchedule(list);

        const teacherIds = Array.from(
          new Set<string>(
            list
              .map((s: any) => resolveId(asArray(s?.teachers)[0]))
              .filter(Boolean)
          )
        );
        if (teacherIds.length > 0) {
          try {
            const tRes = await fetchTeacherDetails(teacherIds);
            const map: Record<string, TeacherMeta> = {};
            asArray(tRes?.data).forEach((t: any) => {
              const id = resolveId(t);
              if (!id) return;
              map[id] = {
                name: String(t?.name || ''),
                imageUrl: t?.imageId
                  ? `${t.imageId.baseUrl || ''}${t.imageId.key || ''}`
                  : String(t?.photoUrl || t?.PhotoUrl || ''),
              };
            });
            if (!cancelled) setTeachersMap(map);
          } catch {
            // Ignore teacher portrait fetch failure
          }
        }
      } catch (err: any) {
        if (!cancelled) setScheduleError(err?.message || "Unable to load today's schedule.");
      } finally {
        if (!cancelled) setLoadingSchedule(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedBatch?.batchId]);

  const upcomingClasses = useMemo(() => schedule.slice(0, 6), [schedule]);

  const todaysNotes = useMemo<NoteCardData[]>(() => {
    if (!selectedBatch?.batchId) return [];
    const notes: NoteCardData[] = [];
    schedule.forEach((cls: any, sIdx: number) => {
      const subjectObj = cls?.subject || cls?.subjectId;
      const subjectId = String(
        subjectObj?.slug || (typeof subjectObj === 'string' ? subjectObj : subjectObj?._id) || 'subject'
      );
      asArray(cls?.homeworkIds).forEach((hw: any, hIdx: number) => {
        asArray(hw?.attachmentIds).forEach((att: any, aIdx: number) => {
          notes.push({
            id: `${cls?._id || sIdx}-${hw?._id || hIdx}-${att?._id || aIdx}`,
            pdfId: String(cls?._id || hw?._id || ''),
            attachmentId: String(att?._id || ''),
            title: String(att?.name || hw?.topic || cls?.topic || 'Class Notes'),
            dateText: cls?.startTime
              ? new Date(cls.startTime).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                })
              : undefined,
            isDpp: false,
            batchId: selectedBatch.batchId,
            subjectId,
            attachment: att,
          });
        });
      });
    });
    return notes;
  }, [schedule, selectedBatch?.batchId]);

  const handleOpenClass = (cls: Record<string, any>) => {
    const timing = getScheduleTimingState(cls);
    if (timing.isCancelled) {
      toast.error('This class was cancelled.');
      return;
    }
    if (timing.isUpcoming) {
      toast.info('This class has not started yet.');
      return;
    }
    const batchId = String(cls?.batchId || selectedBatch?.batchId || '');
    const subjectObj = cls?.subject || cls?.subjectId;
    const subjectId = String(
      subjectObj?.slug ||
        (typeof subjectObj === 'string' ? subjectObj : subjectObj?._id) ||
        cls?.batchSubjectId ||
        'subject'
    );
    const childId = String(cls?._id || '');
    if (!batchId || !childId) {
      toast.error('This class is missing its video details.');
      return;
    }
    recordStudyHistory({
      type: 'lecture',
      contentId: childId,
      title: String(cls?.topic || cls?.videoDetails?.name || 'Class Lecture'),
      watchedAt: new Date().toISOString(),
      teacherIds: asArray(cls?.teachers).map(resolveId).filter(Boolean),
      meta: {
        batchId,
        subjectId,
        duration: Number(cls?.videoDetails?.duration || 0),
        route: `/study/batches/${encodeURIComponent(batchId)}`,
      },
    });
    openWatchPlayer({
      batchId,
      subjectId,
      childId,
      type: String(cls?.urlType || cls?.scheduleType || 'penpencilvdo'),
      videoUrl: String(cls?.videoDetails?.videoUrl || cls?.url || ''),
      isLocked: Boolean(cls?.isLocked),
      topicId: String(cls?.topicId || cls?.slug || ''),
      isLive: timing.isLive,
    });
  };

  const resolvePdfLink = async (note: NoteCardData) => {
    const fallback =
      note.attachment?.baseUrl && note.attachment?.key
        ? `${note.attachment.baseUrl}${note.attachment.key}`
        : '';
    try {
      const res = await fetchPdfUrl(note.batchId, note.subjectId, note.pdfId, note.attachmentId);
      const pdfObj = res?.data?.data ?? res?.data;
      if (pdfObj?.baseUrl && pdfObj?.key) {
        return `${pdfObj.baseUrl}${pdfObj.key}`;
      }
    } catch {
      // Try direct attachment fallback
    }
    if (fallback) return fallback;
    throw new Error('PDF is not available');
  };

  const openNote = async (note: NoteCardData, download = false) => {
    try {
      const url = await resolvePdfLink(note);
      recordStudyHistory({
        type: 'note',
        contentId: note.id,
        title: note.title,
        watchedAt: new Date().toISOString(),
        url,
      });
      if (download) {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${note.title}.pdf`;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        setPdfModal({ url, title: note.title });
      }
    } catch (err: any) {
      toast.error(err?.message || 'Unable to open PDF');
    }
  };

  const filteredDrawerBatches = useMemo(() => {
    const q = drawerQuery.trim().toLowerCase();
    return q
      ? batches.filter((b) => (b.name || b.batchName).toLowerCase().includes(q))
      : batches;
  }, [batches, drawerQuery]);

  const openDrawer = () => {
    setTempBatchId(selectedBatch?.batchId || batches[0]?.batchId || '');
    setDrawerQuery('');
    setDrawerOpen(true);
  };

  const confirmBatch = () => {
    const found = batches.find((b) => b.batchId === tempBatchId);
    if (found) {
      setSelectedBatch(found);
      try {
        localStorage.setItem('selectedBatch', JSON.stringify(found));
      } catch {
        // Ignore
      }
    }
    setDrawerOpen(false);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-muted/20 pb-12">
      <div className="container mx-auto w-full max-w-[1180px] space-y-5 px-3 py-4 sm:space-y-6 sm:px-6 sm:py-7">
        {/* Selected Batch Header Banner matching gbstudynexttopper.vercel.app */}
        <section className="relative isolate overflow-hidden rounded-xl border border-white/10 bg-[#20262c] bg-[url(/assets/img/descriptionHeader.svg)] bg-cover bg-center px-5 py-6 text-white shadow-[0_14px_42px_rgba(15,23,42,0.18)] sm:px-8 sm:py-7">
          <div className="relative flex min-h-[72px] items-center justify-between gap-5">
            <div className="min-w-0">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">
                Your batch
              </p>
              {loadingBatches ? (
                <div className="h-9 w-64 animate-pulse rounded-lg bg-white/10" />
              ) : selectedBatch ? (
                <button
                  type="button"
                  onClick={openDrawer}
                  className="group flex max-w-full items-center gap-2 text-left text-xl font-bold sm:text-2xl"
                >
                  <span className="max-w-[235px] truncate sm:max-w-[560px]">
                    {selectedBatch.name || selectedBatch.batchName}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/study/batches')}
                  className="text-xl font-bold hover:underline sm:text-2xl"
                >
                  Explore a batch
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={openDrawer}
              aria-label="Open batch selector"
              className="hidden h-10 w-10 place-items-center rounded-full text-white/85 hover:bg-white/10 sm:grid"
            >
              <EllipsisVertical className="h-6 w-6" />
            </button>
          </div>
        </section>

        {/* Batch Offerings */}
        <section className="rounded-[24px] border border-border/70 bg-background/90 p-4 shadow-sm sm:p-6">
          <div className="mb-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#7567ee]">
              Start learning
            </p>
            <h1 className="mt-1 text-xl font-bold sm:text-2xl">Batch Offerings</h1>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={loadingBatches}
              onClick={() =>
                navigate(
                  selectedBatch
                    ? `/study/batches/${encodeURIComponent(selectedBatch.batchId)}`
                    : '/study/batches'
                )
              }
              className="group flex min-h-[76px] w-full items-center gap-3 rounded-xl bg-background px-4 py-3 text-left shadow-[0_6px_18px_rgba(15,23,42,0.05)] ring-1 ring-black/[0.02] dark:ring-white/10 transition hover:shadow-md active:scale-[0.985] disabled:opacity-55"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center p-0.5">
                <img
                  src="/assets/img/all-classes-icon.svg"
                  alt=""
                  className="h-full w-full object-contain"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium sm:text-base">
                  All Classes
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/45" />
            </button>

            <button
              type="button"
              onClick={() => navigate('/study/batches')}
              className="group flex min-h-[76px] w-full items-center gap-3 rounded-xl bg-background px-4 py-3 text-left shadow-[0_6px_18px_rgba(15,23,42,0.05)] ring-1 ring-black/[0.02] dark:ring-white/10 transition hover:shadow-md active:scale-[0.985]"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center p-0.5">
                <BookOpen className="h-7 w-7 text-[#7567ee]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium sm:text-base">
                  Explore All Batches
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/45" />
            </button>
          </div>
        </section>

        {/* Upcoming Events / Today's Classes */}
        <section className="rounded-[24px] border border-border/70 bg-background/90 p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <h2 className="text-xl font-bold sm:text-2xl">Today&apos;s Classes</h2>
            {!loadingSchedule && upcomingClasses.length > 0 && (
              <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[#7567ee]/10 px-1.5 text-xs font-bold text-[#7567ee]">
                {upcomingClasses.length}
              </span>
            )}
          </div>

          {loadingSchedule ? (
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="flex min-h-[104px] items-center gap-3 rounded-2xl border border-border/70 bg-background p-3 shadow-sm"
                >
                  <div className="skeleton-shimmer h-[72px] w-[72px] shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="skeleton-shimmer h-3 w-28 rounded" />
                    <div className="skeleton-shimmer h-4 w-2/3 rounded" />
                    <div className="skeleton-shimmer h-3 w-5/6 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : scheduleError ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
              {scheduleError}
            </div>
          ) : upcomingClasses.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-2 sm:flex-wrap">
              {upcomingClasses.map((cls, idx) => {
                const rawTeacher = asArray(cls?.teachers)[0];
                const teacherId = resolveId(rawTeacher);
                const tMeta = teachersMap[teacherId];
                const teacherName =
                  tMeta?.name ||
                  (typeof rawTeacher === 'object' ? rawTeacher?.name : '') ||
                  'Faculty';
                const teacherImg =
                  tMeta?.imageUrl ||
                  (typeof rawTeacher === 'object' && rawTeacher?.imageId
                    ? `${rawTeacher.imageId.baseUrl || ''}${rawTeacher.imageId.key || ''}`
                    : cls?.videoDetails?.image) ||
                  '/assets/img/teacher-placeholder.png';
                const { isCancelled, isLive, isUpcoming } = getScheduleTimingState(cls);
                const tag = isCancelled
                  ? 'CANCELLED'
                  : isLive
                    ? 'LIVE'
                    : isUpcoming
                      ? 'UPCOMING'
                      : 'ENDED';
                const startDate = new Date(cls?.startTime || 0);
                const timeText = Number.isNaN(startDate.getTime())
                  ? '—'
                  : startDate.toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                return (
                  <div
                    key={String(cls?._id || idx)}
                    onClick={() => handleOpenClass(cls)}
                    className="bg-background border p-2 rounded-md shadow-md hover:shadow-lg transition cursor-pointer select-none overflow-hidden w-[220px] min-w-[220px] max-w-[220px]"
                  >
                    <div className="relative w-full h-28 bg-muted/40 rounded overflow-hidden">
                      <img
                        src={teacherImg}
                        alt={teacherName}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '/assets/img/teacher-placeholder.png';
                        }}
                        className="h-full w-full object-contain"
                        draggable={false}
                      />
                      {teacherName && (
                        <div className="absolute capitalize bottom-0 w-full bg-foreground/90 text-background text-sm font-medium text-center py-1 truncate px-2">
                          {teacherName}
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between items-center py-3 text-xs uppercase">
                      <span
                        className={`px-2 py-1 rounded-md font-medium ${
                          tag === 'LIVE'
                            ? 'bg-red-600 text-white'
                            : tag === 'UPCOMING'
                              ? 'bg-purple-600 text-purple-100'
                              : tag === 'ENDED'
                                ? 'bg-emerald-500 text-green-100'
                                : 'bg-red-100 text-red-600'
                        }`}
                      >
                        {tag}
                      </span>
                      <span className="flex items-center text-muted-foreground gap-1 uppercase">
                        <Clock className="h-3.5 w-3.5" />
                        {timeText}
                      </span>
                    </div>
                    <div className="py-1 text-sm font-semibold text-foreground text-center border-t truncate">
                      {cls?.topic || cls?.subjectId?.name || 'Live Class'}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed bg-muted/20 p-9 text-center">
              <Calendar className="mx-auto h-6 w-6 text-[#7567ee]" />
              <p className="mt-3 font-semibold">No classes scheduled today</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Open your batch details to browse recorded chapters, lectures, and notes.
              </p>
            </div>
          )}

          <div className="mt-5 flex justify-center">
            <button
              type="button"
              disabled={!selectedBatch}
              onClick={() =>
                selectedBatch &&
                navigate(`/study/batches/${encodeURIComponent(selectedBatch.batchId)}`)
              }
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#7567ee] px-7 py-2.5 text-sm font-semibold text-[#7567ee] transition hover:bg-[#7567ee] hover:text-white disabled:opacity-50"
            >
              <span>Open Batch Content</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        {/* Today's Notes */}
        {(loadingSchedule || todaysNotes.length > 0) && (
          <section className="min-w-0 overflow-hidden rounded-[24px] border border-border/70 bg-background/90 p-4 shadow-sm sm:p-6">
            <div className="mb-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#7567ee]">
                Shared today
              </p>
              <h2 className="mt-1 text-xl font-bold sm:text-2xl">Today&apos;s Notes</h2>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {loadingSchedule
                ? Array.from({ length: 3 }).map((_, idx) => <NoteCardSkeleton key={idx} />)
                : todaysNotes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      onView={() => void openNote(note, false)}
                      onDownload={() => void openNote(note, true)}
                    />
                  ))}
            </div>
          </section>
        )}

        {/* My Study Zone */}
        <section className="rounded-[24px] border border-border/70 bg-background/90 p-4 shadow-sm sm:p-6">
          <div className="mb-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#7567ee]">
              Quick access
            </p>
            <h2 className="mt-1 text-xl font-bold sm:text-2xl">My Study Zone</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: 'My Batches',
                description: 'View all the batches you are enrolled in',
                route: '/study/mybatches',
              },
              {
                title: 'Explore Batches',
                description: 'Browse classes and discover more batches',
                route: '/study/batches',
              },
              {
                title: 'Watch History',
                description: 'Resume recently watched lectures and notes',
                route: '/history',
              },
            ].map((card) => (
              <button
                key={card.route}
                type="button"
                onClick={() => navigate(card.route)}
                className="group relative min-h-[142px] overflow-hidden rounded-2xl border border-border/70 bg-background p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#7567ee]/50 hover:shadow-md"
              >
                <span className="mb-4 flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#f2f0ff] dark:bg-[#5a4bda]/20 p-1.5">
                    <img
                      src="/assets/img/all-classes-icon.svg"
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  </span>
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-muted/70">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </span>
                </span>
                <span className="block text-base font-bold">{card.title}</span>
                <span className="mt-1.5 block line-clamp-2 text-sm leading-5 text-muted-foreground">
                  {card.description}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Right Slide-Over Batch Selector Drawer */}
      <div
        className={`fixed inset-0 z-[80] ${drawerOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-hidden={!drawerOpen}
      >
        <button
          type="button"
          aria-label="Close batch selector"
          onClick={() => setDrawerOpen(false)}
          className={`absolute inset-0 bg-black/60 transition-opacity ${
            drawerOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Select your batch"
          className={`absolute inset-y-0 right-0 flex w-full max-w-[410px] flex-col border-l bg-background shadow-2xl transition-transform duration-200 ease-out ${
            drawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
            <h2 className="font-semibold">Select your batch</h2>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="grid h-9 w-9 place-items-center rounded-md transition hover:bg-muted"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <label className="mb-5 flex h-12 items-center gap-2 rounded-md border bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
              <input
                value={drawerQuery}
                onChange={(e) => setDrawerQuery(e.target.value)}
                placeholder="Search enrolled batches"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>

            <section role="radiogroup" aria-label="Enrolled batches">
              <h3 className="mb-2 text-sm font-semibold">
                Enrolled Batches ({filteredDrawerBatches.length})
              </h3>
              {filteredDrawerBatches.length > 0 ? (
                <div className="overflow-hidden rounded-lg border bg-background">
                  {filteredDrawerBatches.map((batch) => {
                    const checked = batch.batchId === tempBatchId;
                    return (
                      <button
                        key={batch.batchId}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        onClick={() => setTempBatchId(batch.batchId)}
                        className={`flex w-full items-center gap-3 border-b px-3 py-3 text-left text-sm transition last:border-b-0 ${
                          checked
                            ? 'bg-[#7567ee]/10 dark:bg-[#29ff94]/10'
                            : 'hover:bg-muted/60'
                        }`}
                      >
                        <span className="min-w-0 flex-1 leading-5">
                          {batch.name || batch.batchName}
                        </span>
                        <span
                          aria-hidden="true"
                          className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                            checked
                              ? 'border-[#7567ee] dark:border-[#29ff94]'
                              : 'border-input'
                          }`}
                        >
                          {checked && (
                            <span className="h-3 w-3 rounded-full bg-[#7567ee] dark:bg-[#29ff94]" />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No enrolled batches match your search.
                </div>
              )}
            </section>
          </div>

          <div className="shrink-0 border-t bg-background p-4">
            <button
              type="button"
              onClick={confirmBatch}
              disabled={!tempBatchId}
              className="h-11 w-full rounded-md bg-foreground text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </aside>
      </div>

      <PdfViewerModal
        url={pdfModal?.url || null}
        title={pdfModal?.title || ''}
        onClose={() => setPdfModal(null)}
      />
    </div>
  );
}
