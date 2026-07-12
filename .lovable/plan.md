# Remove the "Start Campaign" gate

## Goal
The "Manage start of campaign" flow (the amber button at the top of the Party DM screen, the Start Campaign modal, the "Finish your own character before starting" warning, and the "Start Anyway / locked out" logic) is getting in the way of just playing. You've decided to use GM Guides to set the tone/rules of a campaign instead, so this whole gate is unnecessary.

## What will change (user-visible)

- The amber **"Manage start of campaign"** button at the top of the Party DM screen goes away.
- The **Start Campaign** popup (with Player Status / Pending / "Start Anyway (X locked out)") is no longer reachable and won't be shown.
- The **"Finish your own character (via the Architect) before starting the campaign"** warning is gone.
- The **lock-out screen** shown to players who hadn't finished onboarding after the host pressed Start is gone — everyone can participate in the party DM immediately.
- The **"Request Character Redo"** entry in Tools (which was only enabled after the campaign was officially "started") will now be available to non-host players who have completed onboarding, without waiting for a start signal.

## What will NOT change

- GM Guides, Party Chat, Dad Huddle, Tools menu (including Dev Assistant), Couples Mode, Director, memory anchors, campaign saves, scheduled events, and every other feature stay exactly as they are.
- The onboarding/Architect flow itself is untouched — players can still go through it. It's just no longer a wall in front of the campaign.
- The host's ability to open the Campaign Builder from the home screen or Tools is untouched.
- No database changes. No changes to Solo DM or Empyrean setup.

## Files touched

- `src/components/ai-dm/StandalonePartyDMScreen.tsx` — remove the start-campaign button, the `HostStartCampaignPanel` render, the `PlayerLockedOutScreen` block, the `campaignStarted` state, and the `showStartCampaignPanel` state. Update the `onRequestCharacterRedo` condition to drop the `campaignStarted` requirement.
- `src/components/ai-dm/HostStartCampaignPanel.tsx` — delete (no longer used).

That's the entire change. Small, contained, and reversible via chat history if you ever want it back.
