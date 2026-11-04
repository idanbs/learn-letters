// Screen switching. Each screen is a function returning { el, enter?, leave? }.
import { stopAll } from './audio.js';

const app = document.getElementById('app');
let leaveCurrent = null;

export function go(screen, ...args) {
  leaveCurrent?.();
  leaveCurrent = null;
  stopAll();
  const view = screen(...args);
  app.replaceChildren(view.el);
  leaveCurrent = view.leave || null;
  view.enter?.();
}
