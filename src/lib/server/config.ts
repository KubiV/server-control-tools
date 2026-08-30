import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';

// Minimal zero-dependency .env loader for dev/test when process.env isn't already populated
function loadEnvFile() {
	const envPaths = [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '.env.local')];

	for (const envPath of envPaths) {
		if (fs.existsSync(envPath)) {
			try {
				const content = fs.readFileSync(envPath, 'utf8');
				for (const line of content.split('\n')) {
					const trimmed = line.trim();
					if (!trimmed || trimmed.startsWith('#')) continue;
					const idx = trimmed.indexOf('=');
					if (idx !== -1) {
						const key = trimmed.slice(0, idx).trim();
						let value = trimmed.slice(idx + 1).trim();
						if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
							value = value.slice(1, -1);
						}
						if (!process.env[key]) {
							process.env[key] = value;
						}
					}
				}
			} catch {
				// Ignore read errors
			}
		}
	}
}

loadEnvFile();

/**
 * Clean URL or hostname string (e.g. "smb://192.168.1.204", "https://100.1.2.3:5001/" -> "192.168.1.204", "100.1.2.3")
 */
export function sanitizeHost(host: string | undefined): string {
	if (!host) return '';
	let cleaned = host.trim();
	// Remove protocol prefixes like smb://, http://, https://, tcp://
	cleaned = cleaned.replace(/^[a-zA-Z]+:\/\//, '');
	// Remove trailing paths or slashes
	cleaned = cleaned.replace(/\/.*$/, '');
	// Remove port suffix if attached to host (e.g. 192.168.1.204:5001 -> 192.168.1.204)
	if (cleaned.includes(':') && !cleaned.includes(']')) {
		// IPv4 with port
		const lastColon = cleaned.lastIndexOf(':');
		cleaned = cleaned.slice(0, lastColon);
	}
	return cleaned.trim();
}

const envSchema = z.object({
	PORT: z.coerce.number().default(3000),
	NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
	APP_AUTH_SECRET: z.string().default('default-insecure-secret-key-must-be-changed-in-production-32-chars'),
	APP_PASSWORD: z.string().default('admin'),

	// NAS Configuration (Primary Host, e.g. Tailscale IP)
	NAS_HOST: z.string().default('127.0.0.1'),
	// Optional Fallback Host (e.g. Local LAN IP smb://192.168.1.204)
	NAS_FALLBACK_HOST: z.string().optional().default(''),
	NAS_LOCAL_HOST: z.string().optional().default(''),
	NAS_PORT: z.coerce.number().default(5001),
	NAS_USERNAME: z.string().default(''),
	NAS_PASSWORD: z.string().default(''),
	NAS_WOL_MAC: z.string().default('00:00:00:00:00:00'),
	NAS_WOL_BROADCAST_ADDRESS: z.string().default('255.255.255.255'),
	NAS_WOL_PORT: z.coerce.number().default(9),
	NAS_REJECT_UNAUTHORIZED: z.enum(['true', 'false', '1', '0']).default('false'),

	// Docker Configuration
	DOCKER_SOCKET_PATH: z.string().default('/var/run/docker.sock')
});

const parsedEnv = envSchema.parse(process.env);

const primaryHost = sanitizeHost(parsedEnv.NAS_HOST);
const fallbackHost = sanitizeHost(parsedEnv.NAS_FALLBACK_HOST || parsedEnv.NAS_LOCAL_HOST);

const candidateHosts: string[] = [];
if (primaryHost && primaryHost !== '127.0.0.1') candidateHosts.push(primaryHost);
if (fallbackHost && fallbackHost !== primaryHost) candidateHosts.push(fallbackHost);
if (candidateHosts.length === 0 && primaryHost) candidateHosts.push(primaryHost);

export const config = {
	port: parsedEnv.PORT,
	nodeEnv: parsedEnv.NODE_ENV,
	isProduction: parsedEnv.NODE_ENV === 'production',
	auth: {
		secret: parsedEnv.APP_AUTH_SECRET,
		password: parsedEnv.APP_PASSWORD
	},
	nas: {
		host: primaryHost || '127.0.0.1',
		fallbackHost: fallbackHost || '',
		candidateHosts,
		port: parsedEnv.NAS_PORT,
		username: parsedEnv.NAS_USERNAME,
		password: parsedEnv.NAS_PASSWORD,
		wolMac: parsedEnv.NAS_WOL_MAC,
		wolBroadcastAddress: parsedEnv.NAS_WOL_BROADCAST_ADDRESS,
		wolPort: parsedEnv.NAS_WOL_PORT,
		rejectUnauthorized: parsedEnv.NAS_REJECT_UNAUTHORIZED === 'true' || parsedEnv.NAS_REJECT_UNAUTHORIZED === '1'
	},
	docker: {
		socketPath: parsedEnv.DOCKER_SOCKET_PATH
	}
};

/**
 * Mask a MAC address for safe UI / log display.
 * E.g. "00:11:32:44:55:66" -> "00:11:32:••:••:••"
 */
export function maskMacAddress(mac: string): string {
	const cleaned = mac.trim();
	const parts = cleaned.split(/[:-]/);
	if (parts.length === 6) {
		return `${parts[0]}:${parts[1]}:${parts[2]}:••:••:••`;
	}
	if (cleaned.length >= 6) {
		return `${cleaned.slice(0, 6)}••••••`;
	}
	return '••:••:••:••:••:••';
}

/**
 * Returns safe config for client inspection without secrets.
 */
export function getMaskedConfig() {
	return {
		nasHost: config.nas.host,
		nasFallbackHost: config.nas.fallbackHost,
		nasCandidateHosts: config.nas.candidateHosts,
		nasPort: config.nas.port,
		nasWolMacMasked: maskMacAddress(config.nas.wolMac),
		nasConfigured: Boolean(config.nas.host && config.nas.username && config.nas.password),
		dockerSocket: config.docker.socketPath
	};
}
