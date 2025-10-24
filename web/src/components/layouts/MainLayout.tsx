import type { PropsWithChildren } from 'react';
import { NavBar } from './NavBar';

type MainLayoutProps = PropsWithChildren & {};

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <NavBar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
