import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { NAMES_FROM_ZOOM, ProgressionWeb, WEB_CANVAS, ZOOM_MAX, ZOOM_MIN, clampZoom, layoutWeb } from '@/components/empyrean/ProgressionWeb';

import type { RulesWeb } from '@/lib/empyrean-rules-client';

import { webView, normalizeLedger } from '../../../../supabase/functions/empyrean-rules/web';



const web = (xp: number, nodes: string[] = []): RulesWeb => webView(normalizeLedger({ web: { nodes, camps: { c1: xp }, grant: 0 } }));

const TRUNK = [1, 2, 3, 4, 5].map(i => `vitality-${i}`);

const node = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}, `) });

// jsdom's pointer events carry no position, so build them from mouse events.

const pointer = (el: Element, type: string, pointerId: number, clientX: number, clientY: number) => {

  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY });

  Object.defineProperty(e, 'pointerId', { value: pointerId });

  fireEvent(el, e);

};



describe('progression web: where things sit on the canvas', () => {

  const rider = layoutWeb(web(0).spokes.filter(s => s.half === 'rider'));



  it('places all 105 rider nodes and all 75 dragon nodes inside the canvas, none on top of another', () => {

    const dragon = layoutWeb(web(0).spokes.filter(s => s.half === 'dragon'));

    expect(rider.nodes.length).toBe(105);

    expect(dragon.nodes.length).toBe(75);

    for (const half of [rider, dragon]) {

      for (const p of half.nodes) {

        expect(p.x).toBeGreaterThan(40); expect(p.x).toBeLessThan(WEB_CANVAS - 40);

        expect(p.y).toBeGreaterThan(40); expect(p.y).toBeLessThan(WEB_CANVAS - 40);

      }

      let closest = Infinity;

      half.nodes.forEach((a, i) => half.nodes.slice(i + 1).forEach(b => { closest = Math.min(closest, Math.hypot(a.x - b.x, a.y - b.y)); }));

      // The biggest node is 74 px across and a name sits under each one; they must not crowd.

      expect(closest).toBeGreaterThanOrEqual(96);

      // Pulled all the way together the nodes shrink with the web, so they still do not touch.

      expect(closest * ZOOM_MIN).toBeGreaterThanOrEqual(74 * ZOOM_MIN);

    }

  });

  it('runs the trunk out from the hub and fans the five branches from its last node', () => {

    const at = (id: string) => { const p = rider.nodes.find(n => n.node.id === id); if (!p) throw new Error(id); return p; };

    const hub = WEB_CANVAS / 2;

    expect(at('vitality-1').from).toEqual({ x: hub, y: hub });

    expect(at('vitality-1').x).toBe(hub);

    expect(at('vitality-5').y).toBeLessThan(at('vitality-1').y);

    const tip = { x: at('vitality-5').x, y: at('vitality-5').y };

    for (const b of ['tough', 'ward', 'regen', 'adren', 'blood']) {

      expect(at(`${b}-1`).from).toEqual(tip);

      expect(at(`${b}-2`).from).toEqual({ x: at(`${b}-1`).x, y: at(`${b}-1`).y });

    }

    // The branches spread left to right in the order the server lists them.

    const xs = ['tough', 'ward', 'regen', 'adren', 'blood'].map(b => at(`${b}-5`).x);

    expect([...xs].sort((a, b) => a - b)).toEqual(xs);

  });



  it('two neighbouring spokes that both branch keep clear of each other', () => {

    const of = (prefixes: string[]) => rider.nodes.filter(p => prefixes.some(x => p.node.id.startsWith(x)));

    const vitality = of(['vitality-', 'tough-', 'ward-', 'regen-', 'adren-', 'blood-']);

    const channel = of(['channel-', 'reserve-', 'power-', 'control-', 'recover-', 'mastery-']);

    expect(vitality.length).toBe(30); expect(channel.length).toBe(30);

    let closest = Infinity;

    for (const a of vitality) for (const b of channel) closest = Math.min(closest, Math.hypot(a.x - b.x, a.y - b.y));

    expect(closest).toBeGreaterThanOrEqual(100);

  });



  it('labels every spoke and branch on both halves, and a spoke with no nodes is still drawn as a stub', () => {

    expect(rider.stubs.length).toBe(0);

    const texts = rider.labels.map(l => l.text);

    for (const t of ['Vitality', 'Channel', 'Blade', 'Tempo', 'Saddle', 'Toughness', 'Ward', 'Regeneration', 'Adrenaline', 'Lifeblood', 'Reservoir', 'Power', 'Control', 'Recovery', 'Mastery', 'Edge', 'Precision', 'Initiative', 'Evasion', 'Guidance', 'Mounted']) expect(texts).toContain(t);

    const dragon = layoutWeb(web(0).spokes.filter(s => s.half === 'dragon'));

    expect(dragon.stubs.length).toBe(0);

    const names = dragon.labels.map(l => l.text);

    for (const t of ['Vigor', 'Fang and Flame', 'Wing', 'Scale', 'Loyalty', 'Mending', 'Endurance', 'Fang', 'Flame', 'Swoop', 'Flight', 'Hide', 'Guardian', 'Fierce', 'Devoted']) expect(names).toContain(t);

    const empty = layoutWeb(web(0).spokes.filter(s => s.half === 'dragon').map(s => ({ ...s, coming: true, nodes: [] })));

    expect(empty.nodes.length).toBe(0);

    expect(empty.stubs.length).toBe(5);

  });

  it('two branches of a 15-node spoke keep clear of each other and of the next spoke', () => {

    const of = (prefixes: string[]) => rider.nodes.filter(p => prefixes.some(x => p.node.id.startsWith(x)));

    const blade = of(['blade-', 'edge-', 'precise-']);

    const tempo = of(['tempo-', 'init-', 'evade-']);

    const channel = of(['channel-', 'reserve-', 'power-', 'control-', 'recover-', 'mastery-']);

    expect(blade.length).toBe(15); expect(tempo.length).toBe(15);

    for (const [one, other] of [[blade, tempo], [blade, channel]]) {

      let closest = Infinity;

      for (const a of one) for (const b of other) closest = Math.min(closest, Math.hypot(a.x - b.x, a.y - b.y));

      expect(closest).toBeGreaterThanOrEqual(100);

    }

  });

  it('draws a web from an older server (no parents, no branches) as plain lines', () => {

    const old = web(0).spokes.filter(s => s.id === 'channel').map(s => ({ ...s, branches: undefined, nodes: s.nodes.map(({ parent: _p, branch: _b, soon: _s, ...n }) => n) }));

    const l = layoutWeb(old);

    expect(l.nodes.length).toBe(30);

    expect(l.nodes[1].from).toEqual({ x: l.nodes[0].x, y: l.nodes[0].y });

  });

});



describe('progression web screen', () => {

  afterEach(() => cleanup());



  it('renders nothing while closed', () => {

    const r = render(<ProgressionWeb open={false} onClose={vi.fn()} web={web(150)} onBuy={vi.fn()} />);

    expect(r.container.innerHTML).toBe('');

  });



  it('says the game server is needed when there is no web', () => {

    render(<ProgressionWeb open onClose={vi.fn()} web={null} onBuy={vi.fn()} />);

    expect(screen.getByText(/needs the game server/)).toBeTruthy();

  });



  it('shows the XP to spend, a canvas to drag, and a hint until a node is tapped', () => {

    render(<ProgressionWeb open onClose={vi.fn()} web={web(150)} onBuy={vi.fn()} />);

    expect(screen.getByTestId('web-balance').textContent).toBe('150');

    const canvas = screen.getByTestId('web-canvas');

    expect(canvas.style.touchAction).toBe('none');

    expect(screen.getByText(/Drag to explore/)).toBeTruthy();

    expect(screen.getAllByRole('button', { name: /, (owned|can unlock|locked|coming)$/ }).length).toBe(105);

  });



  it('tapping a node shows what it does; buying needs the confirm step', async () => {

    const onBuy = vi.fn(async () => true);

    render(<ProgressionWeb open onClose={vi.fn()} web={web(150)} onBuy={onBuy} />);

    fireEvent.click(node('Hale'));

    expect(screen.getByText('Max HP +3.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '150 XP' }));

    expect(onBuy).not.toHaveBeenCalled();

    expect(screen.getByText('Spend 150 XP on Hale?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Spend 150 XP on Hale?')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '150 XP' }));

    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));

    await waitFor(() => expect(onBuy).toHaveBeenCalledWith('vitality-1'));

    expect(onBuy).toHaveBeenCalledTimes(1);

  });



  it('a drag moves the canvas both ways at once and never counts as a tap on a node', () => {

    render(<ProgressionWeb open onClose={vi.fn()} web={web(150)} onBuy={vi.fn()} />);

    const canvas = screen.getByTestId('web-canvas');

    canvas.scrollLeft = 500; canvas.scrollTop = 400;

    pointer(node('Hale'), 'pointerdown', 1, 200, 300);

    pointer(canvas, 'pointermove', 1, 197, 303);

    expect(canvas.scrollLeft).toBe(500);

    pointer(canvas, 'pointermove', 1, 140, 380);

    expect(canvas.scrollLeft).toBe(560);

    expect(canvas.scrollTop).toBe(320);

    pointer(canvas, 'pointerup', 1, 140, 380);

    fireEvent.click(node('Hale'));

    expect(screen.getByText(/Drag to explore/)).toBeTruthy();

    // A plain tap afterwards still chooses the node.

    pointer(node('Hale'), 'pointerdown', 2, 200, 300);

    pointer(canvas, 'pointerup', 2, 201, 300);

    fireEvent.click(node('Hale'));

    expect(screen.getByText('Max HP +3.')).toBeTruthy();

  });



  it('the zoom buttons spread the web apart and pull it together, between fixed limits', () => {

    render(<ProgressionWeb open onClose={vi.fn()} web={web(150)} onBuy={vi.fn()} />);

    const left = () => parseFloat(node('Hale').style.left);

    const size = () => node('Hale').style.width;

    const start = left();

    const big = size();

    const out = screen.getByRole('button', { name: 'Spread the web apart' });

    const inn = screen.getByRole('button', { name: 'Pull the web together' });

    fireEvent.click(out);

    expect(left()).toBeCloseTo(start * 1.25, 3);

    // Spread apart, the node itself does not grow: only the gaps change.

    expect(size()).toBe(big);

    expect(node('Hale').style.transform).toContain('scale(1)');

    for (let i = 0; i < 6; i++) fireEvent.click(out);

    expect(left()).toBeCloseTo(start * ZOOM_MAX, 3);

    expect((out as HTMLButtonElement).disabled).toBe(true);

    for (let i = 0; i < 12; i++) fireEvent.click(inn);

    expect(left()).toBeCloseTo(start * ZOOM_MIN, 3);

    expect((inn as HTMLButtonElement).disabled).toBe(true);

    // Pulled together, the node shrinks with the web.

    expect(node('Hale').style.transform).toContain(`scale(${ZOOM_MIN})`);

    expect(clampZoom(99)).toBe(ZOOM_MAX);

    expect(clampZoom(Number.NaN)).toBe(1);

  });



  it('node names are printed on the canvas until the web is pulled too far together', () => {

    render(<ProgressionWeb open onClose={vi.fn()} web={web(150)} onBuy={vi.fn()} />);

    expect(screen.getAllByTestId('web-node-name').length).toBe(105);

    const inn = screen.getByRole('button', { name: 'Pull the web together' });

    fireEvent.click(inn);

    expect(1 / 1.25).toBeGreaterThanOrEqual(NAMES_FROM_ZOOM);

    expect(screen.getAllByTestId('web-node-name').length).toBe(105);

    fireEvent.click(inn);

    expect(screen.queryAllByTestId('web-node-name').length).toBe(0);

  });



  it('two fingers pinch to zoom, and a pinch never counts as a tap', () => {

    render(<ProgressionWeb open onClose={vi.fn()} web={web(150)} onBuy={vi.fn()} />);

    const canvas = screen.getByTestId('web-canvas');

    const start = parseFloat(node('Hale').style.left);

    pointer(node('Hale'), 'pointerdown', 1, 100, 300);

    pointer(canvas, 'pointerdown', 2, 200, 300);

    pointer(canvas, 'pointermove', 2, 250, 300);

    expect(parseFloat(node('Hale').style.left)).toBeCloseTo(start * 1.5, 3);

    pointer(canvas, 'pointermove', 2, 150, 300);

    expect(parseFloat(node('Hale').style.left)).toBeCloseTo(start * 0.5, 3);

    pointer(canvas, 'pointerup', 2, 150, 300);

    pointer(canvas, 'pointerup', 1, 100, 300);

    fireEvent.click(node('Hale'));

    expect(screen.getByText(/Drag to explore/)).toBeTruthy();

  });



  it('a locked node says what it needs and cannot be bought', () => {

    render(<ProgressionWeb open onClose={vi.fn()} web={web(5000)} onBuy={vi.fn()} />);

    fireEvent.click(node('Thick Hide'));

    expect(screen.getByText('Vitality · Toughness')).toBeTruthy();

    expect(screen.getByText('Unlock Ironblooded first.')).toBeTruthy();

    expect((screen.getByRole('button', { name: '150 XP' }) as HTMLButtonElement).disabled).toBe(true);

  });



  it('owned nodes are marked, and the branch opens once the trunk is done', () => {

    render(<ProgressionWeb open onClose={vi.fn()} web={web(5000, TRUNK)} onBuy={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Ironblooded, owned' })).toBeTruthy();

    expect(screen.getByRole('button', { name: 'Thick Hide, can unlock' })).toBeTruthy();

    fireEvent.click(node('Ironblooded'));

    expect(screen.getByText('Owned')).toBeTruthy();

  });



  it('every branch opens once the trunk is done, and its first node can be bought', async () => {

    const onBuy = vi.fn(async () => true);

    render(<ProgressionWeb open onClose={vi.fn()} web={web(5000, TRUNK)} onBuy={onBuy} />);

    for (const name of ['Thick Hide', 'First Ward', 'Slow Mend', 'Quickened Pulse', 'Open Vein']) expect(screen.getByRole('button', { name: `${name}, can unlock` })).toBeTruthy();

    expect(screen.queryAllByRole('button', { name: /, coming$/ }).length).toBe(0);

    fireEvent.click(node('First Ward'));

    expect(screen.getByText('Vitality · Ward')).toBeTruthy();

    expect(screen.getByText(/4-point Ward/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '150 XP' }));

    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));

    await waitFor(() => expect(onBuy).toHaveBeenCalledWith('ward-1'));

  });



  it('the dragon half is paid with Kinship: its own balance, its own prices, and a line on how it is earned', async () => {

    const onBuy = vi.fn(async () => true);

    const both: RulesWeb = webView(normalizeLedger({ web: { nodes: [], camps: { c1: 150 }, grant: 0, kcamps: { c1: 4 }, kgrant: 0 } }));

    render(<ProgressionWeb open onClose={vi.fn()} web={both} onBuy={onBuy} />);

    fireEvent.click(node('First Reserve'));

    expect(screen.getByText('Signet Strain limit +1.')).toBeTruthy();

    expect(screen.getByTestId('web-balance').textContent).toBe('150');

    expect(screen.getByText(/XP to spend/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Dragon' }));

    expect(screen.getByTestId('web-balance').textContent).toBe('4');

    expect(screen.getByText(/Kinship to spend/)).toBeTruthy();

    expect(screen.getByText(/Kinship comes from time with your dragon/)).toBeTruthy();

    expect(screen.getAllByRole('button', { name: /, (owned|can unlock|locked|coming)$/ }).length).toBe(75);

    expect(screen.getByText('Loyalty')).toBeTruthy();

    fireEvent.click(node('Hearty'));

    expect(screen.getByText("Your dragon's max HP +10.")).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '3 Kinship' }));

    expect(screen.getByText('Spend 3 Kinship on Hearty?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));

    await waitFor(() => expect(onBuy).toHaveBeenCalledWith('vigor-1'));

    // A web from an older server (no Kinship, no currency on the nodes) still draws, priced in XP.

    cleanup();

    const old = { ...both, kin: undefined, spokes: both.spokes.map(s => ({ ...s, nodes: s.nodes.map(({ currency: _c, ...n }) => n) })) } as RulesWeb;

    render(<ProgressionWeb open onClose={vi.fn()} web={old} onBuy={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Dragon' }));

    expect(screen.getByTestId('web-balance').textContent).toBe('0');

  });

  it('closes from the header', () => {

    const onClose = vi.fn();

    render(<ProgressionWeb open onClose={onClose} web={web(150)} onBuy={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Close'));

    expect(onClose).toHaveBeenCalledTimes(1);

  });

});

