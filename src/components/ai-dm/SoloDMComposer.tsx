import { forwardRef, memo, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { CharacterContext } from '@/components/oracle/types';
import type { SocialCheckResult } from '@/lib/npcSocialChecks';
import { parseNpcTags } from '@/lib/parseNpcTags';
import { NpcSocialCheckToolbar } from './NpcSocialCheckToolbar';
import { SoloDMInput, type SoloDMInputHandle } from './SoloDMInput';

interface SoloDMComposerProps {
  onSend: (text: string) => void;
  onSocialSend: (npcName: string, message: string, result: SocialCheckResult) => void;
  onCancel: () => void;
  onPaste: (event: React.ClipboardEvent) => void;
  isLoading: boolean;
  npcNames: string[];
  characterContext: CharacterContext;
  inputClassName?: string;
  sendActiveClassName?: string;
  enhanceContext?: { characterName?: string; abilities?: string[]; spells?: string[] };
}

/**
 * Owns every live-keystroke concern for the Solo DM composer. The large DM
 * screen receives text only when the player submits, so typing cannot redraw it.
 */
export const SoloDMComposer = memo(forwardRef<SoloDMInputHandle, SoloDMComposerProps>(function SoloDMComposer({
  onSend,
  onSocialSend,
  onCancel,
  onPaste,
  isLoading,
  npcNames,
  characterContext,
  inputClassName,
  sendActiveClassName,
  enhanceContext,
}, forwardedRef) {
  const inputRef = useRef<SoloDMInputHandle>(null);
  const [draftSnapshot, setDraftSnapshot] = useState('');
  const [locked, setLocked] = useState(false);
  const pendingSocialRef = useRef<{ npcName: string; message: string } | null>(null);

  useImperativeHandle(forwardedRef, () => ({
    setText: (text) => inputRef.current?.setText(text),
    appendText: (text) => inputRef.current?.appendText(text),
    getText: () => inputRef.current?.getText() ?? '',
    focus: () => inputRef.current?.focus(),
    submit: () => inputRef.current?.submit(),
  }), []);

  const socialParse = useMemo(
    () => parseNpcTags(draftSnapshot, npcNames),
    [draftSnapshot, npcNames]
  );
  const toolbarVisible = draftSnapshot.trim().startsWith('@');

  const handleSkillTap = useCallback(() => {
    if (!socialParse || socialParse.npcNames.length !== 1) return;
    pendingSocialRef.current = {
      npcName: socialParse.npcNames[0],
      message: socialParse.message,
    };
    setLocked(true);
  }, [socialParse]);

  const handleResolved = useCallback((result: SocialCheckResult) => {
    const pending = pendingSocialRef.current;
    pendingSocialRef.current = null;
    setLocked(false);
    if (!pending) return;
    onSocialSend(pending.npcName, pending.message, result);
    inputRef.current?.setText('');
    setDraftSnapshot('');
  }, [onSocialSend]);

  return (
    <>
      <NpcSocialCheckToolbar
        visible={toolbarVisible}
        npcName={socialParse?.npcNames[0] ?? null}
        ready={socialParse?.npcNames.length === 1}
        characterContext={characterContext}
        disabled={isLoading}
        onSkillTap={handleSkillTap}
        onResolved={handleResolved}
      />
      <SoloDMInput
        ref={inputRef}
        onSend={onSend}
        onCancel={onCancel}
        onPaste={onPaste}
        isLoading={isLoading}
        npcNames={npcNames}
        inputClassName={inputClassName}
        sendActiveClassName={sendActiveClassName}
        onInputChange={setDraftSnapshot}
        locked={locked}
        enhanceContext={enhanceContext}
      />
    </>
  );
}));