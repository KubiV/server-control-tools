import https from 'node:https';
import http from 'node:http';
import { config } from '../config';
import { logger } from '../logger';
import type { NasStatusResponse, NasStatusState, NasPowerResponse } from '$lib/types';

interface DsmApiResponse<T = Record<string, unknown>> {
	success: boolean;
	data?: T;
	error?: {
		code: number;
		errors?: unknown[];
	};
}

interface DsmAuthData {
	sid: string;
	synotoken?: string;
}

const DSM_ERROR_MESSAGES: Record<number, string> = {
	100: 'Unknown error',
	101: 'Invalid parameter',
	102: 'API does not exist',
	103: 'Method does not exist',
	104: 'Version does not exist',
	105: 'Insufficient permissions',
	106: 'Session timeout',
	107: 'Session interrupted by duplicate login',
	119: 'Invalid SID session token',
	400: 'Invalid username or password',
	401: 'Account is disabled',
	402: 'Permission denied',
	403: 'Two-factor authentication (2FA) is required on this DSM account',
	404: 'Two-factor authentication (2FA) failed',
	406: 'Enforce two-factor authentication'
};

export class NasService {
	private sid: string | null = null;
	private synotoken: string | null = null;
	private lastAuthTime: number = 0;
	private sessionTtlMs: number = 20 * 60 * 1000; // 20 minutes
	private lastKnownState: NasStatusState = 'UNKNOWN';
	private activeHost: string | null = null;

	/**
	 * Get current active or primary NAS host
	 */
	public getHost(): string {
		return this.activeHost || config.nas.host;
	}

	/**
	 * Low-level HTTPS / HTTP request to Synology DSM WebAPI
	 */
	public async request<T = Record<string, unknown>>(
		path: string,
		params: Record<string, string>,
		options: {
			host?: string;
			timeoutMs?: number;
			useAuth?: boolean;
		} = {}
	): Promise<DsmApiResponse<T>> {
		const targetHost = options.host || this.getHost();
		const timeoutMs = options.timeoutMs ?? 6000;
		const isHttps = config.nas.port === 443 || config.nas.port === 5001 || !config.nas.port;

		const postData = new URLSearchParams();
		for (const [key, value] of Object.entries(params)) {
			postData.append(key, value);
		}

		if (options.useAuth && this.sid) {
			postData.append('_sid', this.sid);
		}

		const headers: Record<string, string> = {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Content-Length': Buffer.byteLength(postData.toString()).toString()
		};

		if (options.useAuth && this.synotoken) {
			headers['X-SYNO-TOKEN'] = this.synotoken;
		}

		return new Promise((resolve, reject) => {
			const reqOptions: https.RequestOptions = {
				hostname: targetHost,
				port: config.nas.port,
				path: path,
				method: 'POST',
				headers,
				timeout: timeoutMs,
				rejectUnauthorized: config.nas.rejectUnauthorized
			};

			const transport = isHttps ? https : http;
			const req = transport.request(reqOptions, (res) => {
				let body = '';
				res.setEncoding('utf8');

				res.on('data', (chunk) => {
					body += chunk;
				});

				res.on('end', () => {
					try {
						const json = JSON.parse(body) as DsmApiResponse<T>;
						resolve(json);
					} catch (e) {
						reject(new Error(`Failed to parse DSM response from ${targetHost}: ${body.slice(0, 150)}`));
					}
				});
			});

			req.on('timeout', () => {
				req.destroy(new Error(`DSM connection to ${targetHost}:${config.nas.port} timed out after ${timeoutMs}ms`));
			});

			req.on('error', (err) => {
				reject(err);
			});

			req.write(postData.toString());
			req.end();
		});
	}

	/**
	 * Probe candidate hosts (Tailscale and Local IP fallback) to discover the active route
	 */
	public async discoverReachableHost(): Promise<string | null> {
		const candidates = config.nas.candidateHosts.length > 0 ? config.nas.candidateHosts : [config.nas.host];

		// If current activeHost is working, keep it as first candidate
		const prioritized = this.activeHost
			? [this.activeHost, ...candidates.filter((h) => h !== this.activeHost)]
			: candidates;

		for (const host of prioritized) {
			try {
				logger.debug(`Probing NAS reachability on candidate host: ${host}...`);
				const res = await this.request(
					'/webapi/entry.cgi',
					{
						api: 'SYNO.API.Info',
						version: '1',
						method: 'query',
						query: 'SYNO.API.Auth,SYNO.Core.System'
					},
					{ host, timeoutMs: 3000 }
				);

				if (res.success || (res.error && res.error.code !== 102)) {
					if (this.activeHost !== host) {
						logger.info(`Active NAS host connected via: ${host} (port ${config.nas.port})`);
						// Host changed, invalidate cached auth session
						if (this.activeHost) this.clearSession();
						this.activeHost = host;
					}
					return host;
				}
			} catch {
				// Try next candidate
			}
		}

		return null;
	}

	/**
	 * Authenticate against DSM WebAPI and store session tokens
	 */
	public async authenticate(force = false): Promise<{ success: boolean; error?: string }> {
		const now = Date.now();
		if (!force && this.sid && now - this.lastAuthTime < this.sessionTtlMs) {
			return { success: true };
		}

		if (!config.nas.username || !config.nas.password) {
			const error = 'NAS username and password must be configured in environment variables.';
			logger.warn(error);
			return { success: false, error };
		}

		const targetHost = this.activeHost || config.nas.host;

		try {
			logger.info(`Authenticating with Synology DSM at ${targetHost}:${config.nas.port}...`);

			// Attempt DSM Auth v6 login
			const response = await this.request<DsmAuthData>(
				'/webapi/entry.cgi',
				{
					api: 'SYNO.API.Auth',
					version: '6',
					method: 'login',
					account: config.nas.username,
					passwd: config.nas.password,
					session: 'NASControl',
					format: 'sid',
					enable_syno_token: 'yes'
				},
				{ host: targetHost, timeoutMs: 6000 }
			);

			if (response.success && response.data?.sid) {
				this.sid = response.data.sid;
				this.synotoken = response.data.synotoken || null;
				this.lastAuthTime = Date.now();
				logger.info(`Synology DSM authentication on ${targetHost} successful.`);
				return { success: true };
			}

			// Fallback: Check if version 3 is required
			if (response.error?.code === 104) {
				logger.info(`DSM Auth v6 not supported on ${targetHost}, trying Auth v3...`);
				const fallbackRes = await this.request<DsmAuthData>(
					'/webapi/entry.cgi',
					{
						api: 'SYNO.API.Auth',
						version: '3',
						method: 'login',
						account: config.nas.username,
						passwd: config.nas.password,
						session: 'NASControl',
						format: 'sid'
					},
					{ host: targetHost, timeoutMs: 6000 }
				);

				if (fallbackRes.success && fallbackRes.data?.sid) {
					this.sid = fallbackRes.data.sid;
					this.synotoken = fallbackRes.data.synotoken || null;
					this.lastAuthTime = Date.now();
					logger.info(`Synology DSM authentication (v3 fallback) on ${targetHost} successful.`);
					return { success: true };
				}
			}

			const errorCode = response.error?.code ?? 100;
			const errorMsg = DSM_ERROR_MESSAGES[errorCode] || `DSM Auth Error code ${errorCode}`;
			logger.warn(`Synology DSM authentication on ${targetHost} failed: ${errorMsg}`);
			this.clearSession();
			return { success: false, error: errorMsg };
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.error(`Synology DSM connection error during authentication on ${targetHost}: ${msg}`);
			this.clearSession();
			return { success: false, error: msg };
		}
	}

	/**
	 * Clear cached DSM session tokens
	 */
	public clearSession(): void {
		this.sid = null;
		this.synotoken = null;
		this.lastAuthTime = 0;
	}

	/**
	 * Get overall NAS connectivity and DSM status with dual-host discovery
	 */
	public async getStatus(): Promise<NasStatusResponse> {
		const timestamp = new Date().toISOString();
		const candidateHosts = config.nas.candidateHosts.length > 0 ? config.nas.candidateHosts : [config.nas.host];

		if (!config.nas.host || (config.nas.host === '127.0.0.1' && !config.nas.username)) {
			this.lastKnownState = 'UNKNOWN';
			return {
				state: 'UNKNOWN',
				host: config.nas.host,
				activeHost: undefined,
				candidateHosts,
				port: config.nas.port,
				errorMessage: 'NAS_HOST or NAS_USERNAME is not configured.',
				lastChecked: timestamp
			};
		}

		// Discover active reachable host (Tailscale vs Local IP fallback)
		const reachableHost = await this.discoverReachableHost();

		if (!reachableHost) {
			this.lastKnownState = 'OFFLINE';
			this.clearSession();
			return {
				state: 'OFFLINE',
				host: config.nas.host,
				activeHost: undefined,
				candidateHosts,
				port: config.nas.port,
				errorMessage: `NAS is offline or unreachable on Tailscale and Local LAN (${candidateHosts.join(', ')}).`,
				lastChecked: timestamp
			};
		}

		try {
			// Try authenticating to verify credential status & fetch system info
			const authResult = await this.authenticate();
			if (!authResult.success) {
				this.lastKnownState = 'AUTH_ERROR';
				return {
					state: 'AUTH_ERROR',
					host: config.nas.host,
					activeHost: reachableHost,
					candidateHosts,
					port: config.nas.port,
					errorMessage: authResult.error || 'Authentication error',
					lastChecked: timestamp
				};
			}

			// Query DSM system information if authenticated
			let model: string | undefined;
			let version: string | undefined;
			let uptime: number | undefined;

			try {
				const infoRes = await this.executeWithRetry<{
					model?: string;
					version_details?: { buildnumber?: number; os_name?: string; version?: string };
					uptime?: number;
				}>('SYNO.DSM.Info', '2', 'get');

				if (infoRes.success && infoRes.data) {
					model = infoRes.data.model;
					version = infoRes.data.version_details?.version || infoRes.data.version_details?.os_name;
					uptime = infoRes.data.uptime;
				}
			} catch (infoErr) {
				logger.debug('Could not retrieve detailed DSM Info, NAS is nonetheless online.', {
					err: String(infoErr)
				});
			}

			this.lastKnownState = 'ONLINE';
			return {
				state: 'ONLINE',
				host: config.nas.host,
				activeHost: reachableHost,
				candidateHosts,
				port: config.nas.port,
				model: model || 'Synology NAS',
				version,
				uptime,
				lastChecked: timestamp
			};
		} catch (err) {
			const errMsg = err instanceof Error ? err.message : String(err);
			this.lastKnownState = 'NETWORK_ERROR';
			return {
				state: 'NETWORK_ERROR',
				host: config.nas.host,
				activeHost: reachableHost,
				candidateHosts,
				port: config.nas.port,
				errorMessage: errMsg,
				lastChecked: timestamp
			};
		}
	}

	/**
	 * Execute an authenticated DSM WebAPI call with automatic re-auth on session expiry
	 */
	public async executeWithRetry<T = Record<string, unknown>>(
		api: string,
		version: string,
		method: string,
		additionalParams: Record<string, string> = {}
	): Promise<DsmApiResponse<T>> {
		await this.authenticate();

		const makeCall = () =>
			this.request<T>(
				'/webapi/entry.cgi',
				{
					api,
					version,
					method,
					...additionalParams
				},
				{ host: this.activeHost || config.nas.host, useAuth: true, timeoutMs: 8000 }
			);

		let res = await makeCall();

		// If session expired (codes 105, 106, 119), refresh session and retry once
		if (!res.success && res.error && [105, 106, 119].includes(res.error.code)) {
			logger.info(`DSM session expired on ${this.activeHost} (code ${res.error.code}), re-authenticating...`);
			this.clearSession();
			const reauth = await this.authenticate(true);
			if (reauth.success) {
				res = await makeCall();
			}
		}

		return res;
	}

	/**
	 * Safely shut down the Synology NAS using DSM WebAPI
	 */
	public async shutdown(): Promise<NasPowerResponse> {
		const timestamp = new Date().toISOString();
		const targetHost = this.activeHost || config.nas.host;
		logger.warn(`Initiating safe DSM shutdown on ${targetHost}...`);

		try {
			// Standard DSM shutdown API: SYNO.Core.System v1 method=shutdown
			const res = await this.executeWithRetry('SYNO.Core.System', '1', 'shutdown');

			if (res.success) {
				this.lastKnownState = 'OFFLINE';
				this.clearSession();
				logger.info(`Synology DSM shutdown command accepted by ${targetHost}.`);
				return {
					success: true,
					action: 'shutdown',
					message: `Shutdown signal received by Synology DSM (${targetHost}). Device is powering down.`,
					timestamp
				};
			}

			// Fallback: SYNO.Core.System.Power shutdown
			const powerRes = await this.executeWithRetry('SYNO.Core.System.Power', '1', 'shutdown');
			if (powerRes.success) {
				this.lastKnownState = 'OFFLINE';
				this.clearSession();
				return {
					success: true,
					action: 'shutdown',
					message: `Shutdown signal received by Synology DSM (${targetHost}).`,
					timestamp
				};
			}

			const errorCode = res.error?.code ?? powerRes.error?.code ?? 100;
			const errorMsg = DSM_ERROR_MESSAGES[errorCode] || `DSM Error code ${errorCode}`;
			return {
				success: false,
				action: 'shutdown',
				message: `Shutdown command failed on ${targetHost}: ${errorMsg}`,
				timestamp,
				error: errorMsg
			};
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			logger.error(`Error sending shutdown command to NAS at ${targetHost}: ${errorMsg}`);
			return {
				success: false,
				action: 'shutdown',
				message: `Shutdown request error: ${errorMsg}`,
				timestamp,
				error: errorMsg
			};
		}
	}

	/**
	 * Safely reboot the Synology NAS using DSM WebAPI
	 */
	public async restart(): Promise<NasPowerResponse> {
		const timestamp = new Date().toISOString();
		const targetHost = this.activeHost || config.nas.host;
		logger.warn(`Initiating DSM reboot on ${targetHost}...`);

		try {
			// Standard DSM reboot API: SYNO.Core.System v1 method=reboot
			const res = await this.executeWithRetry('SYNO.Core.System', '1', 'reboot');

			if (res.success) {
				this.lastKnownState = 'STARTING';
				this.clearSession();
				logger.info(`Synology DSM restart command accepted by ${targetHost}.`);
				return {
					success: true,
					action: 'restart',
					message: `Restart signal received by Synology DSM (${targetHost}). Device is rebooting.`,
					timestamp
				};
			}

			// Fallback: SYNO.Core.System.Power reboot
			const powerRes = await this.executeWithRetry('SYNO.Core.System.Power', '1', 'reboot');
			if (powerRes.success) {
				this.lastKnownState = 'STARTING';
				this.clearSession();
				return {
					success: true,
					action: 'restart',
					message: `Restart signal received by Synology DSM (${targetHost}).`,
					timestamp
				};
			}

			const errorCode = res.error?.code ?? powerRes.error?.code ?? 100;
			const errorMsg = DSM_ERROR_MESSAGES[errorCode] || `DSM Error code ${errorCode}`;
			return {
				success: false,
				action: 'restart',
				message: `Restart command failed on ${targetHost}: ${errorMsg}`,
				timestamp,
				error: errorMsg
			};
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			logger.error(`Error sending restart command to NAS at ${targetHost}: ${errorMsg}`);
			return {
				success: false,
				action: 'restart',
				message: `Restart request error: ${errorMsg}`,
				timestamp,
				error: errorMsg
			};
		}
	}
}

export const nasService = new NasService();
