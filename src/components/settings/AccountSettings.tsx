import { useState, useCallback } from 'react';
import { Mail, Lock, Loader2, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { z } from 'zod';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

interface AccountSettingsProps {
  userEmail: string;
}

export function AccountSettings({ userEmail }: AccountSettingsProps) {
  const [expanded, setExpanded] = useState(false);
  
  // Email change state
  const [newEmail, setNewEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const handleChangeEmail = useCallback(async () => {
    const result = emailSchema.safeParse(newEmail);
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }
    if (newEmail === userEmail) {
      toast.error('New email is the same as current email');
      return;
    }

    setEmailLoading(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setEmailLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Email updated successfully');
      setNewEmail('');
    }
  }, [newEmail, userEmail]);

  const handleChangePassword = useCallback(async () => {
    const pwResult = passwordSchema.safeParse(newPassword);
    if (!pwResult.success) {
      toast.error(pwResult.error.errors[0].message);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (!currentPassword) {
      toast.error('Please enter your current password');
      return;
    }

    setPasswordLoading(true);

    // Verify current password by re-authenticating
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: currentPassword,
    });

    if (signInError) {
      setPasswordLoading(false);
      toast.error('Current password is incorrect');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [currentPassword, newPassword, confirmPassword, userEmail]);

  return (
    <div className="rounded-lg border border-border/50 bg-muted/20">
      <button
        className="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-muted/40 rounded-lg transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-primary" />
          Account Settings
        </span>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-4">
          <Separator />

          {/* Change Email */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Mail className="w-3 h-3" />
              Change Email
            </Label>
            <p className="text-xs text-muted-foreground">
              Current: <span className="text-foreground">{userEmail}</span>
            </p>
            <Input
              type="email"
              placeholder="New email address"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleChangeEmail()}
              className="h-8 text-sm"
            />
            <Button
              size="sm"
              className="w-full gap-1.5"
              onClick={handleChangeEmail}
              disabled={emailLoading || !newEmail}
            >
              {emailLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
              Update Email
            </Button>
          </div>

          <Separator />

          {/* Change Password */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Lock className="w-3 h-3" />
              Change Password
            </Label>
            <div className="relative">
              <Input
                type={showCurrentPassword ? 'text' : 'password'}
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="h-8 text-sm pr-8"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                tabIndex={-1}
              >
                {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="relative">
              <Input
                type={showNewPassword ? 'text' : 'password'}
                placeholder="New password (min 6 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-8 text-sm pr-8"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowNewPassword(!showNewPassword)}
                tabIndex={-1}
              >
                {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <Input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleChangePassword()}
              className="h-8 text-sm"
            />
            <Button
              size="sm"
              className="w-full gap-1.5"
              onClick={handleChangePassword}
              disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
            >
              {passwordLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
              Update Password
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
