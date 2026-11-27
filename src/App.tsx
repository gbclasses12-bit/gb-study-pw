import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeContext';
import { ToastViewport } from './components/Toast';
import { StudyLayout } from './components/StudyLayout';
import { fetchServerInfo } from './lib/api';
import { AuthPage } from './pages/AuthPage';
import { StudyHomePage } from './pages/StudyHomePage';
import { BatchesPage } from './pages/BatchesPage';
import { MyBatchesPage } from './pages/MyBatchesPage';
import { BatchDetailPage } from './pages/BatchDetailPage';
import { SubjectDetailPage } from './pages/SubjectDetailPage';
import { TopicDetailPage } from './pages/TopicDetailPage';
import { HistoryPage } from './pages/HistoryPage';
import { ContactPage } from './pages/ContactPage';

function LayoutShell({
  tgChannel,
  sharedLogin,
}: {
  tgChannel?: string;
  sharedLogin?: boolean;
}) {
  return (
    <StudyLayout tgChannel={tgChannel} sharedLogin={sharedLogin}>
      <Outlet />
    </StudyLayout>
  );
}

export default function App() {
  const [tgChannel, setTgChannel] = useState<string>('https://t.me/GBFreestudy');
  const [sharedLogin, setSharedLogin] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const info = await fetchServerInfo();
      const ch = info?.tg_channel || info?.tgChannel;
      if (!cancelled) {
        if (ch) setTgChannel(ch);
        if (typeof info?.sharedLogin === 'boolean') {
          setSharedLogin(info.sharedLogin);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ThemeProvider>
      <BrowserRouter>
        <ToastViewport />
        <Routes>
          <Route path="/auth" element={<AuthPage />} />

          <Route element={<LayoutShell tgChannel={tgChannel} sharedLogin={sharedLogin} />}>
            <Route path="/study" element={<StudyHomePage />} />
            <Route path="/study/batches" element={<BatchesPage />} />
            <Route path="/study/mybatches" element={<MyBatchesPage />} />
            <Route path="/study/batches/:batchId" element={<BatchDetailPage />} />
            <Route
              path="/study/batches/:batchId/subjects/:subjectId"
              element={<SubjectDetailPage />}
            />
            <Route
              path="/study/batches/:batchId/subjects/:subjectId/subject-topics/:topicId"
              element={<TopicDetailPage />}
            />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/contact" element={<ContactPage tgChannel={tgChannel} />} />
          </Route>

          <Route path="/" element={<Navigate to="/study/batches" replace />} />
          <Route path="*" element={<Navigate to="/study/batches" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
