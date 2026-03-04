import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Clock, Sparkles, Trash2, Loader2 } from 'lucide-react';
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

export function ScheduledEventsSheet({ open, onOpenChange, partyId }: ScheduledEventsSheetProps) {
  const { user } = useAuth();
  const [events, setEvents] = useState<ScheduledEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  // Form state
  const [eventName, setEventName] = useState('');
  const [eventPrompt, setEventPrompt] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [timeValue, setTimeValue] = useState('17:00');

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
    if (!selectedDate || !eventPrompt.trim() || !user) {
      toast.error('Pick a date, time, and describe the event');
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
      // 1. Insert the event record
      const { data: event, error: insertErr } = await supabase
        .from('party_scheduled_events')
        .insert({
          party_id: partyId,
          created_by: user.id,
          event_name: eventName.trim() || 'Scheduled Event',
          event_prompt: eventPrompt.trim(),
          scheduled_at: scheduledDate.toISOString(),
        })
        .select('id')
        .single();

      if (insertErr || !event) {
        throw new Error(insertErr?.message || 'Failed to create event');
      }

      // 2. Schedule the QStash callback
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

      // 3. Update event with QStash message ID
      if (result?.messageId) {
        await supabase
          .from('party_scheduled_events')
          .update({ qstash_message_id: result.messageId })
          .eq('id', event.id);
      }

      toast.success(`Event scheduled for ${format(scheduledDate, 'PPP p')}`);
      setEventName('');
      setEventPrompt('');
      setSelectedDate(undefined);
      setTimeValue('17:00');
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
            Scheduled Narrative Events
          </SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-4 space-y-4 overflow-y-auto max-h-[75vh]">
          {/* Create form */}
          <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">New Event</Label>

            <Input
              placeholder="Event name (e.g., 'Ambush at Midnight')"
              value={eventName}
              onChange={e => setEventName(e.target.value)}
              className="text-sm"
            />

            <Textarea
              placeholder="Describe what should happen... (e.g., 'A band of orc raiders attacks the camp while the party sleeps. There are 6 orcs and 1 orc captain.')"
              value={eventPrompt}
              onChange={e => setEventPrompt(e.target.value)}
              rows={3}
              className="text-sm resize-none"
            />

            <div className="flex gap-2">
              {/* Date picker */}
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

              {/* Time picker */}
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

            <Button
              onClick={handleSchedule}
              disabled={scheduling || !selectedDate || !eventPrompt.trim()}
              className="w-full"
              size="sm"
            >
              {scheduling ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Scheduling...</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> Schedule Event</>
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
                    <p className="text-sm font-medium text-foreground truncate">{event.event_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{event.event_prompt}</p>
                    <p className="text-xs text-amber-400 mt-1">
                      ⏰ {format(new Date(event.scheduled_at), 'PPP p')}
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
                    <p className="text-sm font-medium text-foreground truncate">{event.event_name}</p>
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
              No scheduled events yet. Create one above to trigger an AI narrative at a specific date and time.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
