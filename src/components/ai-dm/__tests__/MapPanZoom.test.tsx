import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MapPanZoom, baseWidth, centerOn, clampView, clampZoom, zoomAround, MAX_ZOOM } from '../MapPanZoom';

// jsdom has no layout: give the viewport a phone-sized box (360 × 500).
const W = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
const H = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
beforeAll(() => {
  // jsdom has no PointerEvent: a MouseEvent that carries a pointerId.
  if (typeof window.PointerEvent === 'undefined') {
    class PE extends MouseEvent { pointerId: number; constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 0; } }
    (window as unknown as { PointerEvent: unknown }).PointerEvent = PE;
  }
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return this.dataset?.testid === 'map-viewport' ? 360 : 0; } });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get() { return this.dataset?.testid === 'map-viewport' ? 500 : 0; } });
});
afterAll(() => {
  if (W) Object.defineProperty(HTMLElement.prototype, 'clientWidth', W);
  if (H) Object.defineProperty(HTMLElement.prototype, 'clientHeight', H);
});
afterEach(() => cleanup());

describe('map pan and zoom math (CL-071)', () => {
  it('starts large: a wide map fills the viewport height and is wider than the phone', () => {
    expect(baseWidth({ w: 360, h: 500 }, 4 / 3)).toBeCloseTo(666.7, 0);
    expect(baseWidth({ w: 800, h: 300 }, 4 / 3)).toBe(800);
  });
  it('never lets the map leave the viewport; a smaller side is centered', () => {
    expect(clampView({ zoom: 1, x: 50, y: -999 }, { w: 360, h: 500 }, { w: 667, h: 500 })).toEqual({ zoom: 1, x: 0, y: 0 });
    expect(clampView({ zoom: 1, x: -999, y: 0 }, { w: 360, h: 500 }, { w: 667, h: 500 }).x).toBeCloseTo(-307, 0);
    expect(clampView({ zoom: 1, x: 0, y: 0 }, { w: 360, h: 500 }, { w: 360, h: 300 }).y).toBe(100);
  });
  it('pinching keeps the point under the fingers in place', () => {
    const v = zoomAround({ zoom: 1, x: -100, y: 0 }, 2, 180, 250);
    expect(v).toEqual({ zoom: 2, x: -380, y: -250 });
    expect(clampZoom(99)).toBe(MAX_ZOOM);
    expect(clampZoom(0.2)).toBe(1);
  });
  it('centers on the party', () => {
    expect(centerOn({ x: 0.5, y: 0.5 }, 1, { w: 360, h: 500 }, { w: 667, h: 500 }).x).toBeCloseTo(180 - 333.5, 1);
  });
});

describe('MapPanZoom', () => {
  const content = () => screen.getByTestId('map-content');
  const viewport = () => screen.getByTestId('map-viewport');
  const setup = () => {
    const onPin = vi.fn();
    render(
      <MapPanZoom height="500px" aspect={4 / 3} focus={{ x: 0.5, y: 0.5 }}>
        <button type="button" onPointerUp={onPin}>The Courtyard</button>
      </MapPanZoom>,
    );
    return onPin;
  };

  it('opens large and centered on the party', () => {
    setup();
    expect(parseFloat(content().style.width)).toBeCloseTo(666.7, 0);
    expect(content().style.transform).toMatch(/translate3d\(-153\.3\d*px, 0px, 0\)/);
  });

  it('a tap on a pin still works; a drag that ends on it does not tap it, and pans', () => {
    const onPin = setup();
    const pin = screen.getByText('The Courtyard');
    fireEvent.pointerDown(pin, { pointerId: 1, clientX: 200, clientY: 200 });
    fireEvent.pointerUp(pin, { pointerId: 1, clientX: 202, clientY: 201 });
    expect(onPin).toHaveBeenCalledTimes(1);

    const before = content().style.transform;
    fireEvent.pointerDown(pin, { pointerId: 2, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(viewport(), { pointerId: 2, clientX: 260, clientY: 200 });
    fireEvent.pointerUp(pin, { pointerId: 2, clientX: 260, clientY: 200 });
    expect(onPin).toHaveBeenCalledTimes(1);
    expect(content().style.transform).not.toBe(before);
  });

  it('pinch and the buttons zoom; names stay the same size because the map grows instead of scaling', () => {
    setup();
    fireEvent.pointerDown(viewport(), { pointerId: 1, clientX: 100, clientY: 250 });
    fireEvent.pointerDown(viewport(), { pointerId: 2, clientX: 200, clientY: 250 });
    fireEvent.pointerMove(viewport(), { pointerId: 2, clientX: 300, clientY: 250 });
    fireEvent.pointerUp(viewport(), { pointerId: 2, clientX: 300, clientY: 250 });
    fireEvent.pointerUp(viewport(), { pointerId: 1, clientX: 100, clientY: 250 });
    expect(parseFloat(content().style.width)).toBeCloseTo(1333.3, 0);
    expect(content().style.transform).not.toMatch(/scale/);

    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(parseFloat(content().style.width)).toBeCloseTo(888.9, 0);
    fireEvent.click(screen.getByRole('button', { name: 'Center on the party' }));
    expect(content().style.transform).toMatch(/translate3d\(-264\.4\d*px/);
  });
});
