const RETRYABLE_STATUSES = new Set([500, 503]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  let attempt = 0;
  for (;;) {
    const res = await fetch(input, {
      ...init,
      credentials: 'include',
    });

    if (res.status === 401 && window.location.pathname !== '/auth') {
      window.location.href = '/auth';
      return new Promise<Response>(() => {});
    }

    if (!RETRYABLE_STATUSES.has(res.status) || attempt >= 2) {
      return res;
    }

    attempt += 1;
    await sleep(400 * attempt);
  }
}

export interface ServerInfo {
  webName?: string;
  sidebarTitle?: string;
  sidebarLogoUrl?: string;
  tg_channel?: string;
  tgChannel?: string;
  tg_username?: string;
  tg_bot?: string;
  directLogin?: boolean;
  maintenanceMode?: boolean;
  sharedLogin?: boolean;
}

export interface BatchItem {
  _id?: string;
  batchId: string;
  batchName: string;
  name?: string;
  batchImage?: string;
  language?: string;
  template?: string;
  startDate?: string;
  endDate?: string;
  batchPrice?: number;
  byName?: string;
}

export interface StudyHistoryItem {
  _id?: string;
  type: 'lecture' | 'note' | 'dpp-pdf' | 'dpp-video';
  contentId: string;
  title: string;
  watchedAt: string;
  url?: string;
  teacherIds?: string[];
  meta?: {
    route?: string;
    duration?: number;
    batchId?: string;
    subjectId?: string;
    schedule?: Record<string, unknown>;
  };
}

export async function fetchServerInfo(): Promise<ServerInfo | null> {
  try {
    const res = await fetch('/api/auth/serverInfo', { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchAllBatches(page = 1) {
  const res = await apiFetch(`/api/AllBatches?page=${encodeURIComponent(String(page))}`);
  if (!res.ok) throw new Error('Failed to fetch batches');
  return res.json();
}

export async function searchBatches(name: string, page = 1) {
  const res = await apiFetch(
    `/api/searchBatch?name=${encodeURIComponent(name)}&page=${encodeURIComponent(String(page))}`
  );
  if (!res.ok) throw new Error('Failed to search batches');
  return res.json();
}

export async function fetchBatchInfo(batchId: string, type: 'details' | 'announcement', page?: number) {
  let url = `/api/BatchInfo?BatchId=${encodeURIComponent(batchId)}&Type=${encodeURIComponent(type)}`;
  if (type === 'announcement' && page !== undefined) {
    url += `&page=${encodeURIComponent(String(page))}`;
  }
  const res = await apiFetch(url);
  if (!res.ok) throw new Error('Failed to fetch batch details');
  return res.json();
}

export async function fetchSubjectInfo(batchId: string, subjectId: string, page = 1) {
  const url = `/api/SubjectInfo?BatchId=${encodeURIComponent(batchId)}&SubjectId=${encodeURIComponent(subjectId)}&page=${encodeURIComponent(String(page))}`;
  const res = await apiFetch(url);
  if (!res.ok) throw new Error('Failed to load chapters');
  return res.json();
}

export async function fetchTopicInfo(
  batchId: string,
  subjectId: string,
  topicId: string,
  contentType: string,
  page = 1
) {
  const url = `/api/TopicInfo?BatchId=${encodeURIComponent(batchId)}&SubjectId=${encodeURIComponent(subjectId)}&TopicId=${encodeURIComponent(topicId)}&ContentType=${encodeURIComponent(contentType)}&page=${encodeURIComponent(String(page))}`;
  const res = await apiFetch(url);
  if (!res.ok) throw new Error('Failed to fetch topic content');
  return res.json();
}

export async function fetchPdfUrl(
  batchId: string,
  subjectId: string,
  pdfId: string,
  attachmentId?: string
) {
  const params = new URLSearchParams({
    BatchId: batchId,
    SubjectId: subjectId,
    PdfId: pdfId,
  });
  if (attachmentId) {
    params.set('AttachmentId', attachmentId);
  }
  const res = await apiFetch(`/api/GetPdf?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch PDF');
  return res.json();
}

export async function fetchScheduleDetails(batchId: string, subjectId: string, contentId: string) {
  const params = new URLSearchParams({
    BatchId: batchId,
    SubjectId: subjectId,
    ContentId: contentId,
  });
  const res = await apiFetch(`/api/Schedule?${params.toString()}`);
  if (!res.ok) throw new Error('Unable to load lecture attachments');
  return res.json();
}

export async function fetchTodaysSchedule(batchId: string) {
  const res = await apiFetch('/api/todays-schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batchId }),
  });
  if (!res.ok) throw new Error("Failed to load today's classes");
  return res.json();
}

export async function fetchTeacherDetails(ids: string[]) {
  if (ids.length === 0) return { data: [] };
  const res = await apiFetch('/api/get-user-details-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idsParam: ids.join(',') }),
  });
  if (!res.ok) throw new Error('Failed to get teacher details');
  return res.json();
}

export async function fetchAboutMe() {
  const res = await apiFetch('/api/AboutMe', { method: 'GET' });
  if (!res.ok) throw new Error('Failed to fetch enrolled batches');
  const data = await res.json();
  if (!Array.isArray(data?.enrolledBatches)) {
    return { ...data, enrolledBatches: [] };
  }
  return data;
}

export async function enrollBatchApi(batchId: string, name: string) {
  const res = await apiFetch('/api/enrollBatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batchId, name }),
  });
  if (!res.ok) throw new Error('Failed to enroll batch');
  return res.json();
}

export async function unenrollBatchApi(batchId: string, name: string) {
  const res = await apiFetch('/api/UnenrollBatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batchId, name }),
  });
  if (!res.ok) throw new Error('Failed to unenroll batch');
  return res.json();
}

export async function logoutApi() {
  try {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
  } catch {
    // Ignore
  }
  try {
    localStorage.removeItem('USER_DATA');
  } catch {
    // Ignore
  }
}

export function getLocalEnrolledBatches(): BatchItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem('enrolledBatches') || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function setLocalEnrolledBatches(batches: BatchItem[]) {
  try {
    localStorage.setItem('enrolledBatches', JSON.stringify(batches));
    window.dispatchEvent(new Event('batchesUpdated'));
  } catch {
    // Ignore
  }
}

export function recordStudyHistory(item: StudyHistoryItem) {
  try {
    const raw = JSON.parse(localStorage.getItem('studyHistory') || '[]');
    const list: StudyHistoryItem[] = Array.isArray(raw) ? raw : [];
    const filtered = list.filter(
      (entry) => !(entry.type === item.type && entry.contentId === item.contentId)
    );
    const updated = [item, ...filtered].slice(0, 120);
    localStorage.setItem('studyHistory', JSON.stringify(updated));
    window.dispatchEvent(new Event('studyHistoryUpdated'));
  } catch {
    // Ignore
  }
}

export function getStudyHistory(): StudyHistoryItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem('studyHistory') || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function clearStudyHistory() {
  try {
    localStorage.removeItem('studyHistory');
    window.dispatchEvent(new Event('studyHistoryUpdated'));
  } catch {
    // Ignore
  }
}

export function formatDisplayDate(input?: string): string {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function getScheduleTimingState(schedule: Record<string, any>) {
  const status = String(schedule?.status || '').toUpperCase();
  const isCancelled = status === 'CANCELLED' || status === 'CANCELED';
  const now = Date.now();
  const start = schedule?.startTime ? new Date(schedule.startTime).getTime() : NaN;
  const end = schedule?.endTime ? new Date(schedule.endTime).getTime() : NaN;
  const isLive =
    !isCancelled &&
    (status === 'LIVE' ||
      (Number.isFinite(start) && Number.isFinite(end) && now >= start && now <= end));
  const isUpcoming =
    !isCancelled && !isLive && Number.isFinite(start) && start > now;
  return { isCancelled, isLive, isUpcoming };
}

export function openWatchPlayer(params: {
  batchId: string;
  subjectId: string;
  childId: string;
  type?: string;
  videoUrl?: string;
  isLocked?: boolean;
  topicId?: string;
  isLive?: boolean;
}) {
  const videoType = params.type || 'penpencilvdo';
  const useLivePlayer = Boolean(params.isLive) && videoType.toLowerCase() !== 'youtube';

  const qs = new URLSearchParams({
    batchId: params.batchId,
    SubjectId: params.subjectId || 'subject',
    ChildId: params.childId,
  });

  if (useLivePlayer) {
    if (params.topicId) qs.set('topicId', params.topicId);
    window.location.assign(`/live?${qs.toString()}`);
    return;
  }

  qs.set('Type', videoType);
  if (params.videoUrl) qs.set('VideoUrl', params.videoUrl);
  if (params.isLocked !== undefined) qs.set('isLocked', String(params.isLocked));
  if (params.topicId) qs.set('topicId', params.topicId);
  window.location.assign(`/watch?${qs.toString()}`);
}
