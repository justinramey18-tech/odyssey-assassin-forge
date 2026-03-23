import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Flame, Calendar as CalendarIcon, Clock, Trash2, Send, Repeat, Sparkles, AlertTriangle, Loader2, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { sendTelegramNotification } from '@/lib/telegram-notify';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getAuthToken } from '@/lib/auth-token';
import { loadSelectedModel } from '@/lib/dm-models';

const AI_DM_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-dm`;

interface DragonInfo {
  userId: string;
  dragonName: string;
  signetType: string;
  mood: string;
  bond: number;
  trust: number;
}

interface DragonTelegramSchedulerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partyId: string;
  dragons: DragonInfo[];
  isCreator: boolean;
}

interface ScheduledJob {
  id: string;
  job_name: string;
  ai_prompt: string | null;
  static_message: string | null;
  run_at: string;
  repeat_daily: boolean;
  status: string;
}

export default function DragonTelegramScheduler({
  open,
  onOpenChange,
  partyId,
  dragons,
  isCreator,
}: DragonTelegramSchedulerProps) {
  const { user } = useAuth();
  const [selectedDragonUserId, setSelectedDragonUserId] = useState<string | null>(null);
  const [messageMode, setMessageMode] = useState<'instant' | 'scheduled'>('instant');
  const [messageType, setMessageType] = useState<'ai-generated' | 'manual'>('ai-generated');
  const [aiPrompt, setAiPrompt] = useState('');
  const [manualMessage, setManualMessage] = useState('');
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState('18:00');
  const [repeatDaily, setRepeatDaily] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);

  // Preview generation state
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditingPreview, setIsEditingPreview] = useState(false);

  // Telegram link warning
  const [hasLinkedTelegram, setHasLinkedTelegram] = useState<boolean | null>(null);

  const selectedDragon = dragons.find(d => d.userId === selectedDragonUserId) || null;
  const hasContent = messageType === 'ai-generated'
    ? (previewMessage ? previewMessage.trim().length > 0 : aiPrompt.trim().length > 0)
    : manualMessage.trim().length > 0;
  const canSend = selectedDragon && hasContent && !isSending;

  const loadJobs = useCallback(async () => {
    if (!partyId) return;
    const { data } = await supabase
      .from('scheduled_telegram_jobs')
      .select('id, job_name, ai_prompt, static_message, run_at, repeat_daily, status')
      .eq('party_id', partyId)
      .eq('dm_context_mode', 'empyrean_dragon')
      .order('run_at', { ascending: false });
    if (data) setJobs(data);
  }, [partyId]);

  // Check if any party member has linked Telegram
  const checkTelegramLinks = useCallback(async () => {
    if (!partyId) return;
    const { data: members } = await supabase
      .from('party_members')
      .select('user_id')
      .eq('party_id', partyId);
    if (!members || members.length === 0) {
      setHasLinkedTelegram(false);
      return;
    }
    const userIds = members.map(m => m.user_id);
    const { data: links } = await supabase
      .from('telegram_user_links')
      .select('id')
      .in('user_id', userIds)
      .limit(1);
    setHasLinkedTelegram(!!links && links.length > 0);
  }, [partyId]);

  useEffect(() => {
    if (open) {
      loadJobs();
      checkTelegramLinks();
    }
  }, [open, loadJobs, checkTelegramLinks]);

  // Generate AI preview
  const handleGeneratePreview = async () => {
    if (!selectedDragon || !aiPrompt.trim()) return;
    setIsGenerating(true);
    setPreviewMessage(null);
    setIsEditingPreview(false);
    try {
      const authToken = await getAuthToken();
      const systemPrompt = `You are ${selectedDragon.dragonName}, a bonded dragon in the Empyrean world. Mood: ${selectedDragon.mood}. Bond with rider: ${selectedDragon.bond}/100. Speak in first person, ancient and proud. Max 2-3 sentences. Use plain text only, no markdown.`;

      const resp = await fetch(AI_DM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          messages: [{ role: 'user', content: aiPrompt.trim() }],
          systemPromptOverride: systemPrompt,
          model: loadSelectedModel(),
        }),
      });

      if (!resp.ok) throw new Error('AI generation failed');
      const data = await resp.json();
      const raw: string = data?.response || data?.content || '';
      setPreviewMessage(raw.trim() || 'No response generated.');
    } catch (err) {
      console.error('[DragonScheduler] Preview error:', err);
      toast.error('Failed to generate dragon voice preview');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendNow = async () => {
    if (!selectedDragon || !user) return;
    setIsSending(true);
    try {
      let body: string;
      if (messageType === 'manual') {
        body = manualMessage.trim();
      } else if (previewMessage) {
        body = previewMessage.trim();
      } else {
        body = aiPrompt.trim();
      }

      sendTelegramNotification({
        type: 'dragon_message',
        partyId,
        targetUserIds: [selectedDragon.userId],
        title: `🐉 ${selectedDragon.dragonName} speaks`,
        body,
        dragonName: selectedDragon.dragonName,
        mode: 'empyrean',
      });
      toast.success(`${selectedDragon.dragonName}'s message sent`);
      setAiPrompt('');
      setManualMessage('');
      setPreviewMessage(null);
    } catch (err) {
      console.error('[DragonScheduler] Send error:', err);
      toast.error('Failed to send dragon message');
    } finally {
      setIsSending(false);
    }
  };

  const handleSchedule = async () => {
    if (!selectedDragon || !user || !scheduledDate) return;
    setIsSending(true);
    try {
      const [hours, minutes] = scheduledTime.split(':').map(Number);
      const runAt = new Date(scheduledDate);
      runAt.setHours(hours, minutes, 0, 0);

      // If preview was generated, use it as static_message; otherwise use ai_prompt for edge function generation
      const useStaticFromPreview = messageType === 'ai-generated' && previewMessage;

      const { error } = await supabase.from('scheduled_telegram_jobs').insert({
        user_id: user.id,
        job_name: `${selectedDragon.dragonName} Dragon Message`,
        ai_prompt: useStaticFromPreview ? null : (messageType === 'ai-generated' ? aiPrompt.trim() : null),
        static_message: useStaticFromPreview ? previewMessage.trim() : (messageType === 'manual' ? manualMessage.trim() : null),
        party_id: partyId,
        dm_context_mode: 'empyrean_dragon',
        repeat_daily: repeatDaily,
        run_at: runAt.toISOString(),
        run_time: scheduledTime,
        status: 'active',
        ai_model: 'google/gemini-2.5-flash',
        include_campaign_context: true,
      });

      if (error) throw error;
      toast.success('Dragon message scheduled');
      setAiPrompt('');
      setManualMessage('');
      setPreviewMessage(null);
      setScheduledDate(undefined);
      setRepeatDaily(false);
      await loadJobs();
    } catch (err) {
      console.error('[DragonScheduler] Schedule error:', err);
      toast.error('Failed to schedule dragon message');
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    const { error } = await supabase.from('scheduled_telegram_jobs').delete().eq('id', jobId);
    if (error) {
      toast.error('Failed to delete job');
    } else {
      setJobs(prev => prev.filter(j => j.id !== jobId));
      toast.success('Scheduled message removed');
    }
  };

  const handleSubmit = () => {
    if (messageMode === 'instant') handleSendNow();
    else handleSchedule();
  };

  const getBondColor = (bond: number) => {
    if (bond >= 70) return 'bg-emerald-500';
    if (bond >= 40) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto bg-gradient-to-b from-red-950/95 via-orange-950/90 to-amber-950/85 border-amber-700/40 pb-8">
        <SheetHeader className="pb-3">
          <SheetTitle className="flex items-center gap-2 text-amber-400 font-cinzel text-lg">
            <Flame className="h-5 w-5 text-orange-500" />
            Dragon Messenger
          </SheetTitle>
          <p className="text-xs text-amber-600/70">Send messages voiced by your bonded dragons via Telegram</p>
        </SheetHeader>

        {/* Telegram warning banner */}
        {hasLinkedTelegram === false && (
          <div className="flex items-center gap-2 p-2.5 mb-3 rounded-lg bg-red-950/60 border border-red-700/40 text-red-300">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-400" />
            <p className="text-[11px] leading-tight">
              No Telegram accounts linked — players won't receive these messages. Ask them to link Telegram in Settings.
            </p>
          </div>
        )}

        {/* Dragon selector */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
          {dragons.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-4 w-full text-center">No dragons bonded yet</p>
          ) : (
            dragons.map(d => {
              const isSelected = selectedDragonUserId === d.userId;
              return (
                <button
                  key={d.userId}
                  onClick={() => {
                    setSelectedDragonUserId(d.userId);
                    setPreviewMessage(null);
                    setIsEditingPreview(false);
                  }}
                  className={cn(
                    'flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-lg border transition-all min-w-[80px]',
                    isSelected
                      ? 'border-amber-500 bg-amber-500/15 animate-[dragon-glow_2s_ease-in-out_infinite]'
                      : 'border-amber-900/30 bg-black/20 hover:border-amber-700/50'
                  )}
                >
                  <Flame className={cn('h-5 w-5', isSelected ? 'text-amber-400' : 'text-amber-700/60')} />
                  <span className="text-[11px] font-cinzel text-amber-300 truncate max-w-[70px]">{d.dragonName}</span>
                  <span className="text-[9px] text-amber-600/60 truncate max-w-[70px]">{d.signetType}</span>
                  {/* Bond indicator bar */}
                  <div className="w-full h-1 rounded-full bg-black/30 mt-0.5 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', getBondColor(d.bond))}
                      style={{ width: `${Math.min(100, d.bond)}%` }}
                    />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 mt-3 mb-2">
          {(['instant', 'scheduled'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setMessageMode(mode)}
              className={cn(
                'flex-1 py-1.5 text-xs font-medium rounded-md transition-all',
                messageMode === mode
                  ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40'
                  : 'text-amber-600/50 hover:text-amber-500 border border-transparent'
              )}
            >
              {mode === 'instant' ? '🔥 Send Now' : '⏰ Schedule'}
            </button>
          ))}
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-1 mb-2">
          {(['ai-generated', 'manual'] as const).map(t => (
            <button
              key={t}
              onClick={() => {
                setMessageType(t);
                setPreviewMessage(null);
                setIsEditingPreview(false);
              }}
              className={cn(
                'flex-1 py-1 text-[11px] rounded transition-all flex items-center justify-center gap-1',
                messageType === t
                  ? 'bg-orange-700/25 text-amber-300 border border-orange-600/30'
                  : 'text-amber-700/50 hover:text-amber-500 border border-transparent'
              )}
            >
              {t === 'ai-generated' ? <><Sparkles className="h-3 w-3" /> AI Voice</> : <><Send className="h-3 w-3" /> Manual</>}
            </button>
          ))}
        </div>

        {/* Message input */}
        {messageType === 'ai-generated' ? (
          <div className="space-y-2">
            <Textarea
              value={aiPrompt}
              onChange={e => {
                setAiPrompt(e.target.value);
                if (previewMessage) setPreviewMessage(null);
              }}
              placeholder="What should the dragon speak about? e.g. 'warn the rider about the approaching storm' or 'comment on the battle's outcome with dark humor'"
              className="bg-black/30 border-amber-800/30 text-amber-100 placeholder:text-amber-700/40 min-h-[80px] text-sm"
            />
            {/* Generate Preview button */}
            <Button
              onClick={handleGeneratePreview}
              disabled={!selectedDragon || !aiPrompt.trim() || isGenerating}
              size="sm"
              className="bg-purple-900/50 hover:bg-purple-800/60 text-purple-200 border border-purple-600/30 text-xs disabled:opacity-40"
            >
              {isGenerating ? (
                <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Generating...</>
              ) : (
                <><Sparkles className="h-3 w-3 mr-1" /> Generate Preview</>
              )}
            </Button>

            {/* Preview box */}
            {previewMessage && (
              <div className="relative rounded-lg border border-amber-500/30 bg-amber-950/40 p-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-amber-500/70 uppercase tracking-wider font-cinzel">🔥 Dragon's Voice Preview</span>
                  <button
                    onClick={() => setIsEditingPreview(!isEditingPreview)}
                    className="text-amber-500/50 hover:text-amber-400 transition-colors"
                    title={isEditingPreview ? 'Done editing' : 'Edit preview'}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
                {isEditingPreview ? (
                  <Textarea
                    value={previewMessage}
                    onChange={e => setPreviewMessage(e.target.value)}
                    className="bg-black/30 border-amber-700/30 text-amber-200 text-sm min-h-[60px]"
                  />
                ) : (
                  <p className="text-sm text-amber-200 italic leading-relaxed">{previewMessage}</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <Textarea
            value={manualMessage}
            onChange={e => setManualMessage(e.target.value)}
            placeholder="Type the dragon's message directly..."
            className="bg-black/30 border-amber-800/30 text-amber-100 placeholder:text-amber-700/40 min-h-[80px] text-sm"
          />
        )}

        {/* Schedule-only fields */}
        {messageMode === 'scheduled' && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-[10px] text-amber-600/60 uppercase tracking-wider mb-1 block">Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn(
                      'w-full justify-start text-left text-xs bg-black/30 border-amber-800/30 text-amber-200',
                      !scheduledDate && 'text-amber-700/40'
                    )}>
                      <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                      {scheduledDate ? format(scheduledDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-red-950 border-amber-800/40" align="start">
                    <Calendar
                      mode="single"
                      selected={scheduledDate}
                      onSelect={setScheduledDate}
                      disabled={date => date < new Date()}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="w-[100px]">
                <label className="text-[10px] text-amber-600/60 uppercase tracking-wider mb-1 block">Time</label>
                <div className="relative">
                  <Clock className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-amber-700/50" />
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={e => setScheduledTime(e.target.value)}
                    className="w-full h-10 pl-7 pr-2 text-xs rounded-md bg-black/30 border border-amber-800/30 text-amber-200"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => setRepeatDaily(!repeatDaily)}
              className={cn(
                'flex items-center gap-2 text-xs py-1.5 px-2 rounded-md border transition-all w-full',
                repeatDaily
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                  : 'border-amber-900/20 text-amber-700/50 hover:text-amber-500'
              )}
            >
              <Repeat className="h-3.5 w-3.5" />
              Repeat daily
            </button>
          </div>
        )}

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={!canSend || (messageMode === 'scheduled' && !scheduledDate)}
          className="w-full mt-3 bg-gradient-to-r from-amber-700 to-orange-700 hover:from-amber-600 hover:to-orange-600 text-amber-100 border border-amber-500/30 font-cinzel disabled:opacity-40"
        >
          <Flame className="h-4 w-4 mr-1.5" />
          {isSending ? 'Sending...' : messageMode === 'instant' ? 'Send Dragon Message' : 'Schedule Dragon Message'}
        </Button>

        {/* Jobs list */}
        {jobs.length > 0 && (
          <div className="mt-4 border-t border-amber-800/20 pt-3">
            <h4 className="text-[11px] text-amber-600/60 uppercase tracking-wider mb-2 font-cinzel">Scheduled Dragon Messages</h4>
            <div className="space-y-1.5">
              {jobs.map(job => (
                <div key={job.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded bg-black/20 border border-amber-900/20">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-amber-300 font-cinzel truncate">{job.job_name}</p>
                    <p className="text-[10px] text-amber-600/50">
                      {new Date(job.run_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {job.repeat_daily && (
                      <Badge className="text-[9px] bg-amber-700/20 text-amber-400 border-amber-600/30 px-1.5 py-0">
                        <Repeat className="h-2.5 w-2.5 mr-0.5" /> daily
                      </Badge>
                    )}
                    <button onClick={() => handleDeleteJob(job.id)} className="p-1 text-red-500/60 hover:text-red-400 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fire glow animation */}
        <style>{`
          @keyframes dragon-glow {
            0%, 100% { box-shadow: 0 0 8px rgba(245, 158, 11, 0.2), 0 0 16px rgba(234, 88, 12, 0.1); }
            50% { box-shadow: 0 0 16px rgba(245, 158, 11, 0.35), 0 0 24px rgba(234, 88, 12, 0.2); }
          }
        `}</style>
      </SheetContent>
    </Sheet>
  );
}
