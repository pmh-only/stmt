import { icons } from '@lucide/svelte';

const legacyIconNames: Record<string, string> = {
  check: 'Check',
  x: 'X',
  'circle-help': 'CircleHelp',
  'refresh-cw': 'RefreshCw',
  split: 'Split',
  tag: 'Tag',
  'message-circle': 'MessageCircle',
  circle: 'Circle',
  'triangle-alert': 'TriangleAlert'
};

export function normalizeIconName(name: string) {
  return legacyIconNames[name] ?? name;
}

function iconLabel(name: string) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .replace(/([A-Za-z])([0-9])/g, '$1 $2');
}

export const pillIconOptions = [
  { value: '', label: 'None' },
  ...Object.keys(icons)
    .sort((a, b) => iconLabel(a).localeCompare(iconLabel(b)))
    .map((name) => ({ value: name, label: iconLabel(name) }))
];
