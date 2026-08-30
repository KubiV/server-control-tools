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
});

