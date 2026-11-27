import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import {
  BatchItem,
  fetchAllBatches,
  formatDisplayDate,
  searchBatches,
} from '../lib/api';
import { BatchCard } from '../components/BatchCard';
import { Carousel } from '../components/Carousel';
import { PoweredByFooter } from '../components/PoweredByFooter';
import { toast } from '../components/Toast';

const PROMO_SLIDES = [
  {
    src: 'https://static.pw.live/5eb393ee95fab7468a79d189/ADMIN/2cd05c71-3897-4e88-9c73-3e307e0dde03.jpg',
    alt: 'Featured Study Batch 1',
  },
  {
    src: 'https://static.pw.live/5eb393ee95fab7468a79d189/ADMIN/4f17deae-eab1-4b19-b5cb-2bb2291d60e5.jpg',
    alt: 'Featured Study Batch 2',
  },
  {
    src: 'https://static.pw.live/5eb393ee95fab7468a79d189/ADMIN/afeb7785-0e5e-4fc9-95e7-57b328032009.jpg',
    alt: 'Featured Study Batch 3',
  },
];

function normalizeBatch(raw: any): BatchItem {
  return {
    _id: String(raw?._id || raw?.id || ''),
    batchId: String(raw?.batchId || raw?._id || ''),
    batchName: String(raw?.batchName || raw?.name || ''),
    batchImage: String(raw?.batchImage || raw?.previewImage || ''),
    language: String(raw?.language || ''),
    template: String(raw?.template || raw?.type || 'NORMAL'),
    startDate: String(raw?.startDate || ''),
    endDate: String(raw?.endDate || ''),
    batchPrice: Number(raw?.batchPrice ?? raw?.feeTotal ?? 0),
    byName: String(raw?.byName || ''),
  };
}

export function BatchesPage() {
  const [searchParams] = useSearchParams();
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const toastMsg = searchParams.get('toast');
    if (toastMsg) {
      toast.error(decodeURIComponent(toastMsg));
    }
  }, [searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setPage(1);
    setBatches([]);
    setLoading(true);
  }, [debouncedQuery]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const isSearch = debouncedQuery.trim() !== '';
        const res = isSearch
          ? await searchBatches(debouncedQuery.trim(), page)
          : await fetchAllBatches(page);
        if (cancelled) return;
        const list = (res?.data || res?.batches || []).map(normalizeBatch);
        const curPage = Number(res?.currentPage || res?.page || page);
        const totalPages = Number(res?.totalPages || 1);
        setBatches((prev) => (page === 1 ? list : [...prev, ...list]));
        setHasMore(curPage < totalPages);
      } catch {
        if (cancelled) return;
        toast.error('Failed to load batches');
        if (page === 1) setBatches([]);
        setHasMore(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, page]);

  const visibleBatches = batches.filter(
    (b) => !b.template || b.template === 'NORMAL'
  );

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="bg-background border rounded-lg p-4 sm:p-6">
        <h1 className="text-2xl font-semibold mb-4">Batches</h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setDebouncedQuery(query);
            setPage(1);
          }}
          className="divshadow flex flex-wrap items-center gap-3 sm:gap-5"
        >
          <div className="relative w-full">
            <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3">
              <Search strokeWidth={3} className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Your Batch"
              className="divshadow block w-full rounded-md border bg-foreground/10 p-4 ps-10 pe-24 text-sm outline-none focus:outline-none"
            />
            <button
              type="submit"
              className="absolute bottom-2.5 end-2.5 rounded-lg bg-green-400 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 dark:bg-green-500 dark:hover:bg-green-600 transition-colors"
            >
              Search
            </button>
          </div>
        </form>

        <Carousel slides={PROMO_SLIDES} />

        {loading && page === 1 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {Array.from({ length: 6 }).map((_, idx) => (
              <BatchCard key={idx} isPlaceholder />
            ))}
          </div>
        ) : visibleBatches.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
              {visibleBatches.map((batch) => (
                <BatchCard
                  key={batch._id || batch.batchId}
                  id={batch.batchId}
                  title={batch.batchName}
                  image={batch.batchImage}
                  type={batch.language}
                  startDate={formatDisplayDate(batch.startDate)}
                  endDate={formatDisplayDate(batch.endDate)}
                  price={
                    typeof batch.batchPrice === 'number'
                      ? batch.batchPrice.toFixed(0)
                      : '0'
                  }
                  forText={batch.byName || ''}
                />
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-6">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => !loading && hasMore && setPage((p) => p + 1)}
                  className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}

            <PoweredByFooter />
          </>
        ) : (
          <p className="text-center mt-8 text-sm text-muted-foreground">
            No batches found.
          </p>
        )}
      </div>
    </div>
  );
}
