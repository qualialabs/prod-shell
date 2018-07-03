Package.describe({
  name: 'qualia:prod-shell',
  version: '0.0.3',
  summary: 'Enable Meteor shell in production',
  git: 'https://github.com/qualialabs/prod-shell',
  documentation: 'README.md',
});

Package.onUse(function(api) {
  api.versionsFrom('METEOR@1.4');

  api.use([
    'ecmascript',
    'shell-server@0.2.1',
  ], 'server');

  api.addAssets([
    'server/shell_client.js',
  ], 'server');

  api.mainModule('server/main.js', 'server');
});
