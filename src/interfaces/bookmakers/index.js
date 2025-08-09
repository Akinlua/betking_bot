import BetKingBookmaker from './betking/index.js';

const interfaces = {
  betking: (config, browser) => new BetKingBookmaker(config, browser),
};

export function getBookmakerInterface(name, config, browser) {
  const bookmakerFactory = interfaces[name.toLowerCase()];
  if (!bookmakerFactory) {
    throw new Error(`No bookmaker found for name: ${name}`);
  }
  return bookmakerFactory(config, browser);
}
