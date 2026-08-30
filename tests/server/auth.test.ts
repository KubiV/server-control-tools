import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from '$lib/server/auth/AuthService';

describe('AuthService', () => {
	let auth: AuthService;

	beforeEach(() => {
		auth = new AuthService();
	});

	it('verifies correct password and rejects incorrect password', () => {
		expect(auth.verifyPassword('admin')).toBe(true);
		expect(auth.verifyPassword('wrong_password')).toBe(false);
		expect(auth.verifyPassword('')).toBe(false);
	});

	it('creates valid HMAC signed session tokens and verifies them', () => {
		const token = auth.createSessionToken();
		expect(token).toBeDefined();
		expect(token).toContain('.');

		const isValid = auth.verifySessionToken(token);
		expect(isValid).toBe(true);
	});

	it('rejects tampered or malformed session tokens', () => {
		const token = auth.createSessionToken();
		const tampered = token.slice(0, -5) + 'abcde';

		expect(auth.verifySessionToken(tampered)).toBe(false);
		expect(auth.verifySessionToken('invalid.token.here')).toBe(false);
		expect(auth.verifySessionToken('')).toBe(false);
		expect(auth.verifySessionToken(undefined)).toBe(false);
	});

	it('enforces rate limiting on repeated failed attempts', () => {
		const ip = '192.168.1.50';
		expect(auth.isRateLimited(ip)).toBe(false);

		// Fail 4 times (below threshold of 5)
		for (let i = 0; i < 4; i++) {
			auth.recordFailedAttempt(ip);
		}
		expect(auth.isRateLimited(ip)).toBe(false);

		// 5th failure triggers rate limit block
		auth.recordFailedAttempt(ip);
		expect(auth.isRateLimited(ip)).toBe(true);

		// Reset clears the block
		auth.resetAttempts(ip);
		expect(auth.isRateLimited(ip)).toBe(false);
	});

	it('detects HTTP vs HTTPS connections correctly for cookie secure flag', async () => {
		const { isSecureConnection } = await import('$lib/server/auth/AuthService');

		// HTTP on LAN IP
		const reqLan = new Request('http://192.168.1.201:3000/api/auth/login', {
			headers: { host: '192.168.1.201:3000', referer: 'http://192.168.1.201:3000/login' }
		});
		expect(isSecureConnection(reqLan, new URL('http://192.168.1.201:3000/api/auth/login'))).toBe(false);

		// HTTPS with x-forwarded-proto
		const reqProxyHttps = new Request('http://127.0.0.1:3000/api/auth/login', {
			headers: { 'x-forwarded-proto': 'https', host: 'nas.domain.com' }
		});
		expect(isSecureConnection(reqProxyHttps, new URL('http://127.0.0.1:3000/api/auth/login'))).toBe(true);

		// HTTPS origin/referer
		const reqHttpsReferer = new Request('http://127.0.0.1:3000/api/auth/login', {
			headers: { referer: 'https://nas.domain.com/login', host: 'nas.domain.com' }
		});
		expect(isSecureConnection(reqHttpsReferer, new URL('http://127.0.0.1:3000/api/auth/login'))).toBe(true);
	});
});


