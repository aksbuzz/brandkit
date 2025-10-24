import { Outlet } from 'react-router-dom';
import { MainLayout } from '../../components/layouts/MainLayout';

export const ErrorBoundary = () => {
  return <div>Something went wrong!</div>;
};

const AppRoot = () => {
  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome!</h2>
          <p className="text-gray-600">Manage your brand assets and transformation presets</p>
        </div>

        <Outlet />
      </div>
    </MainLayout>
  );
};

export default AppRoot;
