import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import logger from './logger';

export interface CompensationConfig {
  category_id: string;
  support_role_id: string;
  request_channel_id: string;
  discord_invite: string;
  redemption_instructions: string;
  ticket_channel_prefix: string;
}

const CONFIG_PATH = join(process.cwd(), 'config', 'compensation_config.json');

export function loadConfig(): CompensationConfig | null {
  try {
    if (!existsSync(CONFIG_PATH)) {
      logger.warn('Config file not found, returning null');
      return null;
    }

    const data = readFileSync(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(data) as CompensationConfig;

    if (!validateConfig(config)) {
      logger.error('Invalid config structure');
      return null;
    }

    logger.info('Config loaded successfully');
    return config;
  } catch (error) {
    logger.error('Failed to load config:', error);
    return null;
  }
}

export function saveConfig(config: CompensationConfig): boolean {
  try {
    if (!validateConfig(config)) {
      logger.error('Invalid config structure, cannot save');
      return false;
    }

    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    logger.info('Config saved successfully');
    return true;
  } catch (error) {
    logger.error('Failed to save config:', error);
    return false;
  }
}

export function validateConfig(config: any): config is CompensationConfig {
  const requiredFields: (keyof CompensationConfig)[] = [
    'category_id',
    'support_role_id',
    'request_channel_id',
    'discord_invite',
    'redemption_instructions',
    'ticket_channel_prefix'
  ];

  for (const field of requiredFields) {
    if (typeof config[field] !== 'string') {
      logger.error(`Missing or invalid field: ${field}`);
      return false;
    }
  }

  return true;
}

export default loadConfig;
