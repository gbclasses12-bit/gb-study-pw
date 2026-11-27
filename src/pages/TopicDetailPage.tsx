import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  FolderOpen,
  Play,
} from 'lucide-react';
import {
  fetchPdfUrl,
  fetchScheduleDetails,
  fetchSubjectInfo,
  fetchTeacherDetails,
  fetchTopicInfo,
  formatDisplayDate,
  getScheduleTimingState,
  openWatchPlayer,
  recordStudyHistory,
} from '../lib/api';
import {
  AttachmentModal,
  NoteCard,
  NoteCardData,
  NoteCardSkeleton,
} from '../components/NoteCard';
import { PdfViewerModal } from '../components/PdfViewerModal';
import { PoweredByFooter } from '../components/PoweredByFooter';
import { toast } from '../components/Toast';

type TopicTab = 'videos' | 'notes' | 'DppNotes' | 'DppVideos';

const TABS: { key: TopicTab; label: string }[] = [
  { key: 'videos', label: 'Videos' },
  { key: 'notes', label: 'Notes' },
  { key: 'DppNotes', label: 'DPP' },
  { key: 'DppVideos', label: 'DPP Videos' },
];

function asArray<T>(val: T | T[] | undefined | null): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function resolveId(item: any): string {
  if (typeof item === 'string' || typeof item === 'number') return String(item);
  if (item && typeof item === 'object') return resolveId(item._id || item.id);
  return '';
}

function formatDuration(seconds: number): string {
  if (!seconds || !Number.isFinite(seconds)) return '';
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return hrs > 0 ? `${hrs}h ${remMins}m` : `${mins}m`;
}

export function TopicDetailPage() {
  const { batchId = '', subjectId = '', topicId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const subjectSlug = searchParams.get('subjectId') || subjectId;
  const batchSubjectId = searchParams.get('batchSubjectId') || '';
  const subjectName = searchParams.get('subjectName') || '';

  const [chapters, setChapters] = useState<Record<string, any>[]>([]);
  const [activeTab, setActiveTab] = useState<TopicTab>('videos');

  const [items, setItems] = useState<Record<string, any>[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [teachersMap, setTeachersMap] = useState<Record<string, { name: string; imageUrl: string }>>({});

  // Attachment Modal for lectures
  const [attModal, setAttModal] = useState<{
    open: boolean;
    loading: boolean;
    error: string;
    schedule: Record<string, any> | null;
  }>({ open: false, loading: false, error: '', schedule: null });

  const [pdfModal, setPdfModal] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    if (!batchId || !subjectSlug) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchSubjectInfo(batchId, subjectSlug, 1);
        if (!cancelled && Array.isArray(res?.data)) {
          setChapters(res.data);
        }
      } catch {
        // Non-critical sidebar chapter list
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [batchId, subjectSlug]);

  const loadContent = async (tab: TopicTab, pageNum: number, append: boolean) => {
    if (!batchId || !subjectSlug || !topicId) return;
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const res = await fetchTopicInfo(batchId, subjectSlug, topicId, tab, pageNum);
      const list = Array.isArray(res?.data) ? res.data : [];
      setItems((prev) => (append ? [...prev, ...list] : list));
      setPage(pageNum);
      setHasMore(list.length >= 10);

      if (tab === 'videos' || tab === 'DppVideos') {
        const ids = Array.from(
          new Set<string>(list.map((v: any) => resolveId(asArray(v?.teachers)[0])).filter(Boolean))
        );
        if (ids.length > 0) {
          try {
            const tRes = await fetchTeacherDetails(ids);
            const map: Record<string, { name: string; imageUrl: string }> = {};
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
            setTeachersMap((prev) => ({ ...prev, ...map }));
          } catch {
            // Ignore teacher failure
          }
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load chapter content');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    setItems([]);
    void loadContent(activeTab, 1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, subjectSlug, topicId, activeTab]);

  const currentChapter = chapters.find(
    (c) => String(c?.slug || '') === topicId || String(c?._id || '') === topicId
  );
  const currentTitle =
    currentChapter?.name ||
    decodeURIComponent(topicId)
      .replace(/-\d+$/, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const handleSelectChapter = (nextSlug: string) => {
    const qs = new URLSearchParams();
    if (batchSubjectId) qs.set('batchSubjectId', batchSubjectId);
    if (subjectSlug) qs.set('subjectId', subjectSlug);
    if (subjectName) qs.set('subjectName', subjectName);
    navigate(
      `/study/batches/${encodeURIComponent(batchId)}/subjects/${encodeURIComponent(
        subjectId
      )}/subject-topics/${encodeURIComponent(nextSlug)}?${qs.toString()}`
    );
  };

  const handleWatchVideo = (item: Record<string, any>) => {
    const childId = String(item?._id || '');
    if (!childId) {
      toast.error('Video details unavailable.');
      return;
    }
    const isDpp = activeTab === 'DppVideos';
    recordStudyHistory({
      type: isDpp ? 'dpp-video' : 'lecture',
      contentId: childId,
      title: String(item?.topic || item?.videoDetails?.name || item?.name || 'Lecture'),
      watchedAt: new Date().toISOString(),
      teacherIds: asArray(item?.teachers).map(resolveId).filter(Boolean),
      meta: {
        batchId,
        subjectId: subjectSlug,
        duration: Number(item?.videoDetails?.duration || 0),
        route: window.location.pathname + window.location.search,
      },
    });
    const timing = getScheduleTimingState(item);
    openWatchPlayer({
      batchId,
      subjectId: subjectSlug,
      childId,
      type: String(item?.urlType || 'penpencilvdo'),
      videoUrl: String(item?.videoDetails?.videoUrl || item?.url || ''),
      isLocked: Boolean(item?.isLocked),
      topicId,
      isLive: timing.isLive,
    });
  };

  const handleOpenAttachments = async (item: Record<string, any>) => {
    const contentId = String(item?._id || '');
    if (!contentId) return;
    setAttModal({ open: true, loading: true, error: '', schedule: null });
    try {
      const res = await fetchScheduleDetails(batchId, subjectSlug, contentId);
      const sched = res?.data ? { ...res.data, _id: res.data._id || contentId } : item;
      setAttModal({
        open: true,
        loading: false,
        error: '',
        schedule: sched,
      });
    } catch (err: any) {
      setAttModal({
        open: true,
        loading: false,
        error: err?.message || 'Unable to load attachments',
        schedule: item,
      });
    }
  };

  const resolvePdfUrl = async (
    attachment: Record<string, any> | undefined,
    pdfId: string,
    attachmentId?: string
  ) => {
    const fallback =
      attachment?.baseUrl && attachment?.key ? `${attachment.baseUrl}${attachment.key}` : '';
    try {
      const res = await fetchPdfUrl(batchId, subjectSlug, pdfId, attachmentId);
      const pdfObj = res?.data?.data ?? res?.data;
      if (pdfObj?.baseUrl && pdfObj?.key) return `${pdfObj.baseUrl}${pdfObj.key}`;
    } catch {
      // Fallback
    }
    if (fallback) return fallback;
    throw new Error('PDF file not found');
  };

  const handleOpenAttachmentPdf = async (
    attachment: Record<string, any> | undefined,
    pdfId: string,
    title: string,
    isDpp = false,
    download = false
  ) => {
    try {
      const attId = attachment?._id ? String(attachment._id) : undefined;
      const url = await resolvePdfUrl(attachment, pdfId, attId);
      recordStudyHistory({
        type: isDpp ? 'dpp-pdf' : 'note',
        contentId: `${pdfId}-${attId || title}`,
        title,
        watchedAt: new Date().toISOString(),
        url,
      });
      if (download) {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.pdf`;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        setPdfModal({ url, title });
      }
    } catch (err: any) {
      toast.error(err?.message || 'Unable to open PDF');
    }
  };

  // Flatten notes/DppNotes items into NoteCardData
  const flattenedNotes: NoteCardData[] = [];
  if (activeTab === 'notes' || activeTab === 'DppNotes') {
    const isDpp = activeTab === 'DppNotes';
    items.forEach((entry, idx) => {
      const hws = asArray(entry?.homeworkIds);
      if (hws.length > 0) {
        hws.forEach((hw: any, hIdx: number) => {
          const atts = asArray(hw?.attachmentIds);
          if (atts.length > 0) {
            atts.forEach((att: any, aIdx: number) => {
              flattenedNotes.push({
                id: `${entry?._id || idx}-${hw?._id || hIdx}-${att?._id || aIdx}`,
                pdfId: String(entry?._id || hw?._id || ''),
                attachmentId: String(att?._id || ''),
                title: String(att?.name || hw?.topic || entry?.topic || 'Document'),
                dateText: entry?.startTime ? formatDisplayDate(entry.startTime) : undefined,
                isDpp,
                batchId,
                subjectId: subjectSlug,
                attachment: att,
              });
            });
          } else {
            flattenedNotes.push({
              id: `${entry?._id || idx}-${hw?._id || hIdx}`,
              pdfId: String(entry?._id || hw?._id || ''),
              title: String(hw?.topic || hw?.name || entry?.topic || 'Document'),
              dateText: entry?.startTime ? formatDisplayDate(entry.startTime) : undefined,
              isDpp,
              batchId,
              subjectId: subjectSlug,
              attachment: hw,
            });
          }
        });
      } else if (entry?.attachmentIds) {
        asArray(entry.attachmentIds).forEach((att: any, aIdx: number) => {
          flattenedNotes.push({
            id: `${entry?._id || idx}-${att?._id || aIdx}`,
            pdfId: String(entry?._id || ''),
            attachmentId: String(att?._id || ''),
            title: String(att?.name || entry?.topic || 'Document'),
            dateText: entry?.startTime ? formatDisplayDate(entry.startTime) : undefined,
            isDpp,
            batchId,
            subjectId: subjectSlug,
            attachment: att,
          });
        });
      } else {
        flattenedNotes.push({
          id: String(entry?._id || idx),
          pdfId: String(entry?._id || ''),
          title: String(entry?.topic || entry?.name || 'Document'),
          dateText: entry?.startTime ? formatDisplayDate(entry.startTime) : undefined,
          isDpp,
          batchId,
          subjectId: subjectSlug,
          attachment: entry?.attachment || entry,
        });
      }
    });
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-muted/20 pb-12">
      <div className="container mx-auto max-w-[1320px] p-3 sm:p-5">
        <div className="flex flex-col gap-5 lg:flex-row">
          {/* Desktop Left Chapter Selector matching gbstudynexttopper.vercel.app */}
          {chapters.length > 0 && (
            <aside className="hidden w-72 shrink-0 lg:block">
              <div className="sticky top-20 overflow-hidden rounded-xl border bg-background divshadow">
                <div className="border-b px-4 py-3">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                    All Chapters
                  </h2>
                </div>
                <div className="max-h-[72vh] space-y-1 overflow-y-auto p-2">
                  {chapters.map((ch, idx) => {
                    const chSlug = String(ch?.slug || ch?._id || '');
                    const isActive = chSlug === topicId || String(ch?._id || '') === topicId;
                    return (
                      <button
                        key={String(ch?._id || idx)}
                        type="button"
                        onClick={() => handleSelectChapter(chSlug)}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs transition ${
                          isActive
                            ? 'bg-[#7567ee] font-semibold text-white shadow-sm'
                            : 'hover:bg-muted text-foreground'
                        }`}
                      >
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          CH-{String(idx + 1).padStart(2, '0')}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{String(ch?.name || 'Chapter')}</span>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>
          )}

          {/* Main Chapter Content Column */}
          <div className="min-w-0 flex-1 space-y-5">
            {/* Chapter Banner + Mobile Selector + Tabs */}
            <section className="overflow-hidden rounded-xl border bg-background divshadow">
              <div className="bg-[#20262c] bg-[url(/assets/img/descriptionHeader.svg)] bg-cover bg-center px-4 py-5 text-white sm:px-6">
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">
                  {subjectName || 'Topic Content'}
                </p>
                <h1 className="mt-1 text-lg font-bold sm:text-2xl break-words">{currentTitle}</h1>

                {chapters.length > 0 && (
                  <div className="mt-3 lg:hidden">
                    <div className="relative">
                      <select
                        value={topicId}
                        onChange={(e) => handleSelectChapter(e.target.value)}
                        aria-label="Switch chapter"
                        className="h-10 w-full appearance-none rounded-lg border border-white/20 bg-black/30 px-3 pr-8 text-xs font-medium text-white outline-none backdrop-blur-sm"
                      >
                        {chapters.map((ch, idx) => {
                          const slug = String(ch?.slug || ch?._id || '');
                          return (
                            <option key={slug || idx} value={slug} className="bg-background text-foreground">
                              CH-{String(idx + 1).padStart(2, '0')}: {String(ch?.name || 'Chapter')}
                            </option>
                          );
                        })}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-3 h-4 w-4 text-white/80" />
                    </div>
                  </div>
                )}
              </div>

              <div className="no-scrollbar flex items-center gap-2 overflow-x-auto border-t px-3 sm:gap-5 sm:px-6">
                {TABS.map((t) => {
                  const active = activeTab === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setActiveTab(t.key)}
                      className={`whitespace-nowrap px-3 py-3 text-xs sm:text-sm font-medium transition ${
                        active
                          ? 'border-b-4 border-[#7567ee] font-semibold text-[#5a4bda] dark:border-[#3dc280] dark:text-[#29ff94]'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Videos / DPP Videos Tab */}
            {(activeTab === 'videos' || activeTab === 'DppVideos') && (
              <section className="rounded-xl border bg-background p-4 divshadow sm:p-5">
                {loading ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <div key={idx} className="space-y-3 rounded-xl border p-3">
                        <div className="skeleton-shimmer h-40 w-full rounded-lg" />
                        <div className="skeleton-shimmer h-4 w-5/6 rounded" />
                        <div className="skeleton-shimmer h-9 w-full rounded-md" />
                      </div>
                    ))}
                  </div>
                ) : items.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {items.map((vid, idx) => {
                      const rawTeacher = asArray(vid?.teachers)[0];
                      const teacherId = resolveId(rawTeacher);
                      const teacherName =
                        teachersMap[teacherId]?.name ||
                        (typeof rawTeacher === 'object' ? rawTeacher?.name : '') ||
                        '';
                      const thumbUrl =
                        vid?.videoDetails?.image ||
                        teachersMap[teacherId]?.imageUrl ||
                        '/assets/img/video-placeholder.svg';
                      const durationText = formatDuration(Number(vid?.videoDetails?.duration || 0));
                      const dateText = vid?.startTime ? formatDisplayDate(vid.startTime) : '';
                      const title = String(
                        vid?.topic || vid?.videoDetails?.name || vid?.name || 'Lecture Video'
                      );

                      return (
                        <article
                          key={String(vid?._id || idx)}
                          className="divshadow flex flex-col overflow-hidden rounded-xl border bg-background transition hover:shadow-lg"
                        >
                          <div
                            onClick={() => handleWatchVideo(vid)}
                            className="group relative h-44 w-full cursor-pointer overflow-hidden bg-muted/40"
                          >
                            <img
                              src={thumbUrl}
                              alt={title}
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = '/assets/img/video-placeholder.svg';
                              }}
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition group-hover:opacity-100">
                              <span className="grid h-12 w-12 place-items-center rounded-full bg-[#7567ee] text-white shadow-lg">
                                <Play className="h-5 w-5 fill-current" />
                              </span>
                            </div>
                            {durationText && (
                              <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/75 px-2 py-0.5 text-[11px] font-medium text-white">
                                <Clock className="h-3 w-3" />
                                {durationText}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-1 flex-col p-3.5">
                            <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                              <span className="truncate">{teacherName || 'Lecture'}</span>
                              {dateText && <span className="shrink-0">{dateText}</span>}
                            </div>
                            <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold">
                              {title}
                            </h3>

                            <div className="mt-3 flex gap-2 border-t pt-3">
                              <button
                                type="button"
                                onClick={() => handleWatchVideo(vid)}
                                className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-foreground py-2 text-xs font-semibold text-background transition hover:opacity-90"
                              >
                                <Play className="h-3.5 w-3.5 fill-current" />
                                <span>Watch</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleOpenAttachments(vid)}
                                className="flex items-center justify-center gap-1 rounded-md border px-3 py-2 text-xs font-medium transition hover:bg-muted"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                <span>Notes &amp; more</span>
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed p-10 text-center">
                    <FolderOpen className="mx-auto h-7 w-7 text-muted-foreground" />
                    <p className="mt-2 font-semibold">
                      No {activeTab === 'DppVideos' ? 'DPP videos' : 'lectures'} available yet
                    </p>
                  </div>
                )}

                {!loading && hasMore && items.length > 0 && (
                  <div className="mt-6 flex justify-center">
                    <button
                      type="button"
                      disabled={loadingMore}
                      onClick={() => void loadContent(activeTab, page + 1, true)}
                      className="rounded-md bg-foreground px-6 py-2.5 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
                    >
                      {loadingMore ? 'Loading...' : 'Load More'}
                    </button>
                  </div>
                )}

                {!loading && <PoweredByFooter />}
              </section>
            )}

            {/* Notes / DPP PDFs Tab */}
            {(activeTab === 'notes' || activeTab === 'DppNotes') && (
              <section className="rounded-xl border bg-background p-4 divshadow sm:p-5">
                {loading ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <NoteCardSkeleton key={idx} />
                    ))}
                  </div>
                ) : flattenedNotes.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {flattenedNotes.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        onView={() =>
                          void handleOpenAttachmentPdf(
                            note.attachment,
                            note.pdfId,
                            note.title,
                            note.isDpp,
                            false
                          )
                        }
                        onDownload={() =>
                          void handleOpenAttachmentPdf(
                            note.attachment,
                            note.pdfId,
                            note.title,
                            note.isDpp,
                            true
                          )
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed p-10 text-center">
                    <FileText className="mx-auto h-7 w-7 text-muted-foreground" />
                    <p className="mt-2 font-semibold">
                      No {activeTab === 'DppNotes' ? 'DPP PDFs' : 'notes'} uploaded yet
                    </p>
                  </div>
                )}

                {!loading && hasMore && items.length > 0 && (
                  <div className="mt-6 flex justify-center">
                    <button
                      type="button"
                      disabled={loadingMore}
                      onClick={() => void loadContent(activeTab, page + 1, true)}
                      className="rounded-md bg-foreground px-6 py-2.5 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
                    >
                      {loadingMore ? 'Loading...' : 'Load More'}
                    </button>
                  </div>
                )}

                {!loading && <PoweredByFooter />}
              </section>
            )}
          </div>
        </div>
      </div>

      <AttachmentModal
        open={attModal.open}
        loading={attModal.loading}
        error={attModal.error}
        schedule={attModal.schedule}
        batchId={batchId}
        subjectId={subjectSlug}
        onClose={() => setAttModal((prev) => ({ ...prev, open: false }))}
        onOpenPdf={(att, pdfId, title, isDpp) =>
          void handleOpenAttachmentPdf(att, pdfId, title, isDpp, false)
        }
      />

      <PdfViewerModal
        url={pdfModal?.url || null}
        title={pdfModal?.title || ''}
        onClose={() => setPdfModal(null)}
      />
    </div>
  );
}
