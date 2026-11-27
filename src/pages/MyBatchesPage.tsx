import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BatchItem,
  fetchAboutMe,
  fetchBatchInfo,
  formatDisplayDate,
  getLocalEnrolledBatches,
  setLocalEnrolledBatches,
} from '../lib/api';
import { BatchCard } from '../components/BatchCard';
import { PoweredByFooter } from '../components/PoweredByFooter';

export function MyBatchesPage() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetchAboutMe();
        const serverEnrolled: any[] = res?.enrolledBatches || [];
        if (serverEnrolled.length === 0) {
          const local = getLocalEnrolledBatches();
          if (!cancelled) setBatches(local);
          return;
        }

        const hydrated = await Promise.all(
          serverEnrolled.map(async (item) => {
            try {
              const info = await fetchBatchInfo(item.batchId, 'details');
              const d = info?.data || {};
              const img =
                d.iosPreviewImageUrl ||
                (d.previewImage?.baseUrl && d.previewImage?.key
                  ? `${d.previewImage.baseUrl}${d.previewImage.key}`
                  : '/assets/img/defaultSubject.svg');
              return {
                _id: item._id,
                batchId: item.batchId,
                batchName: item.name || d.batchName || 'Untitled Batch',
                name: item.name || d.batchName || 'Untitled Batch',
                batchImage: img,
                startDate: d.startDate,
                endDate: d.endDate,
                language: d.language,
                batchPrice: d.batchPrice,
                byName: d.byName,
              } as BatchItem;
            } catch {
              return {
                _id: item._id,
                batchId: item.batchId,
                batchName: item.name || 'Enrolled Batch',
                name: item.name || 'Enrolled Batch',
                batchImage: '/assets/img/defaultSubject.svg',
              } as BatchItem;
            }
          })
        );

        if (!cancelled) {
          setBatches(hydrated);
          setLocalEnrolledBatches(hydrated);
        }
      } catch (err: any) {
        if (!cancelled) {
          const fallback = getLocalEnrolledBatches();
          setBatches(fallback);
          if (fallback.length === 0) {
            setError(err?.message || 'Failed to load enrolled batches.');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="bg-background border rounded-lg p-4 sm:p-6">
        <h1 className="text-2xl font-semibold mb-4">My Batches</h1>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {Array.from({ length: 3 }).map((_, idx) => (
              <BatchCard key={idx} isPlaceholder />
            ))}
          </div>
        ) : batches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {batches.map((b) => (
              <BatchCard
                key={b.batchId}
                id={b.batchId}
                title={b.batchName}
                image={b.batchImage}
                type={b.language}
                startDate={formatDisplayDate(b.startDate)}
                endDate={formatDisplayDate(b.endDate)}
                price={
                  typeof b.batchPrice === 'number' ? b.batchPrice.toFixed(0) : '0'
                }
                forText={b.byName || ''}
              />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center space-y-3">
            <p className="text-base font-semibold">No enrolled batches yet</p>
            <p className="text-sm text-muted-foreground">
              Explore batches and enroll in any batch for free to start learning.
            </p>
            <button
              type="button"
              onClick={() => navigate('/study/batches')}
              className="mt-2 inline-flex h-10 items-center justify-center rounded-md bg-green-400 px-5 text-sm font-medium text-white hover:bg-green-600 dark:bg-green-500 transition-colors"
            >
              Browse Batches
            </button>
          </div>
        )}

        {!loading && <PoweredByFooter />}
      </div>
    </div>
  );
}
