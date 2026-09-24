// Where each role lands after logging in
const HOME_PATHS = {
  admin: '/admin/dashboard',
  client: '/client/dashboard',
  master: '/master/dashboard'
}

/**
 * Home page for a role
 * @param {string} role - 'admin', 'client' or 'master'
 * @returns {string} Route path (the login page for an unknown role)
 */
export function getHomePath(role) {
  return HOME_PATHS[role] || '/login'
}
