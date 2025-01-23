import { Config } from './types';
import dotenv from 'dotenv';

dotenv.config();

export function loadConfig(): Config {
    return {
        smtp: {
            host: process.env.SMTP_HOST || '',
            port: parseInt(process.env.SMTP_PORT || '587'),
            user: process.env.SMTP_USER || '',
            pass: process.env.SMTP_PASS || ''
        },
        mail: {
            from: process.env.MAIL_FROM || '',
            to: process.env.MAIL_TO || ''
        },
        animeNames: (process.env.ANIME_NAMES || '').split(',').map(name => name.trim()),
        httpProxy: process.env.HTTP_PROXY || 'http://127.0.0.1:7890',
        api: {
            baseUrl: process.env.API_BASE_URL || 'https://openani.an-i.workers.dev',
            pathPrefix: process.env.API_PATH_PREFIX || '2025-1'
        }
    };
} 
