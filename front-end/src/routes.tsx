import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Suspense, type ReactNode } from 'react';
import { MainLayout } from '@/layouts/MainLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PublicRoute } from '@/components/PublicRoute';
import { Login } from '@/pages/Login';
import { Register } from '@/pages/Register';
import { ForgotPassword } from '@/pages/ForgotPassword';
import { Dashboard } from '@/pages/Dashboard';
import { WhatsAppHub } from '@/pages/WhatsAppHub';
import { Contacts } from '@/pages/Contacts';
import { NotFound } from '@/pages/NotFound';
import { LoadingState } from '@/components/StateViews';
import {
  BroadcastQueue,
  DraftsStudio,
  HelpCenterPage,
  OcrReader,
  Profile,
  SettingsPage,
} from '@/routes/lazyPages';

function withSuspense(node: ReactNode) {
  return <Suspense fallback={<LoadingState title="Carregando página" />}>{node}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <PublicRoute>
        <Login />
      </PublicRoute>
    ),
  },
  {
    path: '/register',
    element: (
      <PublicRoute>
        <Register />
      </PublicRoute>
    ),
  },
  {
    path: '/forgot-password',
    element: (
      <PublicRoute>
        <ForgotPassword />
      </PublicRoute>
    ),
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: '', element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'whatsapp', element: <WhatsAppHub /> },
      { path: 'contacts', element: <Contacts /> },
      { path: 'ocr', element: withSuspense(<OcrReader />) },
      { path: 'drafts', element: withSuspense(<DraftsStudio />) },
      { path: 'broadcast', element: withSuspense(<BroadcastQueue />) },
      { path: 'profile', element: withSuspense(<Profile />) },
      { path: 'settings', element: withSuspense(<SettingsPage />) },
      { path: 'help', element: withSuspense(<HelpCenterPage />) },
      { path: 'audit', element: <Navigate to="/dashboard" replace /> },
      { path: 'telemetry', element: <Navigate to="/dashboard" replace /> },
      { path: 'api-keys', element: <Navigate to="/dashboard" replace /> },
    ],
  },
  {
    path: '*',
    element: <NotFound />,
  },
]);

export default router;
