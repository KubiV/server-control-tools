import crypto from 'node:crypto';
import { config } from '../config';
import { logger } from '../logger';

export const SESSION_COOKIE_NAME = 'server_control_session';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

interface RateLimitRecord {
	attempts: number;
	blockedUntil: number;
}

export class AuthService {
	private rateLimits: Map<string, RateLimitRecord> = new Map();
	private maxAttempts = 5;
	private blockDurationMs = 5 * 60 * 1000; // 5 minutes

	/**
	 * Rate limiter check
	 */
	public isRateLimited(clientIp: string): boolean {
		const record = this.rateLimits.get(clientIp);
		if (!record) return false;
		if (Date.now() < record.blockedUntil) {
			return true;
		}
		if (Date.now() >= record.blockedUntil && record.attempts >= this.maxAttempts) {
			this.rateLimits.delete(clientIp);
		}
		return false;
	}

	/**
	 * Record a failed login attempt
	 */
	public recordFailedAttempt(clientIp: string): void {
		const record = this.rateLimits.get(clientIp) || { attempts: 0, blockedUntil: 0 };
		record.attempts += 1;
		if (record.attempts >= this.maxAttempts) {
			record.blockedUntil = Date.now() + this.blockDurationMs;
			logger.warn(`Client IP ${clientIp} is temporarily blocked due to multiple failed login attempts.`);
		}
		this.rateLimits.set(clientIp, record);
	}

	/**
	 * Reset failed attempts on successful login
	 */
	public resetAttempts(clientIp: string): void {
		this.rateLimits.delete(clientIp);
	}

	/**
	 * Verify password with constant-time comparison
	 */
	public verifyPassword(providedPassword: string): boolean {
		if (!providedPassword || !config.auth.password) return false;
		
		const expectedBuffer = Buffer.from(config.auth.password);
		const providedBuffer = Buffer.from(providedPassword);

		if (expectedBuffer.length !== providedBuffer.length) {
			// Dummy compare to avoid timing leak
			crypto.timingSafeEqual(expectedBuffer, expectedBuffer);
			return false;
		}

		return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
	}

	/**
	 * Generate a signed session token
	 */
	public createSessionToken(): string {
		const payload = {
			iat: Math.floor(Date.now() / 1000),
			exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
		};

		const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
		const signature = crypto
			.createHmac('sha256', config.auth.secret)
			.update(payloadStr)
			.digest('base64url');

		return `${payloadStr}.${signature}`;
	}

	/**
	 * Verify and decode session token
	 */
	public verifySessionToken(token: string | undefined): boolean {
		if (!token || typeof token !== 'string') return false;

		const parts = token.split('.');
		if (parts.length !== 2) return false;

		const [payloadStr, signature] = parts;
		const expectedSignature = crypto
			.createHmac('sha256', config.auth.secret)
			.update(payloadStr)
			.digest('base64url');

		const sigBuf = Buffer.from(signature);
		const expectedSigBuf = Buffer.from(expectedSignature);

		if (sigBuf.length !== expectedSigBuf.length || !crypto.timingSafeEqual(sigBuf, expectedSigBuf)) {
			return false;
		}

		try {
			const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
			if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
				return false;
			}
			return true;
		} catch {
			return false;
		}
	}
}

export const authService = new AuthService();

/**
 * Determine whether session cookies should be marked with the `Secure` flag.
 * In production when accessed directly via HTTP (e.g. LAN IP 192.168.x.x:3000),
 * setting `Secure` causes browsers (Chrome, Safari, Firefox) to discard the cookie.
 */
export function isSecureConnection(request: Request, url: URL): boolean {
	const setting = config.auth.cookieSecure;
	if (setting === 'true' || setting === '1') return true;
	if (setting === 'false' || setting === '0') return false;

	// Check standard HTTPS proxy headers
	const forwardedProto = request.headers.get('x-forwarded-proto');
	if (forwardedProto) {
		return forwardedProto.split(',')[0].trim().toLowerCase() === 'https';
	}

	// Check origin or referer header if available
	const origin = request.headers.get('origin');
	if (origin) {
		if (origin.toLowerCase().startsWith('https://')) return true;
		if (origin.toLowerCase().startsWith('http://')) return false;
	}

	const referer = request.headers.get('referer');
	if (referer) {
		if (referer.toLowerCase().startsWith('https://')) return true;
		if (referer.toLowerCase().startsWith('http://')) return false;
	}

	// Check if host indicates a plain HTTP LAN / localhost connection
	const host = request.headers.get('host') || url.host;
	if (
		host.includes(':3000') ||
		host.includes(':80') ||
		/^(\d{1,3}\.){3}\d{1,3}/.test(host) ||
		host.startsWith('localhost') ||
		host.startsWith('127.0.0.1')
	) {
		return false;
	}

	return url.protocol === 'https:';
}

