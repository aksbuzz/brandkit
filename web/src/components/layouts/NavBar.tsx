import { NavLink } from 'react-router-dom';
import { cn } from '../../utils/cn';

const tabs = [
  { key: 'assets', label: 'Assets', to: '/assets' },
  { key: 'presets', label: 'Presets', to: '/presets' },
] as const;

export function NavBar() {
  return (
    <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-b-gray-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <h1 className="text-2xl font-bold text-gray-900">BrandKit Engine</h1>

            <nav className="flex space-x-4">
              {tabs.map(tab => (
                <NavLink
                  key={tab.key}
                  to={tab.to}
                  end
                  className={({ isActive }) =>
                    cn(
                      'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700'
                    )
                  }
                >
                  {tab.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
