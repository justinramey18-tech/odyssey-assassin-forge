// Temporary diagnostic logger. Remove when ability-lockup bug is fixed.
// Writes events to an in-memory ring buffer + dispatches a DOM event so the
// DebugStrip component can re-render.

export interface DebugEvent {
  t: number;          // timestamp (ms since page load)
  tag: string;        // short category tag
  msg: string;        // human-readable message
}

const MAX_EVENTS = 30;
const BUFFER: DebugEvent[] = [];

export function debugLog(tag: string, msg: string) {
  const evt: DebugEvent = { t: Math.round(performance.now()), tag, msg };
  BUFFER.push(evt);
  if (BUFFER.length > MAX_EVENTS) BUFFER.shift();
  // Fire a DOM event so DebugStrip re-renders.
  try {
    window.dispatchEvent(new CustomEvent('debug-log-update'));
  } catch { /* noop */ }
  // Also log to console for desktop inspection.
  console.log(`[${evt.t}ms] [${tag}]`, msg);
}

export function getDebugEvents(): DebugEvent[] {
  return BUFFER.slice();
}

export function sampleDomState(label: string) {
  try {
    const body = document.body;
    const root = document.getElementById('root');
    const bodyPE = body ? getComputedStyle(body).pointerEvents : '(no body)';
    const rootPE = root ? getComputedStyle(root).pointerEvents : '(no root)';
    const bodyStyle = body?.getAttribute('style') || '';
    const dataStates = Array.from(document.querySelectorAll('[data-state="open"]')).length;
    const fixedOverlays = Array.from(document.querySelectorAll('.fixed.inset-0')).length;
    debugLog('dom', `${label} bodyPE=${bodyPE} rootPE=${rootPE} openOverlays=${dataStates} fixedInset0=${fixedOverlays} bodyStyle="${bodyStyle.slice(0, 80)}"`);
  } catch (e) {
    debugLog('dom-err', String(e));
  }
}
