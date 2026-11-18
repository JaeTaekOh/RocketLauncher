export default ({ config }) => ({
  ...config,
  name: 'Pocket Budget',
  slug: 'pocket-budget',
  version: '1.4.0',
  android: { package: 'com.sim.pocketbudget', versionCode: 14 },
  ios: { bundleIdentifier: 'com.sim.pocketbudget', buildNumber: '14' },
  extra: { apiUrl: process.env.API_URL },
});
