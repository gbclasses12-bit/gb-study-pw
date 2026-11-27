import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, MessageSquare, ShieldCheck, Smartphone } from 'lucide-react';
import { toast } from '../components/Toast';
import { useTheme } from '../components/ThemeContext';
import { Moon, Sun, Monitor } from 'lucide-react';

export function AuthPage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [sendingChannel, setSendingChannel] = useState<'sms' | 'whatsapp' | null>(null);
  const [resending, setResending] = useState(false);
  const [smsType, setSmsType] = useState<'0' | '1'>('0');
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/serverInfo', { cache: 'no-store' });
        if (!res.ok) return;
        const info = await res.json();
        if (!cancelled && info?.sharedLogin) {
          navigate('/study/batches', { replace: true });
        }
      } catch {
        // Ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = window.setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [countdown]);

  useEffect(() => {
    if (step === 'otp') {
      window.setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  const sendOtp = async (channelType: '0' | '1') => {
    const cleaned = phone.trim().replace(/\D/g, '');
    if (!/^[6-9][0-9]{9}$/.test(cleaned)) {
      const msg = 'Please enter a valid 10-digit mobile number.';
      setError(msg);
      toast.error(msg);
      return;
    }

    setError('');
    setLoading(true);
    setSendingChannel(channelType === '1' ? 'whatsapp' : 'sms');
    setSmsType(channelType);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: cleaned,
          smsType: channelType,
          fallback: 'false',
        }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        const msg = data?.message || 'Failed to send OTP. Please try again.';
        setError(msg);
        toast.error(msg);
        return;
      }

      toast.success(
        data?.message || `OTP sent via ${channelType === '1' ? 'WhatsApp' : 'SMS'}!`
      );
      setStep('otp');
      setOtpDigits(['', '', '', '', '', '']);
      setCountdown(30);
    } catch {
      const msg = 'Failed to connect to server. Please check your network and try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      setSendingChannel(null);
    }
  };

  const resendOtp = async (channelType: '0' | '1') => {
    if (countdown > 0 || resending) return;
    const cleaned = phone.trim().replace(/\D/g, '');
    if (!cleaned) return;
    setResending(true);
    setError('');

    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: cleaned,
          smsType: channelType,
          fallback: 'false',
        }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        const msg = data?.message || 'Failed to resend OTP.';
        setError(msg);
        toast.error(msg);
        return;
      }

      toast.success(
        data?.message || `OTP resent via ${channelType === '1' ? 'WhatsApp' : 'SMS'}!`
      );
      setSmsType(channelType);
      setCountdown(30);
      setOtpDigits(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } catch {
      toast.error('Error resending OTP. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const digitsOnly = value.replace(/\D/g, '');
    if (!digitsOnly) {
      const next = [...otpDigits];
      next[index] = '';
      setOtpDigits(next);
      return;
    }
    const next = [...otpDigits];
    next[index] = digitsOnly.slice(-1);
    setOtpDigits(next);
    if (error) setError('');
    if (index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        const next = [...otpDigits];
        next[index - 1] = '';
        setOtpDigits(next);
        otpRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < 6; i++) {
      next[i] = pasted[i] || '';
    }
    setOtpDigits(next);
    if (error) setError('');
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || verified) return;
    const cleaned = phone.trim().replace(/\D/g, '');
    const otp = otpDigits.join('');
    if (otp.length < 6) {
      const msg = 'Please enter the complete 6-digit verification code.';
      setError(msg);
      toast.error(msg);
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: cleaned, otp }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        const msg = data?.message || 'OTP verification failed';
        setError(msg);
        toast.error(msg);
        return;
      }

      toast.success(data?.message || 'OTP Verified Successfully!');
      setVerified(true);
      window.setTimeout(() => {
        navigate('/study/batches', { replace: true });
      }, 600);
    } catch {
      const msg = 'An error occurred during OTP verification.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const cycleTheme = () => {
    const next = theme === 'LIGHT' ? 'DARK' : theme === 'DARK' ? 'SYSTEM' : 'LIGHT';
    setTheme(next);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur divshadow sm:px-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 overflow-hidden rounded-full border dark:bg-foreground">
            <img src="/gb-study-icon.png" alt="GB STUDY" className="h-full w-full object-cover" />
          </div>
          <span className="font-semibold text-base sm:text-lg">GB STUDY</span>
        </div>
        <button
          type="button"
          onClick={cycleTheme}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'LIGHT' ? (
            <Sun className="h-4 w-4" />
          ) : theme === 'DARK' ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Monitor className="h-4 w-4" />
          )}
          <span>{theme === 'LIGHT' ? 'Light' : theme === 'DARK' ? 'Dark' : 'System'}</span>
        </button>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-xl border bg-background p-6 divshadow sm:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-[#edebfe] dark:bg-[#5a4bda]/20">
              {verified ? (
                <CheckCircle2 className="h-7 w-7 text-green-600 dark:text-green-400" />
              ) : (
                <ShieldCheck className="h-7 w-7 text-[#5a4bda] dark:text-[#b2a9ff]" />
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              {step === 'phone' ? 'Login to GB STUDY' : 'Verify OTP'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {step === 'phone'
                ? 'Enter your mobile number to receive an OTP and access your batches.'
                : `Enter the 6-digit code sent via ${smsType === '1' ? 'WhatsApp' : 'SMS'} to +91 ${phone}.`}
            </p>
          </div>

          {step === 'phone' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendOtp('0');
              }}
              className="space-y-4"
            >
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  Mobile Number
                </label>
                <div className="flex items-center overflow-hidden rounded-lg border bg-background focus-within:ring-2 focus-within:ring-[#5a4bda]">
                  <span className="border-r bg-muted/60 px-3 py-2.5 text-sm font-semibold text-foreground select-none">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value.replace(/\D/g, ''));
                      if (error) setError('');
                    }}
                    placeholder="Enter 10-digit mobile number"
                    className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
                    autoFocus
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-green-400 px-4 text-sm font-semibold text-white transition hover:bg-green-600 dark:bg-green-500 dark:hover:bg-green-600 disabled:opacity-60"
              >
                {loading && sendingChannel === 'sms' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Smartphone className="h-4 w-4" />
                )}
                <span>Send OTP via SMS</span>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => void sendOtp('1')}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md border bg-background px-4 text-sm font-medium hover:bg-muted transition disabled:opacity-60"
              >
                {loading && sendingChannel === 'whatsapp' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MessageSquare className="h-4 w-4 text-green-600" />
                )}
                <span>Get OTP on WhatsApp</span>
              </button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-5">
              <div className="flex justify-center gap-2">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      otpRefs.current[idx] = el;
                    }}
                    type="tel"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    onPaste={handleOtpPaste}
                    className="h-12 w-11 rounded-lg border bg-background text-center text-lg font-bold outline-none focus:border-[#5a4bda] focus:ring-2 focus:ring-[#5a4bda]/30 transition"
                    aria-label={`OTP digit ${idx + 1}`}
                  />
                ))}
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || verified}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-green-400 px-4 text-sm font-semibold text-white transition hover:bg-green-600 dark:bg-green-500 dark:hover:bg-green-600 disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                <span>{verified ? 'Verified! Redirecting...' : 'Verify & Continue'}</span>
              </button>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <button
                  type="button"
                  onClick={() => {
                    setStep('phone');
                    setError('');
                  }}
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Change number
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={countdown > 0 || resending}
                    onClick={() => void resendOtp(smsType)}
                    className="font-semibold text-[#5a4bda] hover:underline disabled:opacity-50 dark:text-[#29ff94]"
                  >
                    {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
