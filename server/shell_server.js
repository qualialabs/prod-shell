import fs from 'fs';
import path from 'path';
import os from 'os';

let MeteorShell = {

  initialize() {
    return this;
  },

  ensureShellServer() {
    try {
      if (process.env.METEOR_SHELL_DIR) {
        this.shellDir = process.env.METEOR_SHELL_DIR;
      }
      else {
        this.shellDir = process.env.METEOR_SHELL_DIR = this.makeShellDir();
        this.listen(this.shellDir);
      }

      this.createShellClient();
    }
    catch(e) {
      console.error('qualia:prod-shell - Failed to start Meteor shell.', e.stack || e);
    }
  },

  makeShellDir() {
    let folderName = '.meteor-shell',
        folderPath = path.join(process.cwd(), folderName)
    ;

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
    }

    return folderPath;
  },

  // HACK: If the shell server isn't already running, we may need
  // to start it. However, the shell-server package doesn't export
  // a function for starting it. So... we dig into the implementation
  // of ES6 modules in Meteor to get ahold of it anyways.
  // See https://github.com/qualialabs/reval/blob/master/packages/qualia_reval/modules.js
  listen(shellDir) {
    let rootModule = module;
    while (rootModule.parent) {
      rootModule = rootModule.parent;
    }

    let { listen } = rootModule
        .children.find(m => m.id === '/node_modules/meteor/shell-server/main.js')
        .children.find(m => m.id === '/node_modules/meteor/shell-server/shell-server.js')
        .exports
    ;

    listen(shellDir);
  },

  shellClientPath() {
    if (process.env.METEOR_SHELL_CLIENT) {
      return process.env.METEOR_SHELL_CLIENT;
    }

    let folder = Meteor.isDevelopment
        ? process.cwd()
        : os.homedir()
    ;

    return path.join(
      folder,
      'meteor-shell.js'
    );
  },

  createShellClient() {
    let shellClientFile = Assets.getText('server/shell_client.js');
    shellClientFile = `process.env.METEOR_SHELL_DIR = '${this.shellDir}';\n\n` + shellClientFile;
    shellClientFile = Package.ecmascript.ECMAScript.compileForShell(shellClientFile);

    fs.writeFileSync(this.shellClientPath(), shellClientFile);
  },

}.initialize();

export { MeteorShell };
