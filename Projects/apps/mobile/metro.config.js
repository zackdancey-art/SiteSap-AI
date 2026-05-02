const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..', '..');

const config = getDefaultConfig(projectRoot);

// Watch the shared folder so changes are picked up by Metro.
config.watchFolders = config.watchFolders || [];
config.watchFolders.push(path.resolve(workspaceRoot, 'shared'));
config.watchFolders.push(path.resolve(workspaceRoot, 'assets'));

// Map `@sitesnap/shared` to the shared folder so Metro can resolve it.
config.resolver = config.resolver || {};
config.resolver.extraNodeModules = config.resolver.extraNodeModules || {};
config.resolver.extraNodeModules['@sitesnap/shared'] = path.resolve(workspaceRoot, 'shared');

module.exports = config;
