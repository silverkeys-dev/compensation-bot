import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import logger from './logger';

const STATE_FILE = join(process.cwd(), 'config', 'key_mode.json');

const LIVE_KEYS_PATH = join(process.cwd(), '..', 'bots', 'silverkeysbot', 'live_keys.txt');
const TEST_KEYS_PATH = join(process.cwd(), '..', 'bots', 'silverkeysbot', 'test_keys.txt');

export type KeyMode = 'live' | 'test';

interface KeyModeState {
  mode: KeyMode;
  toggled_by: string | null;
  toggled_at: string | null;
}

/**
 * Load the current key mode state from disk
 */
export function getKeyMode(): KeyModeState {
  try {
    if (!existsSync(STATE_FILE)) {
      // Default to test mode for safety
      const defaultState: KeyModeState = {
        mode: 'test',
        toggled_by: null,
        toggled_at: null
      };
      saveKeyMode(defaultState);
      return defaultState;
    }

    const data = readFileSync(STATE_FILE, 'utf-8');
    return JSON.parse(data) as KeyModeState;
  } catch (error) {
    logger.error('Failed to load key mode state:', error);
    return { mode: 'test', toggled_by: null, toggled_at: null };
  }
}

/**
 * Save the key mode state to disk
 */
export function saveKeyMode(state: KeyModeState): void {
  try {
    const configDir = join(process.cwd(), 'config');
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
    logger.info(`Key mode saved: ${state.mode}`);
  } catch (error) {
    logger.error('Failed to save key mode state:', error);
  }
}

/**
 * Toggle between live and test key files
 */
export function toggleKeyMode(toggledBy: string): KeyModeState {
  const current = getKeyMode();
  const newMode: KeyMode = current.mode === 'live' ? 'test' : 'live';

  const newState: KeyModeState = {
    mode: newMode,
    toggled_by: toggledBy,
    toggled_at: new Date().toISOString()
  };

  saveKeyMode(newState);
  logger.info(`Key mode toggled from ${current.mode} to ${newMode} by ${toggledBy}`);
  return newState;
}

/**
 * Get the path to the currently active key file
 */
export function getActiveKeyFilePath(): string {
  const state = getKeyMode();
  return state.mode === 'live' ? LIVE_KEYS_PATH : TEST_KEYS_PATH;
}

/**
 * Read keys from the currently active key file
 */
export function readActiveKeys(): string[] {
  const filePath = getActiveKeyFilePath();

  try {
    if (!existsSync(filePath)) {
      logger.warn(`Key file not found: ${filePath}`);
      return [];
    }

    const keyMode = getKeyMode();
    const content = readFileSync(filePath, 'utf-8');
    const keys = content
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);

    logger.info(`Read ${keys.length} keys from ${keyMode.mode === 'live' ? 'live' : 'test'} keys file`);
    return keys;
  } catch (error) {
    logger.error(`Failed to read keys from ${filePath}:`, error);
    return [];
  }
}

/**
 * Get the absolute paths for both key files
 */
export function getKeyFilePaths(): { live: string; test: string } {
  return {
    live: LIVE_KEYS_PATH,
    test: TEST_KEYS_PATH
  };
}

export default {
  getKeyMode,
  saveKeyMode,
  toggleKeyMode,
  getActiveKeyFilePath,
  readActiveKeys,
  getKeyFilePaths
};