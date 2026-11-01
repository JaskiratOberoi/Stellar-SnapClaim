// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The Anthropic SDK ships an ESM build whose circular re-exports trip a
// temporal-dead-zone error when Metro's dev-mode React Refresh walks every
// export eagerly. Resolving the SDK through its CommonJS build avoids that.
const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@anthropic-ai/sdk' || moduleName.startsWith('@anthropic-ai/sdk/')) {
    return context.resolveRequest(
      { ...context, unstable_conditionNames: ['require', 'default'] },
      moduleName,
      platform,
    );
  }
  return (upstreamResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
