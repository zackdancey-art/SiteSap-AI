const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..', '..');

const config = getDefaultConfig(projectRoot);

// Watch the shared folder so changes are picked up by Metro.
config.watchFolders = config.watchFolders || [];
config.watchFolders.push(path.resolve(workspaceRoot, 'shared'));
config.watchFolders.push(path.resolve(workspaceRoot, 'assets'));

// Exclude non-React-Native workspace packages from Metro's resolver so their
// node_modules (e.g. supervisor-web's Next.js deps) don't shadow expo packages.
const supervisorWebModules = path.resolve(workspaceRoot, 'apps', 'supervisor-web', 'node_modules');
config.resolver = config.resolver || {};
config.resolver.blockList = [new RegExp(`^${supervisorWebModules.replace(/[/\\]/g, '[/\\\\]')}.*$`)];

// Ensure Metro resolves node_modules from the workspace root first.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Map `@sitesnap/shared` to the shared folder so Metro can resolve it.
config.resolver.extraNodeModules = config.resolver.extraNodeModules || {};
config.resolver.extraNodeModules['@sitesnap/shared'] = path.resolve(workspaceRoot, 'shared');

module.exports = config;
