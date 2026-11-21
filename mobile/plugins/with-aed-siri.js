// Expo config plugin: adds the Siri App Intents (plugins/ios/AedAppIntents.swift)
// to the main iOS app target during `npx expo prebuild`.
// Expo Go ignores native code, so Siri works only in a development / release build.
const fs = require('fs');
const path = require('path');
const { withDangerousMod, withXcodeProject, IOSConfig } = require('expo/config-plugins');

const FILE = 'AedAppIntents.swift';

const copySwiftFile = (config) =>
  withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectName = IOSConfig.XcodeUtils.getProjectName(cfg.modRequest.projectRoot);
      const dest = path.join(cfg.modRequest.platformProjectRoot, projectName, FILE);
      fs.copyFileSync(path.join(__dirname, 'ios', FILE), dest);
      return cfg;
    },
  ]);

const addToTarget = (config) =>
  withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const projectName = IOSConfig.XcodeUtils.getProjectName(cfg.modRequest.projectRoot);
    const filepath = `${projectName}/${FILE}`;
    if (!project.hasFile(filepath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({ filepath, groupName: projectName, project });
    }
    return cfg;
  });

module.exports = (config) => addToTarget(copySwiftFile(config));
