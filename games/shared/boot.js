// One error boundary for module loading and initialization on static hosts.
import { SiteTheme } from './engine/SettingsManager.js?v=arcade-platform-1';
import {installGameTouch} from './ui/GameTouch.js?v=20261026-touch-1';
import {requireArcade} from './services/ArcadeServices.js';
SiteTheme.apply();
const root = document.getElementById('game-root');
installGameTouch(root);
const game = document.body.dataset.game;
try {
  const platform = await requireArcade(game, root);
  if (platform) {
  const version = document.body.dataset.gameVersion;
  const moduleUrl = new URL(`../${game}/${game}.js`, import.meta.url);
  if (version) moduleUrl.searchParams.set('v', version);
  const { default: Game } = await import(moduleUrl.href);
  const instance = new Game();
  instance.platform = platform;
  platform.instance = instance;
  await instance.init(root);
  // Keep the current run for browser back/forward cache; pause and save on departure.
  window.addEventListener('pagehide', () => instance.pause());
  }
} catch (error) {
  console.error('Game startup failed:', error);
  if (root.querySelector('.g-start-error')) { /* The account gate already explains how to recover. */ } else {
  root.dataset.startupError = error instanceof Error ? error.message : String(error);
  root.classList.add('ready');
  const message = document.createElement('p');
  message.className = 'g-start-error';
  message.textContent = 'The game could not load. Reload the page to try again. ';
  const back = document.createElement('a');
  back.href = '../../arcade.html'; back.textContent = 'Back to Arcade';
  message.append(back); root.append(message);
  }
}
