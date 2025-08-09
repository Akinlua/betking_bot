import PinnacleProvider from './pinnacle/index.js';

const interfaces = {
  pinnacle: (config) => new PinnacleProvider(config),
};

export function getProviderInterface(name, config) {
  const providerFactory = interfaces[name.toLowerCase()];
  if (!providerFactory) {
    throw new Error(`No provider found for name: ${name}`);
  }
  return providerFactory(config);
}
