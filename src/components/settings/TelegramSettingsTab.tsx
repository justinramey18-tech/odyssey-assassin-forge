import { useState, useEffect, useCallback } from 'react';
import { Send, Link2, Unlink, Copy, RefreshCw, Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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

export function TelegramSettingsTab() {
  const { user } = useAuth();
  const [link, setLink] = useState<TelegramLink | null>(null);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Fetch existing link
  const fetchLink = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('telegram_user_links')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    setLink(data as TelegramLink | null);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchLink(); }, [fetchLink]);

  // Generate link code
  const generateCode = useCallback(async () => {
    if (!user) return;
    setGenerating(true);
    // Delete any existing codes for this user
    await supabase.from('telegram_link_codes').delete().eq('user_id', user.id);

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

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

  // Unlink
  const handleUnlink = useCallback(async () => {
    if (!user) return;
    await supabase.from('telegram_user_links').delete().eq('user_id', user.id);
    setLink(null);
    toast.success('Telegram unlinked');
  }, [user]);

  // Toggle notification preference
  const toggleNotif = useCallback(async (field: string, value: boolean) => {
    if (!user || !link) return;
    const { error } = await supabase
      .from('telegram_user_links')
      .update({ [field]: value })
      .eq('user_id', user.id);

    if (!error) {
      setLink(prev => prev ? { ...prev, [field]: value } : prev);
    } else {
      toast.error('Failed to update preference');
    }
  }, [user, link]);

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
          {link ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-green-500/30 text-green-400 bg-green-500/5">
                  <Link2 className="w-3 h-3 mr-1" />
                  Linked
                </Badge>
                {link.username && (
                  <span className="text-xs text-muted-foreground">@{link.username}</span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Linked {new Date(link.linked_at).toLocaleDateString()}. Notifications will be sent to this Telegram chat.
              </p>
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
                Send Test Notification
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUnlink}
                className="w-full gap-2 h-10 border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                <Unlink className="w-3.5 h-3.5" />
                Unlink Telegram
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Link your Telegram to receive party notifications and roll dice remotely.
              </p>
              <div className="space-y-2">
                <p className="text-[10px] font-medium text-foreground/80 uppercase tracking-wider">Step 1</p>
                <p className="text-xs text-muted-foreground">
                  Open your <b>TeleDnd</b> bot in Telegram and send <code>/start</code>.
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-medium text-foreground/80 uppercase tracking-wider">Step 2</p>
                <p className="text-xs text-muted-foreground">Generate a link code below.</p>
                <Button
                  size="sm"
                  onClick={generateCode}
                  disabled={generating}
                  className="w-full gap-2 h-10"
                >
                  {generating ? (
                    <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Generating...</>
                  ) : (
                    <><Link2 className="w-3.5 h-3.5" />Generate Link Code</>
                  )}
                </Button>
              </div>
              {linkCode && (
                <div className="space-y-2">
                  <p className="text-[10px] font-medium text-foreground/80 uppercase tracking-wider">Step 3</p>
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
          )}
        </SettingsSection>

        {/* Notification Preferences (only when linked) */}
        {link && (
          <SettingsSection title="Notifications" icon={<Bell className="w-4 h-4 text-amber-400" />}>
            <div className="space-y-3">
              <p className="text-[10px] text-muted-foreground">
                Choose which events send a Telegram message.
              </p>

              <NotifToggle
                label="Ready-up alerts"
                description="When a party member readies up"
                checked={link.notify_ready_up}
                onChange={(v) => toggleNotif('notify_ready_up', v)}
              />
              <Separator className="bg-border/20" />
              <NotifToggle
                label="Timer expiry"
                description="When the round timer runs out"
                checked={link.notify_timer}
                onChange={(v) => toggleNotif('notify_timer', v)}
              />
              <Separator className="bg-border/20" />
              <NotifToggle
                label="Combat alerts"
                description="When combat starts or your turn begins"
                checked={link.notify_combat}
                onChange={(v) => toggleNotif('notify_combat', v)}
              />
              <Separator className="bg-border/20" />
              <NotifToggle
                label="Dragon bond"
                description="Messages from your bonded dragon"
                checked={link.notify_dragon}
                onChange={(v) => toggleNotif('notify_dragon', v)}
              />
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
