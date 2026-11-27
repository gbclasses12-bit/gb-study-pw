import { Link } from 'react-router-dom';
import {
  BookOpen,
  Clock,
  ExternalLink,
  Layers,
  Send,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Zap,
} from 'lucide-react';

interface ContactPageProps {
  tgChannel?: string;
}

export function ContactPage({ tgChannel }: ContactPageProps) {
  const channelUrl = tgChannel || 'https://t.me/GBFreestudy';

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-muted/20 pb-12">
      <div className="container mx-auto max-w-[1000px] space-y-6 p-3 sm:p-6">
        {/* Intro Card matching gbstudynexttopper.vercel.app */}
        <section className="overflow-hidden rounded-2xl border bg-background divshadow">
          <div className="bg-[#20262c] bg-[url(/assets/img/descriptionHeader.svg)] bg-cover bg-center p-6 text-white sm:p-8">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-white p-1 shadow-md">
                <img
                  src="/gb-study-icon.png"
                  alt="GB STUDY"
                  className="h-full w-full rounded-full object-cover"
                />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/75">
                  Student Support &amp; Updates
                </p>
                <h1 className="text-2xl font-bold sm:text-3xl">GB STUDY</h1>
              </div>
            </div>
            <p className="mt-4 max-w-2xl text-sm text-white/85">
              100% Free learning platform providing smooth access to batches, recorded lectures,
              live schedules, PDF notes, and DPPs with automatic 24-hour key verification.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-xl border bg-muted/20 p-3.5">
              <ShieldCheck className="h-5 w-5 shrink-0 text-[#5a4bda] dark:text-[#29ff94]" />
              <div>
                <p className="text-sm font-semibold">Secure</p>
                <p className="text-xs text-muted-foreground">Auto-verified 24h access</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border bg-muted/20 p-3.5">
              <Zap className="h-5 w-5 shrink-0 text-[#5a4bda] dark:text-[#29ff94]" />
              <div>
                <p className="text-sm font-semibold">Reliable</p>
                <p className="text-xs text-muted-foreground">Fast lectures &amp; notes delivery</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border bg-muted/20 p-3.5">
              <Sparkles className="h-5 w-5 shrink-0 text-[#5a4bda] dark:text-[#29ff94]" />
              <div>
                <p className="text-sm font-semibold">Responsive</p>
                <p className="text-xs text-muted-foreground">Light, Dark &amp; Mobile ready</p>
              </div>
            </div>
          </div>
        </section>

        {/* Official Telegram Channel */}
        <section className="rounded-2xl border bg-background p-5 divshadow sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-sky-500/15 text-sky-500">
                <Send className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Official Telegram Channel</h2>
                <p className="text-sm text-muted-foreground">
                  Join our community for batch updates, announcements, and instant support.
                </p>
              </div>
            </div>
            <a
              href={channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#5a4bda] px-5 text-sm font-semibold text-white transition hover:bg-[#493bc8]"
            >
              <span>Join Telegram</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </section>

        {/* Quick Resources & Links */}
        <section className="rounded-2xl border bg-background p-5 divshadow sm:p-6">
          <h2 className="mb-4 text-lg font-bold">Resources &amp; Quick Links</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link
              to="/study"
              className="flex items-center gap-3 rounded-xl border p-3.5 transition hover:border-[#7567ee]/60 hover:bg-muted/30"
            >
              <BookOpen className="h-5 w-5 text-[#5a4bda] dark:text-[#29ff94]" />
              <div>
                <p className="text-sm font-semibold">Study Home</p>
                <p className="text-xs text-muted-foreground">Today&apos;s classes &amp; quick study</p>
              </div>
            </Link>
            <Link
              to="/study/batches"
              className="flex items-center gap-3 rounded-xl border p-3.5 transition hover:border-[#7567ee]/60 hover:bg-muted/30"
            >
              <Layers className="h-5 w-5 text-[#5a4bda] dark:text-[#29ff94]" />
              <div>
                <p className="text-sm font-semibold">All Batches</p>
                <p className="text-xs text-muted-foreground">Search and enroll in any batch</p>
              </div>
            </Link>
            <Link
              to="/study/mybatches"
              className="flex items-center gap-3 rounded-xl border p-3.5 transition hover:border-[#7567ee]/60 hover:bg-muted/30"
            >
              <UserCheck className="h-5 w-5 text-[#5a4bda] dark:text-[#29ff94]" />
              <div>
                <p className="text-sm font-semibold">My Batches</p>
                <p className="text-xs text-muted-foreground">Jump back into your enrolled courses</p>
              </div>
            </Link>
            <Link
              to="/history"
              className="flex items-center gap-3 rounded-xl border p-3.5 transition hover:border-[#7567ee]/60 hover:bg-muted/30"
            >
              <Clock className="h-5 w-5 text-[#5a4bda] dark:text-[#29ff94]" />
              <div>
                <p className="text-sm font-semibold">Study History</p>
                <p className="text-xs text-muted-foreground">Resume lectures and PDFs</p>
              </div>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
