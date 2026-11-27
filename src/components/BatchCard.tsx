import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookmarkPlus, CalendarCheck2, GraduationCap, PinOff, UserCheck } from 'lucide-react';
import {
  enrollBatchApi,
  getLocalEnrolledBatches,
  setLocalEnrolledBatches,
  unenrollBatchApi,
} from '../lib/api';
import { toast } from './Toast';

interface BatchCardProps {
  id?: string;
  title?: string;
  type?: string;
  image?: string;
  startDate?: string;
  endDate?: string;
  price?: string;
  forText?: string;
  isPlaceholder?: boolean;
}

export function BatchCard({
  id = '',
  title = '',
  type = '',
  image,
  startDate = '',
  endDate = '',
  price = '',
  forText = '',
  isPlaceholder = false,
}: BatchCardProps) {
  const navigate = useNavigate();
  const [enrolled, setEnrolled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sync = () => {
      const list = getLocalEnrolledBatches();
      setEnrolled(list.some((item) => item.batchId === id));
    };
    sync();
    window.addEventListener('batchesUpdated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('batchesUpdated', sync);
      window.removeEventListener('storage', sync);
    };
  }, [id]);

  if (isPlaceholder) {
    return (
      <article
        aria-hidden="true"
        className="overflow-hidden rounded-xl border bg-background p-4"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="skeleton-shimmer h-5 w-3/5 rounded" />
          <div className="skeleton-shimmer h-6 w-12 rounded" />
        </div>
        <div className="skeleton-shimmer mt-4 aspect-video w-full rounded-lg" />
        <div className="mt-4 space-y-3">
          <div className="skeleton-shimmer h-4 w-2/5 rounded" />
          <div className="skeleton-shimmer h-4 w-4/5 rounded" />
          <div className="flex items-center justify-between gap-3">
            <div className="skeleton-shimmer h-5 w-20 rounded" />
            <div className="skeleton-shimmer h-5 w-28 rounded" />
          </div>
          <div className="flex gap-2 pt-1">
            <div className="skeleton-shimmer h-10 flex-1 rounded-md" />
            <div className="skeleton-shimmer h-10 flex-1 rounded-md" />
          </div>
        </div>
      </article>
    );
  }

  const imageSrc = image || '/assets/img/video-placeholder.svg';

  const handleEnroll = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await enrollBatchApi(id, title);
      if (res?.success === false) {
        toast.error(res?.message || 'Failed to enroll. Please try again.');
        return;
      }
    } catch {
      // Allow local enrollment fallback if already entitled
    } finally {
      setBusy(false);
    }

    const current = getLocalEnrolledBatches();
    if (!current.some((item) => item.batchId === id)) {
      const numPrice = Number(price);
      current.push({
        batchId: id,
        name: title,
        batchName: title,
        batchImage: imageSrc,
        language: type,
        startDate,
        endDate,
        batchPrice: Number.isFinite(numPrice) ? numPrice : 0,
        byName: forText,
      });
      setLocalEnrolledBatches(current);
    }
    setEnrolled(true);
    toast.success(`You've successfully enrolled in "${title}".`);
  };

  const handleUnenroll = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await unenrollBatchApi(id, title);
      if (res?.success === false) {
        toast.error(res?.message || 'Failed to unenroll. Please try again.');
        return;
      }
    } catch {
      // Continue syncing local state
    } finally {
      setBusy(false);
    }

    const updated = getLocalEnrolledBatches().filter((item) => item.batchId !== id);
    setLocalEnrolledBatches(updated);
    try {
      const selected = JSON.parse(localStorage.getItem('selectedBatch') || 'null');
      if (selected?.batchId === id) {
        localStorage.removeItem('selectedBatch');
      }
    } catch {
      // Ignore
    }
    setEnrolled(false);
    toast.success(`You have been unenrolled from "${title}".`);
  };

  return (
    <article className="border rounded-xl overflow-hidden hover:shadow-lg dark:border-gray-700 transition-shadow bg-white dark:bg-gray-900 flex flex-wrap">
      <div className="p-4 pb-0 gap-1 space-y-3 relative flex items-center justify-between w-full">
        <h2
          onClick={() => navigate(`/study/batches/${encodeURIComponent(id)}`)}
          className="line-clamp-2 text-lg font-bold cursor-pointer hover:text-[#5a4bda] dark:hover:text-[#29ff94] transition-colors"
          title={title}
        >
          {title}
        </h2>
        <div className="items-center !m-0 shrink-0">
          <span className="bg-yellow-400 text-black text-xs px-2 py-1 rounded font-medium">
            New
          </span>
        </div>
      </div>

      <div className="w-full p-4 flex flex-wrap justify-between">
        <div
          onClick={() => navigate(`/study/batches/${encodeURIComponent(id)}`)}
          className="w-full rounded-lg overflow-hidden relative cursor-pointer bg-muted/30"
        >
          <img
            src={imageSrc}
            alt={title}
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/assets/img/video-placeholder.svg';
            }}
            className="w-full aspect-video object-contain"
          />
          <div className="absolute bottom-2 left-2 z-10">
            <span className="rounded-md bg-pink-500/70 dark:text-white dark:bg-green-500/80 px-2 py-1 text-xs font-medium text-white ring-1 ring-pink-700/10 ring-inset">
              {type || 'Hinglish'}
            </span>
          </div>
        </div>

        <div className="pt-3 space-y-3 w-full">
          {forText && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <UserCheck className="w-4 h-4 shrink-0" />
              <span className="text-xs font-semibold text-foreground truncate">{forText}</span>
            </div>
          )}

          <div className="flex items-center gap-1 text-muted-foreground text-xs flex-wrap">
            <CalendarCheck2 className="w-4 h-4 shrink-0" />
            <span>Starts on</span>
            <span className="text-xs font-semibold text-foreground">{startDate || 'Ongoing'}</span>
            <span>| Ends on</span>
            <span className="text-xs font-semibold text-foreground">{endDate || 'Exam End'}</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-base sm:text-lg font-bold text-green-600 dark:text-green-400">
                ₹ FREE
              </span>
              {price && Number(price) > 0 && (
                <span className="text-xs text-muted-foreground line-through ml-2">
                  ₹{price}
                </span>
              )}
            </div>
            <span className="text-xs bg-green-50 dark:bg-green-500 text-green-600 dark:text-white px-2 py-1 rounded">
              100% Free For Students
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate(`/study/batches/${encodeURIComponent(id)}`)}
              className="inline-flex h-10 px-4 py-2 items-center justify-center rounded-md border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors flex-1 min-w-[120px] whitespace-nowrap"
            >
              <GraduationCap className="w-4 h-4 mr-2" />
              Study
            </button>

            {enrolled ? (
              <button
                type="button"
                disabled={busy}
                onClick={handleUnenroll}
                className="inline-flex h-10 px-4 py-2 items-center justify-center rounded-md text-xs sm:text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors flex-1 min-w-[120px] whitespace-nowrap disabled:opacity-60"
              >
                <PinOff className="mr-1 w-4 h-4" />
                Unenroll
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={handleEnroll}
                className="inline-flex h-10 px-4 py-2 items-center justify-center rounded-md text-xs sm:text-sm font-medium bg-green-400 text-white hover:bg-green-600 dark:bg-green-500 dark:hover:bg-green-600 transition-colors flex-1 min-w-[120px] whitespace-nowrap disabled:opacity-60"
              >
                Enroll Now
                <BookmarkPlus className="ml-1 w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
