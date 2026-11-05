// Screen switching. Each screen is a function returning { el, enter?, leave? }.
import { stopAll } from './audio.js';

const app = document.getElementById('app');
let leaveCurrent = null;
let currentName = null;
const listeners = new Set();

export function go(screen, ...args) {
  leaveCurrent?.();
  leaveCurrent = null;
  stopAll();
  const view = screen(...args);
  app.replaceChildren(view.el);
  leaveCurrent = view.leave || null;
  currentName = screen.name;
  view.enter?.();
  for (const fn of listeners) fn(currentName);
}

export const currentScreen = () => currentName;
export const onNavigate = (fn) => listeners.add(fn);
