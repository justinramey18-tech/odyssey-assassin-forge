import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adoptStrandedEmpyreanSetup, applyPendingLaunch, clearLaunch, saveLaunch, waitForSaveId } from '@/lib/empyrean-onboarding';
import { loadEmpyreanDMConfig, loadEmpyreanOpeningScene } from '@/lib/empyreanDMPersona';

const SAVE = 'odyssey-active-cloud-save-id';
const empyrean = { dragonName: 'Ancalagon', dragonColor: 'black', dragonPersonality: 'Old and patient.', signetType: 'Shadowwielder', yearAtBasgiath: 'first-year', campaignFocus: 'mystery' };
const campaign = { startLocationId: 'basgiath', events: 'normal', openingScene: 'The parapet is slick with rain and the wind wants you dead. Below, the ravine waits.' };

describe('Empyrean launch and the rider\'s save id (CL-068)', () => {
  beforeEach(() => { localStorage.clear(); clearLaunch(); });
  afterEach(() => { vi.useRealTimers(); });

  it('before the fix: a setup applied before the save id exists is invisible to the saved rider', () => {
    saveLaunch('Kylar Stern', empyrean as never, campaign as never);
    expect(applyPendingLaunch()).toBe(true);
    expect(loadEmpyreanDMConfig()?.dragonName).toBe('Ancalagon');
    localStorage.setItem(SAVE, 'save-1');
    expect(loadEmpyreanDMConfig()).toBeNull();
    expect(loadEmpyreanOpeningScene()).toBe('');
  });

  it('waitForSaveId resolves as soon as the first cloud save stores the id', async () => {
    vi.useFakeTimers();
    let got: string | null | undefined;
    void waitForSaveId(20000, 250).then(id => { got = id; });
    await vi.advanceTimersByTimeAsync(1000);
    expect(got).toBeUndefined();
    localStorage.setItem(SAVE, 'save-1');
    await vi.advanceTimersByTimeAsync(250);
    expect(got).toBe('save-1');
  });

  it('waitForSaveId gives up after the limit (the save failed) and resolves null', async () => {
    vi.useFakeTimers();
    let got: string | null | undefined;
    void waitForSaveId(2000, 250).then(id => { got = id; });
    await vi.advanceTimersByTimeAsync(2250);
    expect(got).toBeNull();
  });

  it('applied after the id exists, the setup belongs to the rider', async () => {
    saveLaunch('Kylar Stern', empyrean as never, campaign as never);
    localStorage.setItem(SAVE, 'save-1');
    await waitForSaveId();
    applyPendingLaunch();
    expect(localStorage.getItem('empyrean-dm-config::save-1')).not.toBeNull();
    expect(localStorage.getItem('empyrean-dm-config')).toBeNull();
    expect(loadEmpyreanDMConfig()?.dragonName).toBe('Ancalagon');
  });

  it('repair: a stranded setup moves to the rider with the same name', () => {
    saveLaunch('Kylar Stern', empyrean as never, campaign as never);
    applyPendingLaunch();
    localStorage.setItem(SAVE, 'save-1');
    expect(adoptStrandedEmpyreanSetup('Kylar Stern')).toBe(true);
    expect(loadEmpyreanDMConfig()?.dragonName).toBe('Ancalagon');
    expect(loadEmpyreanOpeningScene()).toBe(campaign.openingScene);
    expect(localStorage.getItem('empyrean-dm-config')).toBeNull();
    expect(adoptStrandedEmpyreanSetup('Kylar Stern')).toBe(false);
  });

  it('repair never hands one rider\'s setup to another, and never overwrites a rider\'s own', () => {
    saveLaunch('Kylar Stern', empyrean as never, campaign as never);
    applyPendingLaunch();
    localStorage.setItem(SAVE, 'save-2');
    expect(adoptStrandedEmpyreanSetup('Someone Else')).toBe(false);
    expect(loadEmpyreanDMConfig()).toBeNull();
    localStorage.setItem('empyrean-dm-config::save-2', JSON.stringify({ characterName: 'Kylar Stern', dragonName: 'Tairn' }));
    expect(adoptStrandedEmpyreanSetup('Kylar Stern')).toBe(false);
    expect(loadEmpyreanDMConfig()?.dragonName).toBe('Tairn');
  });

  it('repair does nothing without a save id', () => {
    saveLaunch('Kylar Stern', empyrean as never, campaign as never);
    applyPendingLaunch();
    expect(adoptStrandedEmpyreanSetup('Kylar Stern')).toBe(false);
  });
});
