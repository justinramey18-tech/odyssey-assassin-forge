import { useState, useEffect, useCallback } from 'react';
import { Send, Link2, Unlink, Copy, RefreshCw, Bell, BellOff, Clock, Trash2, Plus, ChevronDown, ChevronUp, Users, BookOpen, Sparkles } from 'lucide-react';
import { DM_MODELS, DEFAULT_MODEL_ID, getModelLabel } from '@/lib/dm-models';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { SettingsSection } from './SettingsSection';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { sendTelegramNotification } from '@/lib/telegram-notify';

interface TelegramLink {
  id: string;
  chat_id: number;
  username: string | null;
  linked_at: string;
  notify_ready_up: boolean;
  notify_timer: boolean;
  notify_combat: boolean;
  notify_dragon: boolean;
}

interface ScheduledJob {
  id: string;
  job_name: string;
  ai_prompt: string | null;
  static_message: string | null;
  repeat_daily: boolean;
  run_at: string;
  run_time: string | null;
  timezone: string;
  status: string;
  last_result: string | null;
  dm_context_mode?: string;
  ai_model?: string;
  target_chat_ids?: number[] | null;
}

const JOB_TEMPLATES = [
  { label: 'Campaign Recap', name: 'Campaign Recap', prompt: 'Generate an engaging recap of my current D&D campaign, highlighting recent events, unresolved plot threads, and upcoming dangers.' },
  { label: 'Random Encounter', name: 'Random Encounter', prompt: 'Create a unique random encounter appropriate for my party, with vivid descriptions, NPC motivations, and possible outcomes.' },
  { label: 'Dragon Message', name: 'Dragon Message', prompt: 'Write an in-character message from my bonded dragon companion, referencing recent campaign events and offering cryptic guidance.' },
  { label: 'Quote of the Day', name: 'Quote of the Day', prompt: 'Generate an original inspirational fantasy quote in the style of a wise D&D sage or ancient tome.' },
  { label: 'Session Prep', name: 'Session Prep', prompt: 'Based on my campaign so far, suggest 3 things I should prepare or think about before my next session.' },
  { label: 'NPC Letter', name: 'NPC Letter', prompt: 'Write an in-character letter from a notable NPC in my campaign, reacting to recent events.' },
];

export function TelegramSettingsTab() {
  const { user } = useAuth();
  const [links, setLinks] = useState<TelegramLink[]>([]);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Scheduled jobs state
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [showNewJobForm, setShowNewJobForm] = useState(false);
  const [newJobPrompt, setNewJobPrompt] = useState('');
  const [newJobName, setNewJobName] = useState('');
  const [newJobIncludeContext, setNewJobIncludeContext] = useState(true);
  const [newJobTime, setNewJobTime] = useState('08:00');
  const [newJobRepeatDaily, setNewJobRepeatDaily] = useState(false);
  const [newJobDate, setNewJobDate] = useState<Date | undefined>();
  const [newJobCalendarOpen, setNewJobCalendarOpen] = useState(false);
  const [newJobDmContext, setNewJobDmContext] = useState<'solo' | 'party' | 'empyrean'>('solo');
  const [newJobAiModel, setNewJobAiModel] = useState(DEFAULT_MODEL_ID);
  const [submittingJob, setSubmittingJob] = useState(false);
  const [newJobTargetChatIds, setNewJobTargetChatIds] = useState<number[]>([]);

  // Fetch existing links
  const fetchLinks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('telegram_user_links')
      .select('*')
      .eq('user_id', user.id);
    setLinks((data as TelegramLink[] | null) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  // Fetch scheduled jobs
  const fetchJobs = useCallback(async () => {
    if (!user) return;
    setJobsLoading(true);
    const { data } = await supabase
      .from('scheduled_telegram_jobs')
      .select('id, job_name, ai_prompt, static_message, repeat_daily, run_at, run_time, timezone, status, last_result, dm_context_mode, ai_model, target_chat_ids')
      .eq('user_id', user.id)
      .in('status', ['pending', 'running'])
      .order('run_at', { ascending: true });
    setJobs((data as ScheduledJob[] | null) ?? []);
    setJobsLoading(false);
  }, [user]);

  useEffect(() => { if (links.length > 0) fetchJobs(); }, [links, fetchJobs]);

  // Generate link code (does NOT delete existing codes/links)
  const generateCode = useCallback(async () => {
    if (!user) return;
    setGenerating(true);

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error } = await supabase.from('telegram_link_codes').insert({
      user_id: user.id,
      code,
      expires_at: expiresAt,
    });

    if (error) {
      toast.error('Failed to generate code');
      console.error(error);
    } else {
      setLinkCode(code);
      toast.success('Link code generated — valid for 10 minutes');
    }
    setGenerating(false);
  }, [user]);

  // Copy code
  const copyCode = useCallback(() => {
    if (!linkCode) return;
    navigator.clipboard.writeText(`/link ${linkCode}`);
    toast.success('Copied! Paste this to the bot in Telegram');
  }, [linkCode]);

  // Unlink a specific chat
  const handleUnlink = useCallback(async (linkId: string) => {
    if (!user) return;
    await supabase.from('telegram_user_links').delete().eq('id', linkId);
    setLinks(prev => prev.filter(l => l.id !== linkId));
    toast.success('Telegram chat unlinked');
  }, [user]);

  // Toggle notification preference for a specific link
  const toggleNotif = useCallback(async (linkId: string, field: string, value: boolean) => {
    if (!user) return;
    const { error } = await supabase
      .from('telegram_user_links')
      .update({ [field]: value })
      .eq('id', linkId);

    if (!error) {
      setLinks(prev => prev.map(l => l.id === linkId ? { ...l, [field]: value } : l));
    } else {
      toast.error('Failed to update preference');
    }
  }, [user]);

  // Cancel a scheduled job
  const cancelJob = useCallback(async (jobId: string) => {
    const { error } = await supabase
      .from('scheduled_telegram_jobs')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', jobId);

    if (error) {
      toast.error('Failed to cancel job');
    } else {
      toast.success('Job cancelled');
      fetchJobs();
    }
  }, [fetchJobs]);

  // Submit new job
  const handleSubmitJob = useCallback(async () => {
    if (!user) return;
    if (!newJobPrompt.trim()) {
      toast.error('Enter a prompt for the AI');
      return;
    }
    if (!newJobName.trim()) {
      toast.error('Give this job a name');
      return;
    }
    if (!newJobRepeatDaily && !newJobDate) {
      toast.error('Pick a date for one-time jobs');
      return;
    }

    setSubmittingJob(true);
    try {
      const [hours, minutes] = newJobTime.split(':').map(Number);

      const targetDate = newJobRepeatDaily ? new Date() : new Date(newJobDate!);
      const yyyy = targetDate.getFullYear();
      const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
      const dd = String(targetDate.getDate()).padStart(2, '0');
      const hh = String(hours).padStart(2, '0');
      const min = String(minutes).padStart(2, '0');

      // Find the UTC time that corresponds to this time in America/New_York
      const naiveUtc = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00Z`);
      const nyTimeAtNaive = new Date(naiveUtc.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const offsetMs = naiveUtc.getTime() - nyTimeAtNaive.getTime();
      let runAt = new Date(naiveUtc.getTime() + offsetMs);

      if (newJobRepeatDaily && runAt.getTime() <= Date.now()) {
        runAt.setUTCDate(runAt.getUTCDate() + 1);
      }

      const utcHours = runAt.getUTCHours();
      const utcTimeStr = `${String(utcHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

      const { error } = await supabase
        .from('scheduled_telegram_jobs')
        .insert({
          user_id: user.id,
          job_name: newJobName.trim(),
          ai_prompt: newJobPrompt.trim(),
          static_message: null,
          include_campaign_context: newJobIncludeContext,
          dm_context_mode: newJobDmContext,
          ai_model: newJobAiModel,
          timezone: 'America/New_York',
          status: 'pending',
          run_at: runAt.toISOString(),
          repeat_daily: newJobRepeatDaily,
          run_time: newJobRepeatDaily ? utcTimeStr : null,
        });

      if (error) throw error;

      const displayTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} EDT`;
      toast.success(`Scheduled! The AI will message you at ${displayTime}.`);

      // Reset form
      setNewJobPrompt('');
      setNewJobName('');
      setNewJobIncludeContext(true);
      setNewJobDmContext('solo');
      setNewJobAiModel(DEFAULT_MODEL_ID);
      setNewJobTime('08:00');
      setNewJobRepeatDaily(false);
      setNewJobDate(undefined);
      setShowNewJobForm(false);
      fetchJobs();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to schedule job');
    } finally {
      setSubmittingJob(false);
    }
  }, [user, newJobPrompt, newJobName, newJobIncludeContext, newJobTime, newJobRepeatDaily, newJobDate, fetchJobs]);

  // Format run time for display
  const formatJobTime = (job: ScheduledJob) => {
    const runDate = new Date(job.run_at);
    const tzAbbr = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' })
      .formatToParts(runDate)
      .find(p => p.type === 'timeZoneName')?.value || 'ET';
    if (job.repeat_daily && job.run_time) {
      const [utcH, utcM] = job.run_time.split(':').map(Number);
      const tempDate = new Date();
      tempDate.setUTCHours(utcH, utcM, 0, 0);
      const nyTime = tempDate.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true });
      return `Daily at ${nyTime} ${tzAbbr}`;
    }
    const nyTime = runDate.toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    return `${nyTime} ${tzAbbr}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1">
      <div className="space-y-3 pb-6">
        {/* Link Status */}
        <SettingsSection title="Connection" icon={<Send className="w-4 h-4 text-sky-400" />}>
          <div className="space-y-3">
            {/* Existing linked chats */}
            {links.length > 0 && (
              <div className="space-y-2">
                {links.map((lnk) => (
                  <div key={lnk.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/30 bg-muted/10 p-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="border-green-500/30 text-green-400 bg-green-500/5 shrink-0">
                        <Link2 className="w-3 h-3 mr-1" />
                        Linked
                      </Badge>
                      <span className="text-xs text-muted-foreground truncate">
                        {lnk.username ? `@${lnk.username}` : `Chat ${lnk.chat_id}`}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUnlink(lnk.id)}
                      className="shrink-0 h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const { data, error } = await supabase.functions.invoke('telegram-notify-proxy', {
                        body: {
                          type: 'custom',
                          targetUserIds: [user!.id],
                          title: '🧪 Test Notification',
                          body: 'If you see this in Telegram, push notifications are working!',
                        },
                      });
                      if (error) throw error;
                      toast.success(`Test sent! (${data?.sent ?? 0} delivered)`);
                    } catch (e: any) {
                      console.error(e);
                      toast.error('Failed to send test notification');
                    }
                  }}
                  className="w-full gap-2 h-10"
                >
                  <Bell className="w-3.5 h-3.5" />
                  Send Test to All Chats
                </Button>
              </div>
            )}

            {/* Link code generation — always available */}
            <div className="space-y-2">
              {links.length === 0 && (
                <>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Link your Telegram to receive party notifications and roll dice remotely.
                  </p>
                  <div className="space-y-2">
                    <p className="text-[10px] font-medium text-foreground/80 uppercase tracking-wider">Step 1</p>
                    <p className="text-xs text-muted-foreground">
                      Open your <b>TeleDnd</b> bot in Telegram and send <code>/start</code>.
                    </p>
                  </div>
                  <p className="text-[10px] font-medium text-foreground/80 uppercase tracking-wider">Step 2</p>
                </>
              )}
              {links.length > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Generate a new code to link another Telegram group or chat.
                </p>
              )}
              <Button
                size="sm"
                onClick={generateCode}
                disabled={generating}
                className="w-full gap-2 h-10"
                variant={links.length > 0 ? 'outline' : 'default'}
              >
                {generating ? (
                  <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Generating...</>
                ) : links.length > 0 ? (
                  <><Plus className="w-3.5 h-3.5" />Add Another Chat</>
                ) : (
                  <><Link2 className="w-3.5 h-3.5" />Generate Link Code</>
                )}
              </Button>
            </div>
            {linkCode && (
              <div className="space-y-2">
                {links.length === 0 && (
                  <p className="text-[10px] font-medium text-foreground/80 uppercase tracking-wider">Step 3</p>
                )}
                <p className="text-xs text-muted-foreground">Send this to your bot in Telegram:</p>
                <button
                  onClick={copyCode}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors"
                >
                  <code className="text-sm font-mono text-primary font-bold">/link {linkCode}</code>
                  <Copy className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
                <p className="text-[10px] text-muted-foreground text-center">
                  Expires in 10 minutes. Tap to copy.
                </p>
              </div>
            )}
          </div>
        </SettingsSection>

        {/* Notification Preferences (only when linked) */}
        {links.length > 0 && (
          <SettingsSection title="Notifications" icon={<Bell className="w-4 h-4 text-amber-400" />}>
            <div className="space-y-4">
              {links.map((lnk, idx) => (
                <div key={lnk.id} className="space-y-3">
                  {links.length > 1 && (
                    <>
                      {idx > 0 && <Separator className="bg-border/30 my-1" />}
                      <p className="text-xs font-medium text-foreground/80">
                        {lnk.username ? `@${lnk.username}` : `Chat ${lnk.chat_id}`}
                      </p>
                    </>
                  )}
                  {links.length === 1 && (
                    <p className="text-[10px] text-muted-foreground">Choose which events send a Telegram message.</p>
                  )}
                  <NotifToggle
                    label="Ready-up alerts"
                    description="When a party member readies up"
                    checked={lnk.notify_ready_up}
                    onChange={(v) => toggleNotif(lnk.id, 'notify_ready_up', v)}
                  />
                  <Separator className="bg-border/20" />
                  <NotifToggle
                    label="Timer expiry"
                    description="When the round timer runs out"
                    checked={lnk.notify_timer}
                    onChange={(v) => toggleNotif(lnk.id, 'notify_timer', v)}
                  />
                  <Separator className="bg-border/20" />
                  <NotifToggle
                    label="Combat alerts"
                    description="When combat starts or your turn begins"
                    checked={lnk.notify_combat}
                    onChange={(v) => toggleNotif(lnk.id, 'notify_combat', v)}
                  />
                  <Separator className="bg-border/20" />
                  <NotifToggle
                    label="Dragon bond"
                    description="Messages from your bonded dragon"
                    checked={lnk.notify_dragon}
                    onChange={(v) => toggleNotif(lnk.id, 'notify_dragon', v)}
                  />
                </div>
              ))}
            </div>
          </SettingsSection>
        )}

        {/* Scheduled Jobs (only when linked) */}
        {links.length > 0 && (
          <SettingsSection title="Scheduled Jobs" icon={<Clock className="w-4 h-4 text-violet-400" />}>
            <div className="space-y-3">
              <p className="text-[10px] text-muted-foreground">
                Schedule the AI to send you anything on Telegram — recaps, encounter ideas, lore drops, reminders, or any custom prompt.
              </p>

              {/* Active jobs list */}
              {jobsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : jobs.length > 0 ? (
                <div className="space-y-2">
                  {jobs.map(job => (
                    <div key={job.id} className="flex items-start gap-2 rounded-lg border border-border/30 bg-muted/10 p-2.5">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium text-foreground truncate">{job.job_name}</span>
                          {job.ai_prompt ? (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-violet-500/30 text-violet-400 bg-violet-500/5">AI</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0">Static</Badge>
                          )}
                          {job.repeat_daily ? (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-blue-500/30 text-blue-400 bg-blue-500/5">Daily</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0">One-time</Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          ⏰ {formatJobTime(job)}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60">
                          {job.dm_context_mode ? job.dm_context_mode.charAt(0).toUpperCase() + job.dm_context_mode.slice(1) : 'Solo'} DM · {getModelLabel(job.ai_model || DEFAULT_MODEL_ID)}
                        </p>
                        {job.last_result && (
                          <p className="text-[10px] text-muted-foreground/60 truncate">
                            Last: {job.last_result.substring(0, 80)}{job.last_result.length > 80 ? '…' : ''}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => cancelJob(job.id)}
                        className="shrink-0 p-1.5 rounded-md text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* New job button / form */}
              {!showNewJobForm ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewJobForm(true)}
                  className="w-full gap-2 h-10"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Scheduled Job
                </Button>
              ) : (
                <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-medium text-foreground/80 uppercase tracking-wider">New Scheduled Job</p>
                    <button
                      onClick={() => setShowNewJobForm(false)}
                      className="text-muted-foreground hover:text-foreground p-1"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Prompt textarea */}
                  <Textarea
                    value={newJobPrompt}
                    onChange={e => setNewJobPrompt(e.target.value)}
                    rows={3}
                    className="text-sm resize-none"
                    placeholder={`Examples:\n• Generate a dramatic recap of my campaign\n• Create a random tavern encounter with NPC hooks\n• Write an in-character message from my bonded dragon\n• Generate a D&D quote of the day\n• Suggest 3 things to prep before my next session`}
                  />

                  {/* Template chips */}
                  <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                    {JOB_TEMPLATES.map(tpl => (
                      <button
                        key={tpl.label}
                        onClick={() => {
                          setNewJobPrompt(tpl.prompt);
                          setNewJobName(tpl.name);
                        }}
                        className="shrink-0 rounded-full border border-border/50 bg-muted/30 px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors whitespace-nowrap"
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>

                  {/* Job name */}
                  <Input
                    value={newJobName}
                    onChange={e => setNewJobName(e.target.value)}
                    placeholder="Name this job"
                    className="text-sm"
                  />

                  {/* Include campaign context */}
                  <div className="flex items-center justify-between gap-3 min-h-[44px]">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">Include campaign context</p>
                      <p className="text-[10px] text-muted-foreground">Gives the AI access to your campaign, character, and quest data.</p>
                    </div>
                    <Switch checked={newJobIncludeContext} onCheckedChange={setNewJobIncludeContext} />
                  </div>

                  {/* DM Context Mode */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-medium text-foreground/80 uppercase tracking-wider">AI Context Mode</p>
                    <div className="flex gap-1.5 rounded-lg bg-muted/40 p-1">
                      {([
                        { value: 'solo' as const, label: 'Solo DM', icon: BookOpen },
                        { value: 'party' as const, label: 'Party DM', icon: Users },
                        { value: 'empyrean' as const, label: 'Empyrean', icon: Sparkles },
                      ]).map(({ value, label, icon: Icon }) => (
                        <button
                          key={value}
                          onClick={() => setNewJobDmContext(value)}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors",
                            newJobDmContext === value
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {newJobDmContext === 'solo' && 'Uses your solo campaign — character, summary, and quest flags.'}
                      {newJobDmContext === 'party' && "Uses your party's campaign — all members, shared summary, and history."}
                      {newJobDmContext === 'empyrean' && 'Uses your Empyrean campaign — dragon bond, lore guides, and persona.'}
                    </p>
                  </div>

                  {/* AI Model */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-medium text-foreground/80 uppercase tracking-wider">AI Model</p>
                    <select
                      value={newJobAiModel}
                      onChange={e => setNewJobAiModel(e.target.value)}
                      className="w-full rounded-md border border-border/50 bg-transparent text-sm text-foreground px-3 py-2"
                    >
                      <optgroup label="Gateway Models">
                        {DM_MODELS.filter(m => m.provider === 'lovable').map(m => (
                          <option key={m.id} value={m.id}>{m.label} — {m.description}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Anthropic (your API key)">
                        {DM_MODELS.filter(m => m.provider === 'anthropic').map(m => (
                          <option key={m.id} value={m.id}>{m.label} — {m.description}</option>
                        ))}
                      </optgroup>
                      <optgroup label="OpenAI (your API key)">
                        {DM_MODELS.filter(m => m.provider === 'openai-direct').map(m => (
                          <option key={m.id} value={m.id}>{m.label} — {m.description}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  {/* Send at time */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-medium text-foreground/80 uppercase tracking-wider">Send at</p>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          type="time"
                          value={newJobTime}
                          onChange={e => setNewJobTime(e.target.value)}
                          className="pl-8 text-sm"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Eastern Time (America/New_York)</p>
                  </div>

                  {/* Repeat daily */}
                  <div className="flex items-center justify-between gap-3 min-h-[44px]">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">Repeat daily</p>
                    </div>
                    <Switch checked={newJobRepeatDaily} onCheckedChange={setNewJobRepeatDaily} />
                  </div>

                  {/* Date picker for one-time jobs */}
                  {!newJobRepeatDaily && (
                    <Popover open={newJobCalendarOpen} onOpenChange={setNewJobCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left text-sm font-normal",
                            !newJobDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
                          {newJobDate ? format(newJobDate, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[200] pointer-events-auto" align="start">
                        <Calendar
                          mode="single"
                          selected={newJobDate}
                          onSelect={(date) => {
                            setNewJobDate(date);
                            setNewJobCalendarOpen(false);
                          }}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  )}

                  {/* Submit */}
                  <Button
                    onClick={handleSubmitJob}
                    disabled={submittingJob}
                    className="w-full"
                    size="sm"
                  >
                    {submittingJob ? (
                      <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Scheduling...</>
                    ) : (
                      'Schedule'
                    )}
                  </Button>
                </div>
              )}
            </div>
          </SettingsSection>
        )}

        {/* Commands Reference */}
        <SettingsSection title="Bot Commands">
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-medium text-foreground/80 uppercase tracking-wider mb-1.5">Character</p>
              <div className="space-y-1.5">
                {[
                  ['/character', 'Character summary'],
                  ['/stats', 'Ability scores'],
                  ['/hp', 'Current HP'],
                  ['/slots', 'Spell slot usage'],
                ].map(([cmd, desc]) => (
                  <div key={cmd} className="flex items-start gap-2">
                    <code className="text-[11px] font-mono text-primary shrink-0 bg-primary/5 px-1.5 py-0.5 rounded">{cmd}</code>
                    <span className="text-[11px] text-muted-foreground">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <Separator className="bg-border/20" />
            <div>
              <p className="text-[10px] font-medium text-foreground/80 uppercase tracking-wider mb-1.5">Actions</p>
              <div className="space-y-1.5">
                {[
                  ['/damage 15', 'Take damage'],
                  ['/heal 10', 'Heal HP'],
                  ['/cast 3', 'Use spell slot (level)'],
                  ['/initiative', 'Roll initiative'],
                  ['/roll 2d20+5', 'Roll dice'],
                ].map(([cmd, desc]) => (
                  <div key={cmd} className="flex items-start gap-2">
                    <code className="text-[11px] font-mono text-primary shrink-0 bg-primary/5 px-1.5 py-0.5 rounded">{cmd}</code>
                    <span className="text-[11px] text-muted-foreground">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <Separator className="bg-border/20" />
            <div>
              <p className="text-[10px] font-medium text-foreground/80 uppercase tracking-wider mb-1.5">Campaign</p>
              <div className="space-y-1.5">
                {[
                  ['/quests', 'Active quest flags'],
                  ['/lore ...', 'AI lore lookup'],
                  ['/recap', 'AI session recap'],
                ].map(([cmd, desc]) => (
                  <div key={cmd} className="flex items-start gap-2">
                    <code className="text-[11px] font-mono text-primary shrink-0 bg-primary/5 px-1.5 py-0.5 rounded">{cmd}</code>
                    <span className="text-[11px] text-muted-foreground">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <Separator className="bg-border/20" />
            <div>
              <p className="text-[10px] font-medium text-foreground/80 uppercase tracking-wider mb-1.5">Account</p>
              <div className="space-y-1.5">
                {[
                  ['/status', 'Check link status'],
                  ['/notify on|off', 'Toggle notifications'],
                  ['/unlink', 'Unlink account'],
                ].map(([cmd, desc]) => (
                  <div key={cmd} className="flex items-start gap-2">
                    <code className="text-[11px] font-mono text-primary shrink-0 bg-primary/5 px-1.5 py-0.5 rounded">{cmd}</code>
                    <span className="text-[11px] text-muted-foreground">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}

function NotifToggle({ label, description, checked, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 min-h-[44px]">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
