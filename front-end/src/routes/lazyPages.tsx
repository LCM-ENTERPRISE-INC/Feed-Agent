import { lazy, type ComponentType } from 'react';

/** Lazy route pages — isolated so react-refresh can treat this file as components-only. */
export const OcrReader = lazy(() =>
  import('@/pages/OcrReader').then((m) => ({ default: m.OcrReader as ComponentType })),
);

export const DraftsStudio = lazy(() =>
  import('@/pages/DraftsStudio').then((m) => ({ default: m.DraftsStudio as ComponentType })),
);

export const BroadcastQueue = lazy(() =>
  import('@/pages/BroadcastQueue').then((m) => ({ default: m.BroadcastQueue as ComponentType })),
);

export const HelpCenterPage = lazy(() =>
  import('@/pages/HelpCenterPage').then((m) => ({ default: m.HelpCenterPage as ComponentType })),
);

export const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage as ComponentType })),
);

export const Profile = lazy(() =>
  import('@/pages/Profile').then((m) => ({ default: m.Profile as ComponentType })),
);
