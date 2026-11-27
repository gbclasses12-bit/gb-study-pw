import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  Calendar,
  ChevronRight,
  Clock,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import {
  fetchBatchInfo,
  fetchPdfUrl,
  fetchTeacherDetails,
  fetchTodaysSchedule,
  formatDisplayDate,
  getScheduleTimingState,
  openWatchPlayer,
  recordStudyHistory,
} from '../lib/api';
import { NoteCard, NoteCardData, NoteCardSkeleton } from '../components/NoteCard';
import { PdfViewerModal } from '../components/PdfViewerModal';
import { PoweredByFooter } from '../components/PoweredByFooter';
import { toast } from '../components/Toast';

type DetailTab = 'description' | 'classes' | 'live';

interface TeacherMeta {
  name: string;
  imageUrl: string;
}

function asArray<T>(val: T | T[] | undefined | null): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function resolveId(item: any): string {
  if (typeof item === 'string' || typeof item === 'number') return String(item);
  if (item && typeof item === 'object') return resolveId(item._id || item.id);
  return '';
}

function sanitizeBatchHtml(rawHtml: string): string {
  if (!rawHtml) return '';
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');
    doc.querySelectorAll('script, iframe, object, embed, style, link').forEach((el) => el.remove());
    doc.querySelectorAll('*').forEach((el) => {
      for (const attr of Array.from(el.attributes)) {
        const lowerName = attr.name.toLowerCase();
        const lowerVal = attr.value.toLowerCase().trim();
        if (lowerName.startsWith('on') || lowerVal.startsWith('javascript:')) {
          el.removeAttribute(attr.name);
        }
      }
    });
    return doc.body.innerHTML;
  } catch {
    return rawHtml.replace(/<script[\s\S]*?<\/script>/gi, '');
  }
}

export function BatchDetailPage() {
  const { batchId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialTab = (searchParams.get('tab') as DetailTab) || 'classes';
  const [activeTab, setActiveTab] = useState<DetailTab>(
    initialTab === 'description' || initialTab === 'live' ? initialTab : 'classes'
  );

  const [batch, setBatch] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Announcements drawer/modal
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<Record<string, any>[]>([]);
  const [annPage, setAnnPage] = useState(1);
  const [annHasMore, setAnnHasMore] = useState(true);
  const [annLoading, setAnnLoading] = useState(false);

  // Live classes (today's schedule)
  const [liveSchedule, setLiveSchedule] = useState<Record<string, any>[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveLoaded, setLiveLoaded] = useState(false);
  const [teachersMap, setTeachersMap] = useState<Record<string, TeacherMeta>>({});

  const [pdfModal, setPdfModal] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    const paramTab = searchParams.get('tab');
    if (paramTab === 'description' || paramTab === 'classes' || paramTab === 'live') {
      setActiveTab(paramTab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!batchId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetchBatchInfo(batchId, 'details');
        const info = res?.data || res;
        if (!cancelled) {
          setBatch(info);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Unable to load batch details.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [batchId]);

  const loadAnnouncements = async (pageNum: number, append = false) => {
    if (!batchId) return;
    setAnnLoading(true);
    try {
      const res = await fetchBatchInfo(batchId, 'announcement', pageNum);
      const list = Array.isArray(res?.data) ? res.data : [];
      setAnnouncements((prev) => (append ? [...prev, ...list] : list));
      setAnnPage(pageNum);
      setAnnHasMore(list.length >= 10);
    } catch {
      toast.error('Unable to load announcements.');
    } finally {
      setAnnLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'live' || liveLoaded || !batchId) return;
    let cancelled = false;
    (async () => {
      setLiveLoading(true);
      try {
        const res = await fetchTodaysSchedule(batchId);
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        if (cancelled) return;
        setLiveSchedule(list);
        setLiveLoaded(true);

        const teacherIds = Array.from(
          new Set<string>(list.map((s: any) => resolveId(asArray(s?.teachers)[0])).filter(Boolean))
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
            // Ignore teacher failure
          }
        }
      } catch {
        if (!cancelled) setLiveLoaded(true);
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, liveLoaded, batchId]);

  const switchTab = (tab: DetailTab) => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Batch link copied to clipboard.');
    } catch {
      toast.info('Copy the URL from your browser address bar to share.');
    }
  };

  const handleOpenAnnouncements = () => {
    setAnnouncementOpen(true);
    if (announcements.length === 0) {
      void loadAnnouncements(1, false);
    }
  };

  const subjects: Record<string, any>[] = useMemo(() => {
    if (!batch) return [];
    return asArray(batch.subjects || batch.subjectList);
  }, [batch]);

  const batchTitle = String(batch?.name || batch?.batchName || 'Batch Details');
  const sanitizedDescription = useMemo(
    () => sanitizeBatchHtml(String(batch?.description || '')),
    [batch?.description]
  );

  const liveNotes: NoteCardData[] = useMemo(() => {
    const notes: NoteCardData[] = [];
    liveSchedule.forEach((cls: any, sIdx: number) => {
      const subjectObj = cls?.subject || cls?.subjectId;
      const subjId = String(
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
            batchId,
            subjectId: subjId,
            attachment: att,
          });
        });
      });
    });
    return notes;
  }, [liveSchedule, batchId]);

  const resolvePdfLink = async (note: NoteCardData) => {
    const fallback =
      note.attachment?.baseUrl && note.attachment?.key
        ? `${note.attachment.baseUrl}${note.attachment.key}`
        : '';
    try {
      const res = await fetchPdfUrl(note.batchId, note.subjectId, note.pdfId, note.attachmentId);
      const pdfObj = res?.data?.data ?? res?.data;
      if (pdfObj?.baseUrl && pdfObj?.key) return `${pdfObj.baseUrl}${pdfObj.key}`;
    } catch {
      // Fallback
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
    const subjectObj = cls?.subject || cls?.subjectId;
    const subjId = String(
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
        subjectId: subjId,
        duration: Number(cls?.videoDetails?.duration || 0),
        route: `/study/batches/${encodeURIComponent(batchId)}`,
      },
    });
    openWatchPlayer({
      batchId,
      subjectId: subjId,
      childId,
      type: String(cls?.urlType || cls?.scheduleType || 'penpencilvdo'),
      videoUrl: String(cls?.videoDetails?.videoUrl || cls?.url || ''),
      isLocked: Boolean(cls?.isLocked),
      topicId: String(cls?.topicId || cls?.slug || ''),
      isLive: timing.isLive,
    });
  };

  const tabClass = (tab: DetailTab) =>
    `flex items-center gap-1.5 px-3 py-3 text-xs sm:text-sm font-medium transition whitespace-nowrap cursor-pointer ${
      activeTab === tab
        ? 'border-b-4 border-[#7567ee] text-[#5a4bda] dark:border-[#3dc280] dark:text-[#29ff94] font-semibold'
        : 'text-muted-foreground hover:text-foreground'
    }`;

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-muted/20 pb-12">
      <div className="container mx-auto max-w-[1200px] space-y-5 p-3 sm:p-5">
        {/* Top Banner + Tab Bar matching gbstudynexttopper.vercel.app */}
        <section className="overflow-hidden rounded-[20px_20px_0_0] border bg-background shadow-sm">
          <div className="bg-[#20262c] bg-[url(/assets/img/descriptionHeader.svg)] bg-cover bg-center px-4 py-6 sm:px-7 sm:py-8">
            {loading ? (
              <div className="space-y-2">
                <div className="h-4 w-24 animate-pulse rounded bg-white/15" />
                <div className="h-8 w-3/4 max-w-md animate-pulse rounded bg-white/15" />
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-white/70">
                    Batch Overview
                  </p>
                  <h1 className="text-lg font-bold text-white sm:text-2xl break-words">
                    {batchTitle}
                  </h1>
                </div>
                {batch?.language && (
                  <span className="rounded-md bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                    {batch.language}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-background px-3 sm:px-6">
            <div className="no-scrollbar flex items-center gap-1 overflow-x-auto sm:gap-4">
              <button type="button" onClick={() => switchTab('description')} className={tabClass('description')}>
                Description
              </button>
              <button type="button" onClick={() => switchTab('classes')} className={tabClass('classes')}>
                All Classes
              </button>
              <button type="button" onClick={() => switchTab('live')} className={tabClass('live')}>
                Live Classes
              </button>
            </div>

            <div className="flex items-center gap-2 py-2">
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition hover:bg-muted"
              >
                <Share2 className="h-3.5 w-3.5 text-[#5a4bda] dark:text-[#29ff94]" />
                <span className="hidden sm:inline">Share Batch</span>
              </button>
              <button
                type="button"
                onClick={handleOpenAnnouncements}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition hover:bg-muted"
              >
                <Bell className="h-3.5 w-3.5 text-[#5a4bda] dark:text-[#29ff94]" />
                <span className="hidden sm:inline">Announcement</span>
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        {/* All Classes Tab -> Subjects Grid */}
        {activeTab === 'classes' && (
          <section className="rounded-xl border bg-background p-4 divshadow sm:p-6">
            <div className="mb-5">
              <h2 className="text-lg font-bold sm:text-xl">Subjects</h2>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Select a subject to view chapters, recorded lectures, notes, and DPPs.
              </p>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-lg border bg-background p-3 sm:p-4"
                  >
                    <div className="skeleton-shimmer h-10 w-10 shrink-0 rounded-md" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton-shimmer h-4 w-3/4 rounded" />
                      <div className="skeleton-shimmer h-3 w-1/2 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : subjects.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {subjects.map((subj, idx) => {
                  const subjSlug = String(subj?.slug || subj?._id || '');
                  const subjId = String(subj?._id || subjSlug);
                  const subjName = String(subj?.subject || subj?.name || 'Subject');
                  const iconUrl = subj?.imageId
                    ? `${subj.imageId.baseUrl || ''}${subj.imageId.key || ''}`
                    : String(subj?.icon || '/assets/img/defaultSubject.svg');
                  const chaptersCount =
                    subj?.tagCount ?? subj?.schedules ?? subj?.chaptersCount ?? null;

                  return (
                    <button
                      key={subjId || idx}
                      type="button"
                      onClick={() => {
                        const qs = new URLSearchParams();
                        if (subjId) qs.set('batchSubjectId', subjId);
                        if (subjSlug) qs.set('subjectId', subjSlug);
                        qs.set('subjectName', subjName);
                        navigate(
                          `/study/batches/${encodeURIComponent(batchId)}/subjects/${encodeURIComponent(
                            subjSlug || subjId
                          )}?${qs.toString()}`
                        );
                      }}
                      className="divshadow group flex items-center gap-3 rounded-lg border bg-background p-3 text-left transition hover:-translate-y-0.5 hover:border-[#7567ee]/60 sm:p-4"
                    >
                      <img
                        src={iconUrl || '/assets/img/defaultSubject.svg'}
                        alt={subjName}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '/assets/img/defaultSubject.svg';
                        }}
                        className="h-10 w-10 shrink-0 rounded-md object-contain"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold sm:text-base">{subjName}</h3>
                        <p className="text-xs text-muted-foreground">
                          {chaptersCount !== null && chaptersCount !== undefined
                            ? `${chaptersCount} Chapters`
                            : 'Open chapters'}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                No subjects found for this batch yet.
              </div>
            )}
          </section>
        )}

        {/* Description Tab */}
        {activeTab === 'description' && (
          <section className="space-y-5">
            <div className="rounded-xl border bg-background p-4 divshadow sm:p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold sm:text-xl">
                <Sparkles className="h-5 w-5 text-[#7567ee] dark:text-[#29ff94]" />
                <span>Batch Details</span>
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Start Date</p>
                  <p className="mt-1 font-semibold">{formatDisplayDate(batch?.startDate)}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">End Date</p>
                  <p className="mt-1 font-semibold">{formatDisplayDate(batch?.endDate)}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Target / Stream</p>
                  <p className="mt-1 font-semibold truncate">{batch?.byName || 'All Students'}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Access Fee</p>
                  <p className="mt-1 font-bold text-green-600 dark:text-[#29ff94]">
                    ₹ FREE (100% Free)
                  </p>
                </div>
              </div>
            </div>

            {sanitizedDescription && (
              <div className="rounded-xl border bg-background p-4 divshadow sm:p-6">
                <h3 className="mb-3 text-base font-bold sm:text-lg">About This Batch</h3>
                <div
                  className="prose prose-sm max-w-none dark:prose-invert break-words text-sm leading-relaxed text-foreground/90"
                  dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
                />
              </div>
            )}
          </section>
        )}

        {/* Live Classes Tab */}
        {activeTab === 'live' && (
          <section className="space-y-5">
            <div className="rounded-xl border bg-background p-4 divshadow sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold sm:text-xl">Today&apos;s Live &amp; Scheduled Classes</h2>
                <button
                  type="button"
                  onClick={() => switchTab('classes')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#5a4bda] hover:underline dark:text-[#29ff94]"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>Browse Subjects</span>
                </button>
              </div>

              {liveLoading ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <div key={idx} className="flex items-center gap-3 rounded-xl border p-3">
                      <div className="skeleton-shimmer h-[72px] w-[72px] rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <div className="skeleton-shimmer h-3 w-24 rounded" />
                        <div className="skeleton-shimmer h-4 w-3/4 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : liveSchedule.length > 0 ? (
                <div className="flex flex-wrap gap-4">
                  {liveSchedule.map((cls, idx) => {
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
                        className="w-full cursor-pointer select-none overflow-hidden rounded-md border bg-background p-2 shadow-md transition hover:shadow-lg sm:w-[220px]"
                      >
                        <div className="relative h-28 w-full overflow-hidden rounded bg-muted/40">
                          <img
                            src={teacherImg}
                            alt={teacherName}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = '/assets/img/teacher-placeholder.png';
                            }}
                            className="h-full w-full object-contain"
                          />
                          <div className="absolute bottom-0 w-full truncate bg-foreground/90 px-2 py-1 text-center text-sm font-medium capitalize text-background">
                            {teacherName}
                          </div>
                        </div>
                        <div className="flex items-center justify-between py-3 text-xs uppercase">
                          <span
                            className={`rounded-md px-2 py-1 font-medium ${
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
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            {timeText}
                          </span>
                        </div>
                        <div className="truncate border-t py-1 text-center text-sm font-semibold">
                          {cls?.topic || cls?.subjectId?.name || 'Live Class'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center">
                  <Calendar className="mx-auto h-6 w-6 text-[#7567ee]" />
                  <p className="mt-2 font-semibold">No live classes scheduled today</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Switch to All Classes to study recorded lectures and notes.
                  </p>
                </div>
              )}
            </div>

            {(liveLoading || liveNotes.length > 0) && (
              <div className="rounded-xl border bg-background p-4 divshadow sm:p-6">
                <h3 className="mb-4 text-lg font-bold">Today&apos;s Notes</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {liveLoading
                    ? Array.from({ length: 3 }).map((_, i) => <NoteCardSkeleton key={i} />)
                    : liveNotes.map((note) => (
                        <NoteCard
                          key={note.id}
                          note={note}
                          onView={() => void openNote(note, false)}
                          onDownload={() => void openNote(note, true)}
                        />
                      ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Announcements Modal */}
      {announcementOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setAnnouncementOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Batch Announcements"
            className="flex max-h-[82vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b px-5 py-4">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-[#5a4bda] dark:text-[#29ff94]" />
                <h2 className="text-base font-bold sm:text-lg">Announcements</h2>
              </div>
              <button
                type="button"
                onClick={() => setAnnouncementOpen(false)}
                className="rounded-md p-1 hover:bg-muted"
                aria-label="Close announcements"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {annLoading && announcements.length === 0 ? (
                Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="space-y-2 rounded-lg border p-3">
                    <div className="skeleton-shimmer h-3 w-24 rounded" />
                    <div className="skeleton-shimmer h-4 w-full rounded" />
                    <div className="skeleton-shimmer h-4 w-2/3 rounded" />
                  </div>
                ))
              ) : announcements.length > 0 ? (
                announcements.map((item, idx) => (
                  <article key={String(item?._id || idx)} className="rounded-lg border p-3.5 text-sm">
                    <div className="mb-1.5 text-xs text-muted-foreground">
                      {formatDisplayDate(item?.createdAt)}
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed text-foreground">
                      {String(item?.announcement || item?.message || item?.title || '')}
                    </p>
                  </article>
                ))
              ) : (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No announcements posted for this batch yet.
                </div>
              )}

              {annHasMore && announcements.length > 0 && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    disabled={annLoading}
                    onClick={() => void loadAnnouncements(annPage + 1, true)}
                    className="rounded-md bg-muted px-4 py-2 text-xs font-semibold hover:bg-muted/80 disabled:opacity-50"
                  >
                    {annLoading ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}

              <PoweredByFooter className="mt-3 pb-1" />
            </div>
          </div>
        </div>
      )}

      <PdfViewerModal
        url={pdfModal?.url || null}
        title={pdfModal?.title || ''}
        onClose={() => setPdfModal(null)}
      />
    </div>
  );
}
