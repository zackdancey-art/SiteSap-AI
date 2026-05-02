import React from 'react';
import { AuthProvider } from '../lib/auth';

import type { ReactNode } from 'react';

export default function App({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
