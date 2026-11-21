// Responder alerts use LOCAL notifications only (the app polls for alerts with every background
// location update). expo-notifications adds the push entitlement `aps-environment`, which a free
// Apple "Personal Team" cannot sign. This plugin removes it.
//
// Listed BEFORE "expo-notifications" in app.json: config-plugin mods run in reverse order of
// registration, so this one runs after the notifications plugin has added the key.
// With a paid Apple Developer account and remote push, delete this plugin.
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = (config) =>
  withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
