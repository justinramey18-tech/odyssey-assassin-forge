import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Clock, Sparkles, Trash2, Loader2, Users, BookOpen, Repeat } from 'lucide-react';
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
  const [events, setEvents] = useState<ScheduledEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  // Form state
  const [eventType, setEventType] = useState<EventType>('scheduled_round');
  const [eventName, setEventName] = useState('');
  const [eventPrompt, setEventPrompt] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [timeValue, setTimeValue] = useState('17:00');
  const [repeatWeekly, setRepeatWeekly] = useState(false);

  // Fetch events
  useEffect(() => {
    if (!open || !partyId) return;
    fetchEvents();
  }, [open, partyId]);

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
  }, [partyId]);

  async function fetchEvents() {
    const { data, error } = await supabase
      .from('party_scheduled_events')
      .select('*')
      .eq('party_id', partyId)
      .order('scheduled_at', { ascending: true });

    if (!error && data) {
      setEvents(data as unknown as ScheduledEvent[]);
    }
  }

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

      const { data: result, error: scheduleErr } = await supabase.functions.invoke('schedule-timer-callback', {
        body: {
          partyId,
          scheduledAt: scheduledDate.toISOString(),
          eventId: event.id,
        },
      });

      if (scheduleErr) {
        throw new Error('Failed to schedule callback');
      }

      if (result?.messageId) {
        await supabase
          .from('party_scheduled_events')
          .update({ qstash_message_id: result.messageId })
          .eq('id', event.id);
      }

      const recLabel = repeatWeekly ? ' (repeats weekly)' : '';
      toast.success(`${eventType === 'scheduled_round' ? 'Round' : 'Event'} scheduled for ${format(scheduledDate, 'PPP p')}${recLabel}`);
      setEventName('');
      setEventPrompt('');
      setSelectedDate(undefined);
      setTimeValue('17:00');
      setRepeatWeekly(false);
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

    if (!error) {
      toast.success('Event cancelled');
      fetchEvents();
    }
  }

  async function handleDelete(eventId: string) {
    const { error } = await supabase
      .from('party_scheduled_events')
      .delete()
      .eq('id', eventId);

    if (!error) {
      fetchEvents();
    }
  }

  const pendingEvents = events.filter(e => e.status === 'pending');
  const pastEvents = events.filter(e => e.status !== 'pending');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl p-0">
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

            {/* Description of selected type */}
            <p className="text-xs text-muted-foreground">
              {eventType === 'scheduled_round'
                ? "Collects all submitted prompts and uses AFK guides for missing players, then advances the round."
                : "Triggers a custom AI narrative event using the prompt you write below."}
            </p>

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
              <Popover>
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
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
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

          {events.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              No scheduled events yet. Schedule a round advance or narrative event above.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
