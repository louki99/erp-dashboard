import { NavLink } from 'react-router-dom';
import { Grid3X3, KeyRound, Shield, Sliders, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface RbacNavProps {
  stats?: { total_roles?: number; total_permissions?: number; total_users?: number };
}

const NAV_ITEMS = [
  { to: '/rbac/roles',          icon: Shield,   labelKey: 'modules.rbac.roles',          descKey: 'rbac.nav.rolesDesc' },
  { to: '/rbac/matrix',         icon: Grid3X3,  labelKey: 'modules.rbac.matrix',         descKey: 'rbac.nav.matrixDesc' },
  { to: '/rbac/users',          icon: Users,    labelKey: 'modules.rbac.users',           descKey: 'rbac.nav.usersDesc' },
  { to: '/rbac/access-profiles',icon: Sliders,  labelKey: 'modules.rbac.accessProfiles', descKey: 'rbac.nav.profilesDesc' },
] as const;

export function RbacNav({ stats }: RbacNavProps) {
  const { t } = useTranslation();

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="px-3 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <KeyRound className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900 leading-tight">{t('rbac.nav.title')}</h2>
            <p className="text-[10px] text-gray-400 leading-tight">{t('rbac.nav.subtitle')}</p>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-3 gap-1">
            {stats.total_roles !== undefined && (
              <div className="bg-gray-50 rounded-md px-2 py-1.5 text-center">
                <p className="text-sm font-bold text-gray-900">{stats.total_roles}</p>
                <p className="text-[9px] text-gray-400 uppercase tracking-wide">{t('modules.rbac.roles')}</p>
              </div>
            )}
            {stats.total_permissions !== undefined && (
              <div className="bg-gray-50 rounded-md px-2 py-1.5 text-center">
                <p className="text-sm font-bold text-gray-900">{stats.total_permissions}</p>
                <p className="text-[9px] text-gray-400 uppercase tracking-wide">{t('rbac.nav.statsPerms')}</p>
              </div>
            )}
            {stats.total_users !== undefined && (
              <div className="bg-gray-50 rounded-md px-2 py-1.5 text-center">
                <p className="text-sm font-bold text-gray-900">{stats.total_users}</p>
                <p className="text-[9px] text-gray-400 uppercase tracking-wide">{t('rbac.nav.statsUsers')}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {NAV_ITEMS.map(({ to, icon: Icon, labelKey, descKey }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) =>
              ['flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors group',
               isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium leading-tight truncate ${isActive ? 'text-indigo-700' : ''}`}>
                    {t(labelKey)}
                  </p>
                  <p className="text-[10px] text-gray-400 leading-tight truncate">{t(descKey)}</p>
                </div>
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
