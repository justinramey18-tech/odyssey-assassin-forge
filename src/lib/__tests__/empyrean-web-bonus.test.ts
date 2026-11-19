import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WEB_BONUS_EVENT, WEB_MAX_HP_KEY, readWebMaxHp, webMaxHpFor, writeWebMaxHp } from '@/lib/empyrean-web-bonus';

describe('progression web: the max HP bonus the sheet reads', () => {
  beforeEach(() => { localStorage.clear(); });

  it('is 0 until the server has sent one', () => {
    expect(readWebMaxHp()).toBe(0);
  });

  it('saves the bonus, tells the sheet once, and stays quiet when nothing changed', () => {
    const heard = vi.fn();
    window.addEventListener(WEB_BONUS_EVENT, heard);
    expect(writeWebMaxHp(15)).toBe(true);
    expect(readWebMaxHp()).toBe(15);
    expect(writeWebMaxHp(15)).toBe(false);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(writeWebMaxHp(0)).toBe(true);
    expect(readWebMaxHp()).toBe(0);
    expect(heard).toHaveBeenCalledTimes(2);
    window.removeEventListener(WEB_BONUS_EVENT, heard);
  });

  it('keeps each character apart', () => {
    localStorage.setItem('odyssey-active-cloud-save-id', 'rider-a');
    writeWebMaxHp(45);
    localStorage.setItem('odyssey-active-cloud-save-id', 'rider-b');
    expect(readWebMaxHp()).toBe(0);
    writeWebMaxHp(3);
    localStorage.setItem('odyssey-active-cloud-save-id', 'rider-a');
    expect(readWebMaxHp()).toBe(45);
    expect(localStorage.getItem(`${WEB_MAX_HP_KEY}::rider-b`)).toBe('3');
  });

  it('treats junk, negatives and absurd numbers as safe values', () => {
    for (const bad of ['abc', '-5', 'NaN', '']) { localStorage.setItem(WEB_MAX_HP_KEY, bad); expect(readWebMaxHp()).toBe(0); }
    localStorage.setItem(WEB_MAX_HP_KEY, '99999');
    expect(readWebMaxHp()).toBe(200);
    localStorage.setItem(WEB_MAX_HP_KEY, '12.9');
    expect(readWebMaxHp()).toBe(12);
    expect(writeWebMaxHp(undefined)).toBe(true);
    expect(readWebMaxHp()).toBe(0);
  });

  it('counts only in Empyrean mode', () => {
    expect(webMaxHpFor('empyrean', 45)).toBe(45);
    for (const mode of ['fullAccess', 'party', 'storyteller', 'solo', null, undefined]) expect(webMaxHpFor(mode, 45)).toBe(0);
    expect(webMaxHpFor('empyrean', -4)).toBe(0);
  });
});
