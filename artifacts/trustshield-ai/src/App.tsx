import { useState, type ButtonHTMLAttributes, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import {
  AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Check, CheckCircle2,
  ChevronRight, CircleHelp, ClipboardCheck, Clock3, Eye, FileSearch, Fingerprint,
  History, Info, KeyRound, LockKeyhole, LogOut, Mail, Menu, ScanLine, Shield,
  ShieldCheck, Trash2, UserRound,
} from 'lucide-react';
import {
  getGetCurrentUserQueryKey, getGetDashboardStatsQueryKey, getGetScanHistoryQueryKey,
  useAnalyzeContent, useDeleteScan, useDeleteScanHistory, useGetCurrentUser,
  useGetDashboardStats, useGetScanHistory, useLoginAccount, useLogoutAccount,
  useRedactContent, useRegisterAccount,
} from '@workspace/api-client-react';
import type { AuthUser, ScanAnalysis, ScanRecord } from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';
import '@/index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 20_000, refetchOnWindowFocus: false } },
});

const cx = (...values: Array<string | false | undefined>) => values.filter(Boolean).join(' ');
const errorText = (error: unknown) => {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return 'Something did not work. Please try again.';
};
const riskName = (level?: string) => (level || 'unknown').replace(/^\w/, (letter) => letter.toUpperCase());
const dateText = (date: string) => new Date(date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function Mark({ small = false }: { small?: boolean }) {
  return <span className={cx('brand-mark', small && 'brand-mark-small')} aria-hidden="true"><ShieldCheck size={small ? 18 : 21} strokeWidth={2.2} /></span>;
}

function Brand({ light = false }: { light?: boolean }) {
  return <Link href="/" className={cx('brand', light && 'brand-light')} data-testid="link-brand"><Mark /><span>trustshield<span className="brand-ai">.ai</span></span></Link>;
}

function Button({ children, variant = 'primary', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'quiet' | 'danger' }) {
  return <button className={cx('button', `button-${variant}`, className)} {...props}>{children}</button>;
}

function SectionHeading({ eyebrow, title, detail }: { eyebrow?: string; title: string; detail?: string }) {
  return <div className="section-heading">{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h2 className="display">{title}</h2>{detail && <p>{detail}</p>}</div>;
}

function StatePanel({ title, detail, retry }: { title: string; detail: string; retry?: () => void }) {
  return <div className="state-panel" role="status" data-testid="status-error"><div className="state-icon"><CircleHelp size={20} /></div><div><strong>{title}</strong><p>{detail}</p>{retry && <Button variant="secondary" onClick={retry} data-testid="button-retry">Try again</Button>}</div></div>;
}

function AuthenticatedShell({ user, children }: { user?: AuthUser; children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const logout = useLogoutAccount();
  const qc = useQueryClient();
  const links = [
    { href: '/dashboard', label: 'Overview', icon: Shield },
    { href: '/scanner', label: 'Message check', icon: ScanLine },
    { href: '/history', label: 'Scan history', icon: History },
    { href: '/settings', label: 'Privacy settings', icon: LockKeyhole },
  ];
  const signOut = () => logout.mutate(undefined, { onSuccess: () => { qc.setQueryData(getGetCurrentUserQueryKey(), undefined); qc.clear(); setLocation('/'); } });
  return <div className="app-frame">
    <aside className={cx('side-rail', mobileOpen && 'side-rail-open')}>
      <div className="rail-brand"><Brand /></div>
      <div className="rail-caption">YOUR SPACE</div>
      <nav className="rail-nav" aria-label="Main navigation">
        {links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={cx('rail-link', location === href && 'rail-link-active')} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}><Icon size={18} /><span>{label}</span>{location === href && <span className="rail-active-dot" />}</Link>)}
      </nav>
      <div className="rail-bottom">
        <div className="privacy-note"><span className="privacy-icon"><LockKeyhole size={15} /></span><p><strong>Private by design</strong><br />Submitted text is never saved.</p></div>
        <div className="rail-user">
          <span className="user-avatar">{user?.name?.charAt(0).toUpperCase() || 'U'}</span>
          <span className="rail-user-name"><strong>{user?.name || 'Your account'}</strong><small>{user?.email || 'Signed in'}</small></span>
          <button className="icon-button" aria-label="Sign out" onClick={signOut} disabled={logout.isPending} data-testid="button-sign-out"><LogOut size={17} /></button>
        </div>
      </div>
    </aside>
    {mobileOpen && <button className="rail-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <div className="app-main">
      <header className="app-topbar">
        <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(!mobileOpen)} data-testid="button-menu"><Menu size={20} /></button>
        <div className="topbar-breadcrumb"><span>Personal safety</span><ChevronRight size={14} /><strong>{links.find((item) => item.href === location)?.label || 'Workspace'}</strong></div>
        <div className="topbar-status"><span className="status-dot" />Gemini + local fallback</div>
      </header>
      <main className="page-content page-enter">{children}</main>
    </div>
  </div>;
}

function Landing() {
  const { data: user } = useGetCurrentUser({ query: { retry: false, queryKey: getGetCurrentUserQueryKey() } });
  return <div className="landing">
    <header className="landing-nav"><Brand /><nav className="landing-links" aria-label="Site navigation"><a href="#how-it-works" data-testid="link-how-it-works">How it works</a><a href="#privacy" data-testid="link-privacy-first">Privacy first</a></nav><div className="landing-actions">{user ? <Link href="/dashboard" className="nav-text-link" data-testid="link-dashboard">Go to dashboard <ArrowRight size={15} /></Link> : <><Link href="/login" className="nav-text-link" data-testid="link-login">Sign in</Link><Link href="/register" className="button button-primary nav-cta" data-testid="link-create-account">Create account <ArrowRight size={16} /></Link></>}</div></header>
    <main>
      <section className="hero soft-grid">
        <div className="hero-copy rise-in">
          <div className="eyebrow hero-eyebrow"><span className="eyebrow-line" />A steadier way to stay safe online</div>
          <h1 className="display text-balance">A second look.<br /><em>Before you click.</em></h1>
          <p className="hero-intro">Check a message that feels off. See the signals behind the risk. Remove personal details before sharing.</p>
          <div className="hero-buttons"><Link href={user ? '/scanner' : '/register'} className="button button-primary hero-cta" data-testid="link-start-check">Check a message <ArrowRight size={17} /></Link><a href="#how-it-works" className="text-link">See how it works <ArrowDownRight size={16} /></a></div>
          <div className="hero-footnote"><ShieldCheck size={16} /><span>Private by design</span><span className="footnote-dot">·</span><span>Results are guidance, not a verdict</span></div>
        </div>
        <div className="hero-art rise-in delay-2" aria-label="Illustration of a message being reviewed safely">
          <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
          <div className="message-card">
            <div className="message-top"><div className="message-avatar">S</div><div><strong>Parcel updates</strong><small>Unknown sender</small></div><span className="message-time">9:41 AM</span></div>
            <div className="message-body">Your delivery is waiting. Confirm your details to avoid a return fee.</div>
            <div className="message-url"><span>parcel-confirm-now.co</span><ArrowUpRight size={13} /></div>
            <div className="scan-divider"><span>REVIEWED BY TRUSTSHIELD</span><span className="tiny-check"><Check size={12} /></span></div>
            <div className="signal-line"><span className="signal-bullet amber" />Urgent payment language <span className="signal-tag">Review</span></div>
            <div className="signal-line"><span className="signal-bullet sage" />Unfamiliar web address <span className="signal-tag">Check</span></div>
          </div>
          <div className="review-stamp"><ShieldCheck size={23} /><span><strong>Take a breath.</strong><small>Look at the evidence.</small></span></div>
          <span className="art-index mono">01 / CHECK BEFORE YOU CLICK</span>
        </div>
      </section>
       <section className="trust-strip"><div><span className="strip-icon"><Eye size={18} /></span><span><strong>Explainable signals</strong><small>See what raised a flag</small></span></div><div><span className="strip-icon"><Fingerprint size={18} /></span><span><strong>Not saved by TrustShield</strong><small>Gemini receives text for analysis</small></span></div><div><span className="strip-icon"><Info size={18} /></span><span><strong>Provisional by nature</strong><small>Guidance, never a guarantee</small></span></div></section>
      <section id="how-it-works" className="how-section">
        <SectionHeading eyebrow="A LITTLE MORE CLARITY" title="The useful part is knowing why." detail="TrustShield gives you a reasoned second look, not a frightening red stamp." />
        <div className="how-layout"><div className="how-steps">
          <article className="how-step"><span className="step-number">01</span><div><h3>Bring the message</h3><p>Paste an email, text, chat, or web address that you are unsure about.</p></div></article>
          <article className="how-step"><span className="step-number">02</span><div><h3>Review the signals</h3><p>See possible urgency tactics, suspicious links, and personal details in context.</p></div></article>
          <article className="how-step"><span className="step-number">03</span><div><h3>Choose your next step</h3><p>Use practical recommendations, or redact personal data before sharing.</p></div></article>
        </div><div className="method-card"><div className="method-top"><span className="method-symbol"><FileSearch size={22} /></span><span className="method-label">HOW CHECKS WORK</span></div><h3>A second look, with evidence.</h3><p>Gemini reviews the message for security and privacy signals. If Gemini is unavailable, TrustShield uses its local rule-based scanner.</p><div className="method-foot"><span className="status-dot" />Gemini analysis with local fallback</div></div></div>
      </section>
      <section id="privacy" className="privacy-section"><div className="privacy-art"><div className="privacy-ring"><LockKeyhole size={34} /></div><span className="privacy-spark spark-a" /><span className="privacy-spark spark-b" /><span className="privacy-spark spark-c" /></div><div className="privacy-copy"><div className="eyebrow">YOUR WORDS STAY YOURS</div><h2 className="display">Private at the point of use.</h2><p>For message analysis, submitted text is sent to Google’s Gemini API when available. TrustShield does not save the submitted text, redacted text, or Gemini response. If Gemini is unavailable, local rules are used. History stores metadata only.</p><div className="privacy-bullets"><div><CheckCircle2 size={17} />No message text in TrustShield history</div><div><CheckCircle2 size={17} />Delete individual records or clear all history</div><div><CheckCircle2 size={17} />See the basis for every result</div></div></div></section>
      <section className="closing-cta"><div><span className="eyebrow">WHEN SOMETHING FEELS OFF</span><h2 className="display">Pause. Check. Decide.</h2><p>A calm second look can help you choose what to do next.</p></div><Link href={user ? '/scanner' : '/register'} className="button button-primary" data-testid="link-try-scanner">Try a message check <ArrowRight size={16} /></Link></section>
    </main><footer className="landing-footer"><Brand /><span>Clear signals for a safer everyday.</span><small>TrustShield AI · Results are provisional guidance.</small></footer>
  </div>;
}

function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register';
  const [, setLocation] = useLocation();
  const [formError, setFormError] = useState('');
  const qc = useQueryClient();
  const login = useLoginAccount();
  const register = useRegisterAccount();
  const pending = login.isPending || register.isPending;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setFormError('');
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');
    if (!email || !password || (isRegister && String(data.get('name') || '').trim().length < 2)) { setFormError('Please complete each field before continuing.'); return; }
    const onSuccess = (user: AuthUser) => {
      qc.setQueryData(getGetCurrentUserQueryKey(), user);
      qc.invalidateQueries({ queryKey: getGetScanHistoryQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
      setLocation('/dashboard');
    };
    if (isRegister) register.mutate({ data: { name: String(data.get('name')).trim(), email, password } }, { onSuccess, onError: (error) => setFormError(errorText(error)) });
    else login.mutate({ data: { email, password } }, { onSuccess, onError: (error) => setFormError(errorText(error)) });
  };
  return <main className="auth-screen">
    <div className="auth-top"><Brand /><Link href="/" className="nav-text-link" data-testid="link-back-home"><ArrowDownRight size={15} className="back-arrow" /> Back to home</Link></div>
    <div className="auth-layout">
      <section className="auth-story"><span className="auth-kicker"><ShieldCheck size={17} /> A calmer kind of protection</span><h1 className="display">{isRegister ? <>Start with a<br /><em>clearer view.</em></> : <>Good to have<br /><em>you back.</em></>}</h1><p>{isRegister ? 'A thoughtful check is always a few clicks away. Your words remain yours.' : 'Keep a steady eye on your scans, privacy, and next steps.'}</p><div className="auth-story-note"><span><LockKeyhole size={18} /></span><div><strong>Your text is not kept by TrustShield</strong><small>When available, message analysis is sent to Gemini. TrustShield stores metadata only.</small></div></div></section>
      <section className="auth-card">
        <div className="auth-card-head"><div className="eyebrow">{isRegister ? 'CREATE YOUR ACCOUNT' : 'SIGN IN'}</div><h2 className="display">{isRegister ? 'Make space for clarity.' : 'Welcome back.'}</h2><p>{isRegister ? 'Your private safety workspace starts here.' : 'Sign in to continue to your workspace.'}</p></div>
        <form onSubmit={submit} className="auth-form">
          {isRegister && <label className="field-label">Your name<div className="input-wrap"><UserRound size={17} /><input name="name" autoComplete="name" placeholder="Name as you like to be called" minLength={2} maxLength={80} required data-testid="input-name" /></div></label>}
          <label className="field-label">Email address<div className="input-wrap"><Mail size={17} /><input name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength={254} required data-testid="input-email" /></div></label>
          <label className="field-label">Password<div className="input-wrap"><KeyRound size={17} /><input name="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} placeholder={isRegister ? 'At least 10 characters' : 'Your password'} minLength={isRegister ? 10 : 1} maxLength={128} required data-testid="input-password" /></div></label>
          {formError && <div className="form-error" role="alert"><AlertTriangle size={16} />{formError}</div>}
          <Button type="submit" className="auth-submit" disabled={pending} data-testid="button-auth-submit">{pending ? <span className="button-loading"><span />{isRegister ? 'Creating account' : 'Signing in'}</span> : <>{isRegister ? 'Create account' : 'Sign in'} <ArrowRight size={16} /></>}</Button>
        </form>
        <div className="auth-switch">{isRegister ? 'Already have an account?' : 'New to TrustShield?'} <Link href={isRegister ? '/login' : '/register'} data-testid="link-auth-switch">{isRegister ? 'Sign in' : 'Create an account'}</Link></div>
        <div className="auth-assurance"><LockKeyhole size={14} />Your account details are used to protect your workspace.</div>
      </section>
    </div>
    <div className="auth-footer">A provisional second opinion. Never a guarantee.</div>
  </main>;
}

function SignInPrompt() {
  return <div className="auth-required"><div className="required-icon"><LockKeyhole size={22} /></div><h2 className="display">Your private space is waiting.</h2><p>Sign in to see your personal scan and privacy overview.</p><div className="required-actions"><Link href="/login" className="button button-primary" data-testid="link-sign-in-required">Sign in <ArrowRight size={15} /></Link><Link href="/register" className="button button-secondary" data-testid="link-register-required">Create account</Link></div></div>;
}

function Dashboard({ user }: { user: AuthUser }) {
  const stats = useGetDashboardStats();
  const history = useGetScanHistory();
  const greeting = user.name.split(' ')[0];
  return <div className="dashboard-page">
    <div className="page-title-row"><div><div className="eyebrow">YOUR PERSONAL OVERVIEW</div><h1 className="display">A little more clarity, {greeting}.</h1><p>Here is what has been happening in your safety space.</p></div><Link href="/scanner" className="button button-primary" data-testid="link-scan-new"><ScanLine size={17} /> Check a message</Link></div>
    {stats.isLoading ? <div className="stats-grid">{[1, 2, 3, 4].map((item) => <div className="stat-skeleton" key={item} />)}</div> : stats.isError ? <StatePanel title="Your overview could not load" detail={errorText(stats.error)} retry={() => stats.refetch()} /> : stats.data && <>
      <section className="stats-grid" aria-label="Your scan statistics">
        <StatTile label="Total checks" value={stats.data.totalScans} icon={<ScanLine size={18} />} tone="teal" />
        <StatTile label="Higher-risk signals" value={stats.data.highRiskScans} icon={<AlertTriangle size={18} />} tone="sand" caption="Worth a closer look" />
        <StatTile label="Privacy findings" value={stats.data.privacyFindings} icon={<Fingerprint size={18} />} tone="peach" />
        <StatTile label="Details protected" value={stats.data.protectedItems} icon={<ShieldCheck size={18} />} tone="sage" />
      </section>
      <section className="overview-grid">
        <div className="panel trend-panel"><div className="panel-heading"><div><div className="eyebrow">YOUR ACTIVITY</div><h2 className="display">Checks over time</h2></div><span className="panel-icon"><Clock3 size={17} /></span></div>
          {stats.data.scanTrend.length ? <TrendChart trend={stats.data.scanTrend} /> : <div className="chart-empty"><div className="chart-empty-mark"><ScanLine size={22} /></div><strong>Your activity will appear here</strong><span>Run a check to begin your timeline.</span></div>}
          <div className="chart-footnote"><span className="legend-dot" />Completed checks <span className="mono">· metadata only</span></div>
        </div>
        <div className="panel recent-panel"><div className="panel-heading"><div><div className="eyebrow">RECENT CHECKS</div><h2 className="display">Latest activity</h2></div><Link href="/history" className="panel-link" data-testid="link-all-history">All history <ArrowRight size={14} /></Link></div>
          {history.isLoading ? <div className="list-skeleton"><span /><span /><span /></div> : history.isError ? <StatePanel title="Activity unavailable" detail="We could not load recent checks." retry={() => history.refetch()} /> : history.data?.length ? <div className="recent-list">{history.data.slice(0, 4).map((record) => <ScanRow key={record.id} record={record} compact />)}</div> : <div className="mini-empty"><ScanLine size={20} /><strong>No checks yet</strong><span>Your first check will appear here.</span></div>}
        </div>
      </section>
      <section className="dashboard-bottom-note"><Info size={17} /><p><strong>Keep results in perspective.</strong> Risk levels are provisional signals produced by pattern-based checks. They are not proof that a message is safe or harmful.</p></section>
    </>}
  </div>;
}

function StatTile({ label, value, icon, tone, caption }: { label: string; value: number; icon: ReactNode; tone: string; caption?: string }) {
  return <article className="stat-tile"><span className={`stat-icon stat-${tone}`}>{icon}</span><span className="stat-label">{label}</span><strong className="stat-value display" data-testid={`value-stat-${label.toLowerCase().replaceAll(' ', '-')}`}>{value.toLocaleString()}</strong><span className="stat-caption">{caption || 'Across your account'}</span></article>;
}

function TrendChart({ trend }: { trend: Array<{ date: string; scans: number }> }) {
  const max = Math.max(1, ...trend.map((item) => item.scans));
  const points = trend.slice(-14);
  return <div className="trend-chart" role="img" aria-label={`Scan activity over ${points.length} days`}>
    <div className="trend-y-axis"><span>{max}</span><span>{Math.ceil(max / 2)}</span><span>0</span></div>
    <div className="trend-plot"><div className="chart-guides"><i /><i /><i /></div><div className="bar-row">{points.map((point, index) => <div className="bar-slot" key={`${point.date}-${index}`} title={`${point.scans} checks on ${point.date}`}><span className={cx('trend-bar', point.scans > 0 && 'trend-bar-filled')} style={{ height: `${Math.max(4, point.scans / max * 100)}%` }} /><small>{new Date(point.date).toLocaleDateString(undefined, { weekday: 'narrow' })}</small></div>)}</div></div>
  </div>;
}

function ScanRow({ record, compact = false, onDelete }: { record: ScanRecord; compact?: boolean; onDelete?: (record: ScanRecord) => void }) {
  const displayType = record.inputType.charAt(0).toUpperCase() + record.inputType.slice(1);
  return <div className={cx('scan-row', compact && 'scan-row-compact')} data-testid={`row-scan-${record.id}`}>
    <span className="row-type-icon"><Mail size={16} /></span><div className="scan-row-main"><strong>{displayType} check</strong><span>{dateText(record.createdAt)}</span></div>
    <div className="scan-row-counts"><span>{record.threatIndicatorCount} signal{record.threatIndicatorCount === 1 ? '' : 's'}</span><span>{record.privacyFindingCount} privacy detail{record.privacyFindingCount === 1 ? '' : 's'}</span></div>
    <span className={cx('risk-pill', `risk-${record.riskLevel}`)}><span />{riskName(record.riskLevel)}</span>
    {!compact && <span className="score-display mono">{record.riskScore}<small>/100</small></span>}
    {onDelete && <button className="icon-button row-delete" aria-label={`Delete ${displayType} scan record`} onClick={() => onDelete(record)} data-testid={`button-delete-record-${record.id}`}><Trash2 size={16} /></button>}
  </div>;
}

function Scanner() {
  const qc = useQueryClient();
  const [content, setContent] = useState('');
  const [inputType, setInputType] = useState('email');
  const [contextualUrl, setContextualUrl] = useState('');
  const [analysis, setAnalysis] = useState<ScanAnalysis | null>(null);
  const [geminiConsent, setGeminiConsent] = useState(false);
  const [redaction, setRedaction] = useState<{ redactedText: string; categories: string[]; findingCount: number } | null>(null);
  const [copyMessage, setCopyMessage] = useState('');
  const analyze = useAnalyzeContent();
  const redact = useRedactContent();
  const scan = (event: FormEvent) => {
    event.preventDefault(); setAnalysis(null); setRedaction(null);
    analyze.mutate({ data: { inputType: inputType as 'email' | 'sms' | 'chat' | 'website' | 'other', content: content.trim(), ...(contextualUrl.trim() ? { contextualUrl: contextualUrl.trim() } : {}) } }, { onSuccess: (result) => {
      setAnalysis(result);
      qc.invalidateQueries({ queryKey: getGetScanHistoryQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
    } });
  };
  const redactText = () => {
    setCopyMessage('');
    redact.mutate({ data: { content: content.trim() } }, { onSuccess: setRedaction });
  };
  const copyRedacted = async () => {
    if (!redaction) return;
    try { await navigator.clipboard.writeText(redaction.redactedText); setCopyMessage('Redacted text copied.'); }
    catch { setCopyMessage('Clipboard access is unavailable in this browser.'); }
  };
  return <div className="scanner-page">
    <div className="page-title-row"><div><div className="eyebrow">MESSAGE CHECK</div><h1 className="display">Take a closer look.</h1><p>Review a message for possible safety and privacy signals.</p></div><div className="scanner-private-tag"><LockKeyhole size={15} />Not saved as text</div></div>
    <div className="scanner-layout">
      <section className="panel scan-input-panel">
        <div className="panel-heading"><div><div className="eyebrow">01 — ADD CONTEXT</div><h2 className="display">What would you like to check?</h2></div><span className="input-step">01</span></div>
        <form onSubmit={scan}>
          <label className="field-label" htmlFor="content-kind">Message type</label>
          <select id="content-kind" className="select-control" value={inputType} onChange={(e) => setInputType(e.target.value)} data-testid="select-input-type"><option value="email">Email</option><option value="sms">Text message</option><option value="chat">Chat message</option><option value="website">Website content</option><option value="other">Other</option></select>
          <label className="field-label content-label" htmlFor="message-content">Message or content <span>Required</span></label>
          <textarea id="message-content" className="content-area" maxLength={12000} minLength={1} required placeholder="Paste the message or content you are unsure about…" value={content} onChange={(e) => { setContent(e.target.value); setGeminiConsent(false); setAnalysis(null); setRedaction(null); }} data-testid="input-message-content" />
          <div className="textarea-meta"><span>TrustShield does not store this text.</span><span className="mono">{content.length.toLocaleString()} / 12,000</span></div>
          <label className="gemini-consent"><input type="checkbox" checked={geminiConsent} onChange={(e) => setGeminiConsent(e.target.checked)} data-testid="checkbox-gemini-consent" /><span>I understand this message is sent to Google Gemini for analysis when available. If Gemini fails, local rules are used.</span></label>
          <label className="field-label optional-label" htmlFor="context-url">Related web address <span>Optional</span></label>
          <input id="context-url" className="text-control" type="url" maxLength={2048} placeholder="https://example.com" value={contextualUrl} onChange={(e) => { setContextualUrl(e.target.value); setGeminiConsent(false); }} data-testid="input-context-url" />
          {analyze.isError && <div className="form-error" role="alert"><AlertTriangle size={16} />{errorText(analyze.error)}</div>}
          {redact.isError && <div className="form-error" role="alert"><AlertTriangle size={16} />{errorText(redact.error)}</div>}
          <div className="scan-actions"><Button type="submit" disabled={analyze.isPending || !content.trim() || !geminiConsent} data-testid="button-review-signals">{analyze.isPending ? <span className="button-loading"><span />Analyzing message</span> : <>Review signals <ArrowRight size={16} /></>}</Button><Button type="button" variant="secondary" onClick={redactText} disabled={redact.isPending || !content.trim()} data-testid="button-redact-text">{redact.isPending ? 'Finding details…' : <><Fingerprint size={16} /> Redact personal details</>}</Button></div>
        </form>
      </section>
      <div className="scanner-side">
        {!analysis && !redaction && <div className="panel results-placeholder"><span className="placeholder-icon"><FileSearch size={25} /></span><div className="eyebrow">YOUR REVIEW</div><h2 className="display">Evidence, not alarm.</h2><p>When you run a check, we will show what patterns were noticed and what you might consider next.</p><div className="placeholder-rule"><span /><span /><span /></div><small>All results are provisional.</small></div>}
        {analysis && <AnalysisResult analysis={analysis} />}
        {redaction && <section className="panel redaction-panel" aria-live="polite"><div className="panel-heading"><div><div className="eyebrow">PERSONAL DETAILS</div><h2 className="display">Ready to share, more safely.</h2></div><span className="result-icon green"><Check size={18} /></span></div><p className="result-summary">{redaction.findingCount ? `${redaction.findingCount} personal detail${redaction.findingCount === 1 ? '' : 's'} replaced with redaction labels.` : 'No recognizable personal details were found.'}</p>{redaction.categories.length > 0 && <div className="category-pills">{redaction.categories.map((category) => <span key={category}>{category}</span>)}</div>}<pre className="redacted-text">{redaction.redactedText}</pre><Button variant="secondary" onClick={copyRedacted} className="copy-button" data-testid="button-copy-redacted"><ClipboardCheck size={16} />Copy redacted text</Button>{copyMessage && <p className="copy-feedback" role="status" data-testid="status-copy-feedback">{copyMessage}</p>}<div className="subtle-note"><LockKeyhole size={14} />Redacted text is shown only here and is not stored in scan history.</div></section>}
      </div>
    </div>
    <div className="scanner-disclaimer"><Info size={16} /><span>Gemini analysis with a local rules fallback · Results are provisional, not a guarantee of safety. TrustShield does not open links or verify senders. Confirm important requests through a trusted, independent channel.</span></div>
  </div>;
}

function AnalysisResult({ analysis }: { analysis: ScanAnalysis }) {
  const risk = analysis.riskLevel.toLowerCase();
  const usedGemini = analysis.analysisSource === 'gemini';
  return <section className="panel analysis-panel" aria-live="polite">
    <div className="analysis-heading"><div><div className="eyebrow">02 — YOUR REVIEW</div><h2 className="display">Signals to consider.</h2></div><span className={cx('risk-pill large', `risk-${risk}`)}><span />{riskName(risk)} risk</span></div>
    <div className="score-block"><div className="score-meter"><span style={{ transform: `rotate(${Math.max(0, Math.min(100, analysis.riskScore)) * 1.8}deg)` }} /><i /></div><div><strong className="score-number display">{analysis.riskScore}<small>/100</small></strong><span className="score-caption">{usedGemini ? 'Gemini-assisted signal score' : 'Rule-based fallback score'}</span></div><div className="provisional-label"><Info size={14} />Provisional</div></div>
    <p className="analysis-summary">{analysis.summary}</p>
    <div className="provisional-callout"><Info size={16} /><span>{usedGemini ? 'Gemini provided this analysis. It can make mistakes or miss context; verify important requests independently.' : 'Gemini was unavailable, so the local rule-based scanner provided this fallback. It can miss context and is not a definitive safety decision.'}</span></div>
    {analysis.threatIndicators.length > 0 && <div className="result-section"><h3><AlertTriangle size={16} />Possible message signals <span>{analysis.threatIndicators.length}</span></h3><div className="finding-list">{analysis.threatIndicators.map((item, index) => <article className="finding-item" key={`${item.type}-${index}`}><div><strong>{item.type}</strong><span className={`severity severity-${item.severity}`}>{item.severity}</span></div><p>{item.evidence}</p></article>)}</div></div>}
    {analysis.threatIndicators.length === 0 && <div className="no-signals"><CheckCircle2 size={18} /><span>No common message signals were identified. This does not confirm that the message is safe.</span></div>}
    {analysis.privacyFindings.length > 0 && <div className="result-section"><h3><Fingerprint size={16} />Personal details noticed <span>{analysis.privacyFindings.length}</span></h3><div className="finding-list">{analysis.privacyFindings.map((item, index) => <article className="finding-item privacy-finding" key={`${item.type}-${index}`}><div><strong>{item.type}</strong><span className={`severity severity-${item.severity}`}>{item.severity}</span></div><p>{item.description}</p></article>)}</div></div>}
    {analysis.recommendations.length > 0 && <div className="result-section recommendation-section"><h3><CheckCircle2 size={16} />Possible next steps</h3><ul>{analysis.recommendations.map((item, index) => <li key={index}><Check size={14} />{item}</li>)}</ul></div>}
    {analysis.trustConsiderations.length > 0 && <details className="considerations"><summary><Info size={15} />Important context <ChevronRight size={15} /></summary><ul>{analysis.trustConsiderations.map((item, index) => <li key={index}>{item}</li>)}</ul></details>}
  </section>;
}

function HistoryPage() {
  const history = useGetScanHistory();
  const deleteOne = useDeleteScan();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const remove = (record: ScanRecord) => {
    if (confirmId !== record.id) { setConfirmId(record.id); return; }
    deleteOne.mutate({ id: record.id }, { onSuccess: () => { setConfirmId(null); queryClient.invalidateQueries({ queryKey: getGetScanHistoryQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() }); } });
  };
  return <div className="history-page">
    <div className="page-title-row"><div><div className="eyebrow">METADATA ONLY</div><h1 className="display">Your scan history.</h1><p>Review or remove records of your checks. Message text is never included.</p></div><span className="history-lock"><LockKeyhole size={16} />No submitted text stored</span></div>
    {deleteOne.isError && <div className="form-error" role="alert"><AlertTriangle size={16} />{errorText(deleteOne.error)}</div>}
    {history.isLoading ? <div className="panel history-panel"><div className="list-skeleton"><span /><span /><span /><span /></div></div> : history.isError ? <StatePanel title="History could not load" detail={errorText(history.error)} retry={() => history.refetch()} /> : history.data?.length ? <section className="panel history-panel"><div className="history-list-head"><span>CHECK</span><span>COUNTS</span><span>RISK SIGNAL</span><span>SCORE</span><span className="sr-only">Actions</span></div><div>{history.data.map((record) => <div key={record.id} className="history-row-wrap"><ScanRow record={record} onDelete={remove} />{confirmId === record.id && <div className="confirm-inline" role="alert"><span>Remove this metadata record?</span><Button variant="danger" onClick={() => remove(record)} disabled={deleteOne.isPending} data-testid={`button-confirm-delete-${record.id}`}>{deleteOne.isPending ? 'Removing…' : 'Confirm delete'}</Button><Button variant="quiet" onClick={() => setConfirmId(null)} data-testid="button-cancel-delete">Cancel</Button></div>}</div>)}</div></section> : <div className="panel empty-history"><span className="empty-icon"><History size={24} /></span><h2 className="display">Nothing in your history yet.</h2><p>Your future checks will appear here as metadata only. No message or redacted text is saved.</p><Link href="/scanner" className="button button-primary" data-testid="link-history-scan">Make your first check <ArrowRight size={16} /></Link></div>}
    <div className="history-foot"><Info size={15} /><span>Each row stores scan type, date, risk signal, and finding counts. You can remove records at any time in this view or in Privacy settings.</span></div>
  </div>;
}

function SettingsPage({ user }: { user: AuthUser }) {
  const clearHistory = useDeleteScanHistory();
  const history = useGetScanHistory();
  const [confirmClear, setConfirmClear] = useState(false);
  const clear = () => clearHistory.mutate(undefined, { onSuccess: () => { setConfirmClear(false); queryClient.setQueryData(getGetScanHistoryQueryKey(), []); queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() }); } });
  return <div className="settings-page">
    <div className="page-title-row"><div><div className="eyebrow">YOUR ACCOUNT</div><h1 className="display">Privacy, in your hands.</h1><p>Understand what is used, what is kept, and what you can remove.</p></div></div>
    <section className="panel settings-card"><div className="settings-card-title"><span className="settings-icon"><UserRound size={18} /></span><div><div className="eyebrow">ACCOUNT DETAILS</div><h2 className="display">Your profile</h2></div></div><div className="account-details"><div><span>Name</span><strong data-testid="text-account-name">{user.name}</strong></div><div><span>Email address</span><strong data-testid="text-account-email">{user.email}</strong></div></div><p className="settings-help">These details identify your account. Profile editing is not available here.</p></section>
    <section className="panel settings-card privacy-settings"><div className="settings-card-title"><span className="settings-icon"><Fingerprint size={18} /></span><div><div className="eyebrow">DATA & PRIVACY</div><h2 className="display">A clear view of your data</h2></div></div>
      <div className="privacy-data-row"><span className="privacy-data-icon"><FileSearch size={17} /></span><div><strong>Submitted message text</strong><p>Sent to Google Gemini for analysis when available; not stored by TrustShield. Google processes requests under its Gemini API terms.</p></div><span className="data-state">Not retained here</span></div>
      <div className="privacy-data-row"><span className="privacy-data-icon"><History size={17} /></span><div><strong>Scan history</strong><p>Metadata only: type, date, provisional risk, and finding counts.</p></div><span className="data-state">{history.data?.length ?? '—'} records</span></div>
      <div className="settings-help settings-help-inset"><Info size={15} />Gemini analyzes message text when available. If the API is unavailable, local rule-based checks provide a fallback. Redaction remains rule-based.</div>
    </section>
    <section className="panel danger-zone"><div className="danger-heading"><span className="danger-icon"><Trash2 size={18} /></span><div><div className="eyebrow">HISTORY CONTROLS</div><h2 className="display">Clear scan history</h2></div></div><p>Delete all metadata records for your account. This cannot be undone and does not affect your account details.</p>
      {clearHistory.isError && <div className="form-error" role="alert"><AlertTriangle size={16} />{errorText(clearHistory.error)}</div>}
      {confirmClear ? <div className="clear-confirm" role="alert"><strong>Delete all {history.data?.length ?? ''} scan history records?</strong><span>This action cannot be undone.</span><div><Button variant="danger" onClick={clear} disabled={clearHistory.isPending} data-testid="button-confirm-clear-history">{clearHistory.isPending ? 'Deleting history…' : 'Yes, delete history'}</Button><Button variant="quiet" onClick={() => setConfirmClear(false)} data-testid="button-cancel-clear-history">Cancel</Button></div></div> : <Button variant="danger" onClick={() => setConfirmClear(true)} disabled={clearHistory.isPending || (history.data?.length === 0)} data-testid="button-clear-history"><Trash2 size={16} />Delete all history</Button>}
    </section>
    <p className="settings-endnote"><ShieldCheck size={16} />Your privacy choices are part of your safety toolkit.</p>
  </div>;
}

function ProtectedRoute({ children }: { children: (user: AuthUser) => ReactNode }) {
  const current = useGetCurrentUser({ query: { retry: false, queryKey: getGetCurrentUserQueryKey() } });
  if (current.isLoading) return <div className="protected-loading"><div className="loading-mark"><ShieldCheck size={22} /></div><span>Opening your private space…</span></div>;
  if (!current.data) return <AuthenticatedShell><SignInPrompt /></AuthenticatedShell>;
  return <AuthenticatedShell user={current.data}>{children(current.data)}</AuthenticatedShell>;
}

function Router() {
  return <Switch>
    <Route path="/" component={Landing} />
    <Route path="/login"><AuthPage mode="login" /></Route>
    <Route path="/register"><AuthPage mode="register" /></Route>
    <Route path="/dashboard"><ProtectedRoute>{(user) => <Dashboard user={user} />}</ProtectedRoute></Route>
    <Route path="/scanner"><ProtectedRoute>{() => <Scanner />}</ProtectedRoute></Route>
    <Route path="/history"><ProtectedRoute>{() => <HistoryPage />}</ProtectedRoute></Route>
    <Route path="/settings"><ProtectedRoute>{(user) => <SettingsPage user={user} />}</ProtectedRoute></Route>
    <Route component={NotFound} />
  </Switch>;
}

function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter></QueryClientProvider>;
}

export default App;