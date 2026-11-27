import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BookOpen, ChevronRight } from 'lucide-react';
import { fetchSubjectInfo } from '../lib/api';
import { PoweredByFooter } from '../components/PoweredByFooter';

export function SubjectDetailPage() {
  const { batchId = '', subjectId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const subjectSlug = searchParams.get('subjectId') || subjectId;
  const batchSubjectId = searchParams.get('batchSubjectId') || '';
  const subjectNameParam = searchParams.get('subjectName') || '';

  const [chapters, setChapters] = useState<Record<string, any>[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const decodedTitle =
    subjectNameParam ||
    decodeURIComponent(subjectId)
      .replace(/-\d+$/, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const loadChapters = async (pageNum: number, append: boolean) => {
    if (!batchId || !subjectSlug) return;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');
    try {
      const res = await fetchSubjectInfo(batchId, subjectSlug, pageNum);
      const list = Array.isArray(res?.data) ? res.data : [];
      setChapters((prev) => (append ? [...prev, ...list] : list));
      setPage(pageNum);
      setHasMore(list.length >= 20);
    } catch (err: any) {
      setError(err?.message || 'Unable to load chapters.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    void loadChapters(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, subjectSlug]);

  const openChapter = (chapter: Record<string, any>) => {
    const topicSlug = String(chapter?.slug || chapter?._id || '');
    const qs = new URLSearchParams();
    if (batchSubjectId) qs.set('batchSubjectId', batchSubjectId);
    if (subjectSlug) qs.set('subjectId', subjectSlug);
    if (chapter?._id) qs.set('topicId', String(chapter._id));
    qs.set('subjectName', decodedTitle);
    navigate(
      `/study/batches/${encodeURIComponent(batchId)}/subjects/${encodeURIComponent(
        subjectId
      )}/subject-topics/${encodeURIComponent(topicSlug)}?${qs.toString()}`
    );
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-muted/20 pb-12">
      <div className="container mx-auto max-w-[1180px] space-y-5 p-3 sm:p-6">
        <header className="rounded-xl border bg-background px-5 py-4 divshadow sm:px-6">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#7567ee] dark:text-[#29ff94]">
            Subject Chapters
          </p>
          <h1 className="mt-1 text-xl font-bold sm:text-2xl">{decodedTitle}</h1>
        </header>

        {error && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        <section className="rounded-xl border bg-background p-4 divshadow sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Chapters</h2>
            {!loading && (
              <span className="rounded-full bg-[#7567ee]/10 px-3 py-1 text-xs font-semibold text-[#5a4bda] dark:bg-[#29ff94]/10 dark:text-[#29ff94]">
                {chapters.length} Chapters
              </span>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="space-y-3 rounded-xl border p-4">
                  <div className="skeleton-shimmer h-5 w-3/4 rounded" />
                  <div className="skeleton-shimmer h-3 w-1/2 rounded" />
                </div>
              ))}
            </div>
          ) : chapters.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {chapters.map((chapter, idx) => {
                const videos = chapter?.videos ?? chapter?.lectureVideos ?? 0;
                const exercises = chapter?.exercises ?? 0;
                const notes = chapter?.notes ?? 0;
                return (
                  <button
                    key={String(chapter?._id || idx)}
                    type="button"
                    onClick={() => openChapter(chapter)}
                    className="divshadow group flex items-center justify-between gap-3 rounded-xl border bg-background p-4 text-left transition hover:-translate-y-0.5 hover:border-[#7567ee]/60"
                  >
                    <div className="min-w-0 flex-1 border-l-4 border-indigo-400 pl-3 dark:border-[#29ff94]">
                      <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        CH - {String(idx + 1).padStart(2, '0')}
                      </div>
                      <h3 className="truncate text-sm font-semibold sm:text-base">
                        {String(chapter?.name || 'Untitled Chapter')}
                      </h3>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {videos} Videos &nbsp;|&nbsp; {exercises} Exercises &nbsp;|&nbsp; {notes} Notes
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <BookOpen className="mx-auto h-7 w-7 text-[#7567ee]" />
              <p className="mt-2 font-semibold">No chapters uploaded yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Chapters will appear here as classes begin.
              </p>
            </div>
          )}

          {!loading && hasMore && chapters.length > 0 && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void loadChapters(page + 1, true)}
                className="rounded-md bg-foreground px-6 py-2.5 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
              >
                {loadingMore ? 'Loading...' : 'Load More Chapters'}
              </button>
            </div>
          )}

          {!loading && <PoweredByFooter />}
        </section>
      </div>
    </div>
  );
}
