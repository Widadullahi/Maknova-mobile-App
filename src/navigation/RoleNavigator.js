import { EstateManagerNavigator } from './EstateManagerNavigator';
import { BuyerNavigator } from './BuyerNavigator';
import { ResidentNavigator } from './ResidentNavigator';
import { SecurityNavigator } from './SecurityNavigator';
import { ROLES } from '../constants/roles';
import { useAuth } from '../context/AuthContext';

const NAVIGATOR_BY_ROLE = {
  [ROLES.ESTATE_MANAGER]: EstateManagerNavigator,
  [ROLES.ADMIN]: EstateManagerNavigator,
  [ROLES.SUPER_ADMIN]: EstateManagerNavigator,
  [ROLES.BUYER]: BuyerNavigator,
  [ROLES.PUBLIC_USER]: BuyerNavigator,
  [ROLES.RESIDENT]: ResidentNavigator,
  [ROLES.SECURITY]: SecurityNavigator,
};

export function RoleNavigator() {
  const { user } = useAuth();
  const Navigator = NAVIGATOR_BY_ROLE[user?.role] || EstateManagerNavigator;

  return <Navigator />;
}
