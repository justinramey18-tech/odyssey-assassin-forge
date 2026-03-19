import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Clock, Sparkles, Trash2, Loader2, Users, BookOpen, Repeat } from 'lucide-react';
import { DM_MODELS, DEFAULT_MODEL_ID, getModelLabel } from '@/lib/dm-models';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';

interface ScheduledEvent {
  id: string;
  event_name: string;
  event_prompt: string;
  event_type: string;
  recurrence: string | null;
  scheduled_at: string;
  status: string;
  qstash_message_id: string | null;
  created_at: string;
}

interface ScheduledEventsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partyId: string;
}

type EventType = 'narrative_event' | 'scheduled_round';

export function ScheduledEventsSheet({ open, onOpenChange, partyId }: ScheduledEventsSheetProps) {
  const { user } = useAuth();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [events, setEvents] = useState<ScheduledEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Form state
  const [eventType, setEventType] = useState<EventType>('scheduled_round');
  const [eventName, setEventName] = useState('');
  const [eventPrompt, setEventPrompt] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [timeValue, setTimeValue] = useState('17:00');
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [dmContextMode, setDmContextMode] = useState<'solo' | 'party' | 'empyrean'>('party');
  const [aiModel, setAiModel] = useState(DEFAULT_MODEL_ID);

  // Stable fetch function
  const fetchEvents = useCallback(async () => {
    if (!partyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('party_scheduled_events')
        .select('*')
        .eq('party_id', partyId)
        .order('scheduled_at', { ascending: true });

      if (error) {
        console.error('Failed to fetch scheduled events:', error.message);
        return;
      }
      setEvents((data ?? []) as unknown as ScheduledEvent[]);
    } finally {
      setLoading(false);
    }
  }, [partyId]);

  // Fetch events when sheet opens
  useEffect(() => {
    if (!open || !partyId) return;
    fetchEvents();
  }, [open, partyId, fetchEvents]);

  // Realtime subscription
  useEffect(() => {
    if (!partyId) return;
    const channel = supabase
      .channel(`scheduled-events-${partyId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'party_scheduled_events',
        filter: `party_id=eq.${partyId}`,
      }, () => {
        fetchEvents();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [partyId, fetchEvents]);

  async function handleSchedule() {
    if (!selectedDate || !user) {
      toast.error('Pick a date and time');
      return;
    }

    if (eventType === 'narrative_event' && !eventPrompt.trim()) {
      toast.error('Describe the narrative event');
      return;
    }

    // Combine date + time
    const [hours, minutes] = timeValue.split(':').map(Number);
    const scheduledDate = new Date(selectedDate);
    scheduledDate.setHours(hours, minutes, 0, 0);

    if (scheduledDate.getTime() <= Date.now()) {
      toast.error('Scheduled time must be in the future');
      return;
    }

    setScheduling(true);
    try {
      // Insert into party_scheduled_events for UI tracking
      const { data: event, error: insertErr } = await supabase
        .from('party_scheduled_events')
        .insert({
          party_id: partyId,
          created_by: user.id,
          event_name: eventName.trim() || (eventType === 'scheduled_round' ? 'Scheduled Round' : 'Scheduled Event'),
          event_prompt: eventType === 'scheduled_round' ? '' : eventPrompt.trim(),
          event_type: eventType,
          recurrence: repeatWeekly ? 'weekly' : null,
          scheduled_at: scheduledDate.toISOString(),
        })
        .select('id')
        .single();

      if (insertErr || !event) {
        throw new Error(insertErr?.message || 'Failed to create event');
      }

      // Schedule via scheduled_telegram_jobs instead of QStash
      const aiPrompt = eventType === 'narrative_event'
        ? eventPrompt.trim()
        : 'Auto-advance the party round. Generate a brief narrative transition summarizing what happens next.';

      const utcHours = scheduledDate.getUTCHours();
      const utcMinutes = scheduledDate.getUTCMinutes();
      const utcTimeStr = `${String(utcHours).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')}`;

      const { error: jobErr } = await supabase
        .from('scheduled_telegram_jobs')
        .insert({
          user_id: user.id,
          job_name: eventName.trim() || (eventType === 'scheduled_round' ? 'Scheduled Round' : 'Scheduled Event'),
          ai_prompt: aiPrompt,
          static_message: null,
          party_id: partyId,
          include_campaign_context: true,
          run_at: scheduledDate.toISOString(),
          repeat_daily: repeatWeekly,
          run_time: repeatWeekly ? utcTimeStr : null,
          timezone: 'America/New_York',
          dm_context_mode: dmContextMode,
          ai_model: aiModel,
        });

      if (jobErr) {
        throw new Error(jobErr.message || 'Failed to schedule telegram job');
      }

      const recLabel = repeatWeekly ? ' (repeats weekly)' : '';
      toast.success(`${eventType === 'scheduled_round' ? 'Round' : 'Event'} scheduled for ${format(scheduledDate, 'PPP p')}${recLabel}`);
      setEventName('');
      setEventPrompt('');
      setSelectedDate(undefined);
      setTimeValue('17:00');
      setRepeatWeekly(false);
      setDmContextMode('party');
      setAiModel(DEFAULT_MODEL_ID);
      fetchEvents();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scheduling failed');
    } finally {
      setScheduling(false);
    }
  }

  async function handleCancel(eventId: string) {
    const { error } = await supabase
      .from('party_scheduled_events')
      .update({ status: 'cancelled' })
      .eq('id', eventId);

    if (error) {
      toast.error('Failed to cancel event');
    } else {
      toast.success('Event cancelled');
      fetchEvents();
    }
  }

  async function handleDelete(eventId: string) {
    const { error } = await supabase
      .from('party_scheduled_events')
      .delete()
      .eq('id', eventId);

    if (error) {
      toast.error('Failed to delete event');
    } else {
      fetchEvents();
    }
  }

  const pendingEvents = events.filter(e => e.status === 'pending');
  const pastEvents = events.filter(e => e.status !== 'pending');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent ref={sheetRef} side="bottom" className="h-[85vh] rounded-t-2xl p-0">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Scheduled Events
          </SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-4 space-y-4 overflow-y-auto max-h-[75vh]">
          {/* Create form */}
          <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">New Event</Label>

            {/* Event type toggle */}
            <div className="flex gap-1.5 rounded-lg bg-muted/40 p-1">
              <button
                onClick={() => setEventType('scheduled_round')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors",
                  eventType === 'scheduled_round'
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Users className="w-3.5 h-3.5" />
                Round Advance
              </button>
              <button
                onClick={() => setEventType('narrative_event')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors",
                  eventType === 'narrative_event'
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <BookOpen className="w-3.5 h-3.5" />
                Narrative Event
              </button>
            </div>

            {/* DM Context Mode toggle */}
            <div className="flex gap-1.5 rounded-lg bg-muted/40 p-1">
              <button
                onClick={() => setDmContextMode('solo')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors",
                  dmContextMode === 'solo'
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <BookOpen className="w-3.5 h-3.5" />
                Solo DM
              </button>
              <button
                onClick={() => setDmContextMode('party')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors",
                  dmContextMode === 'party'
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Users className="w-3.5 h-3.5" />
                Party DM
              </button>
              <button
                onClick={() => setDmContextMode('empyrean')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors",
                  dmContextMode === 'empyrean'
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Empyrean DM
              </button>
            </div>

            {/* Context mode description */}
            <p className="text-xs text-muted-foreground">
              {dmContextMode === 'solo'
                ? "Uses your solo campaign — character, campaign summary, and quest flags."
                : dmContextMode === 'party'
                ? "Uses this party's campaign — all party members, shared summary, and recent history."
                : "Uses your Empyrean campaign — dragon bond, lore guides, and Empyrean persona."}
            </p>

            {/* Description of selected type */}
            <p className="text-xs text-muted-foreground">
              {eventType === 'scheduled_round'
                ? "Collects all submitted prompts and uses AFK guides for missing players, then advances the round."
                : "Triggers a custom AI narrative event using the prompt you write below."}
            </p>

            {/* AI Model selector */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">AI Model</Label>
              <select
                value={aiModel}
                onChange={e => setAiModel(e.target.value)}
                className="w-full rounded-md border border-border/50 bg-transparent px-3 py-2 text-sm text-foreground"
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

            <Input
              placeholder={eventType === 'scheduled_round' ? "Name (e.g., 'Wednesday Session')" : "Event name (e.g., 'Ambush at Midnight')"}
              value={eventName}
              onChange={e => setEventName(e.target.value)}
              className="text-sm"
            />

            {eventType === 'narrative_event' && (
              <Textarea
                placeholder="Describe what should happen... (e.g., 'A band of orc raiders attacks the camp while the party sleeps.')"
                value={eventPrompt}
                onChange={e => setEventPrompt(e.target.value)}
                rows={3}
                className="text-sm resize-none"
              />
            )}

            <div className="flex gap-2">
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left text-sm font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
                    {selectedDate ? format(selectedDate, 'PPP') : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent container={sheetRef.current} className="w-auto p-0 pointer-events-auto z-[100]" align="start" side="top" avoidCollisions>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date);
                      setCalendarOpen(false);
                    }}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>

              <div className="relative">
                <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  type="time"
                  value={timeValue}
                  onChange={e => setTimeValue(e.target.value)}
                  className="pl-8 w-[120px] text-sm"
                />
              </div>
            </div>

            {/* Repeat weekly toggle */}
            <button
              onClick={() => setRepeatWeekly(!repeatWeekly)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors w-full",
                repeatWeekly
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/50 text-muted-foreground hover:text-foreground"
              )}
            >
              <Repeat className="w-3.5 h-3.5" />
              Repeat every week
              {repeatWeekly && <span className="ml-auto text-[10px] font-medium uppercase tracking-wider">On</span>}
            </button>

            <Button
              onClick={handleSchedule}
              disabled={scheduling || !selectedDate || (eventType === 'narrative_event' && !eventPrompt.trim())}
              className="w-full"
              size="sm"
            >
              {scheduling ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Scheduling...</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> {eventType === 'scheduled_round' ? 'Schedule Round' : 'Schedule Event'}</>
              )}
            </Button>
          </div>

          {/* Pending events */}
          {pendingEvents.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Upcoming</Label>
              {pendingEvents.map(event => (
                <div key={event.id} className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/10 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {event.event_type === 'scheduled_round' ? (
                        <Users className="w-3 h-3 text-primary shrink-0" />
                      ) : (
                        <BookOpen className="w-3 h-3 text-amber-400 shrink-0" />
                      )}
                      <p className="text-sm font-medium text-foreground truncate">{event.event_name}</p>
                    </div>
                    {event.event_type === 'scheduled_round' ? (
                      <p className="text-xs text-muted-foreground mt-0.5">Auto-advances round with AFK guides</p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{event.event_prompt}</p>
                    )}
                    <p className="text-xs text-amber-400 mt-1">
                      ⏰ {format(new Date(event.scheduled_at), 'PPP p')}
                      {event.recurrence === 'weekly' && (
                        <span className="ml-1.5 text-primary">· 🔁 Weekly</span>
                      )}
                      <span className="ml-1.5 text-muted-foreground">
                        · {(event as any).dm_context_mode === 'solo' ? 'Solo DM' : (event as any).dm_context_mode === 'empyrean' ? 'Empyrean DM' : 'Party DM'}
                      </span>
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleCancel(event.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Past events */}
          {pastEvents.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Past Events</Label>
              {pastEvents.map(event => (
                <div key={event.id} className="flex items-start gap-3 rounded-lg border border-border/30 bg-muted/5 p-3 opacity-60">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {event.event_type === 'scheduled_round' ? (
                        <Users className="w-3 h-3 text-primary shrink-0" />
                      ) : (
                        <BookOpen className="w-3 h-3 text-amber-400 shrink-0" />
                      )}
                      <p className="text-sm font-medium text-foreground truncate">{event.event_name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {event.status === 'fired' ? '✅ Fired' : event.status === 'cancelled' ? '❌ Cancelled' : `⚠️ ${event.status}`}
                      {' · '}{format(new Date(event.scheduled_at), 'PPP p')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-8 w-8 text-muted-foreground"
                    onClick={() => handleDelete(event.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {loading && events.length === 0 && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && events.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              No scheduled events yet. Schedule a round advance or narrative event above.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
