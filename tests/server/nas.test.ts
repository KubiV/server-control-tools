import { describe, it, expect, beforeEach, vi, type MockInstance } from 'vitest';
import { NasService } from '$lib/server/nas/NasService';
import { sanitizeHost } from '$lib/server/config';

describe('NasService & Host Utilities', () => {
	let nas: NasService;
	let requestSpy: MockInstance;

	beforeEach(() => {
		nas = new NasService();
		nas.clearSession();
		requestSpy = vi.spyOn(nas, 'request');
	});

	it('properly sanitizes various host and protocol strings', () => {
		expect(sanitizeHost('smb://192.168.1.204')).toBe('192.168.1.204');
		expect(sanitizeHost('http://192.168.1.204:5001/')).toBe('192.168.1.204');
		expect(sanitizeHost('https://100.80.70.60:5001')).toBe('100.80.70.60');
		expect(sanitizeHost('192.168.1.204')).toBe('192.168.1.204');
		expect(sanitizeHost('  100.64.0.1  ')).toBe('100.64.0.1');
	});

	it('successfully authenticates with DSM WebAPI v6', async () => {
		requestSpy.mockResolvedValueOnce({
			success: true,
			data: {
				sid: 'mock_sid_token_123',
				synotoken: 'mock_syno_token_abc'
			}
		});

		const result = await nas.authenticate();
		expect(result.success).toBe(true);
		expect(requestSpy).toHaveBeenCalledWith(
			'/webapi/entry.cgi',
			expect.objectContaining({
				api: 'SYNO.API.Auth',
				version: '6',
				method: 'login'
			}),
			expect.anything()
		);
	});

	it('handles authentication failure gracefully (e.g. invalid credentials)', async () => {
		requestSpy.mockResolvedValueOnce({
			success: false,
			error: { code: 400 }
		});

		const result = await nas.authenticate();
		expect(result.success).toBe(false);
		expect(result.error).toContain('Invalid username or password');
	});

	it('handles 2FA required failure gracefully', async () => {
		requestSpy.mockResolvedValueOnce({
			success: false,
			error: { code: 403 }
		});

		const result = await nas.authenticate();
		expect(result.success).toBe(false);
		expect(result.error).toContain('Two-factor authentication');
	});

	it('discovers fallback host when primary host is unreachable', async () => {
		// Mock discovery: first call (primary host) rejects, second call (fallback host) succeeds
		requestSpy.mockRejectedValueOnce(new Error('connect ETIMEDOUT'));
		requestSpy.mockResolvedValueOnce({
			success: true,
			data: {}
		});

		const reachable = await nas.discoverReachableHost();
		expect(reachable).toBeDefined();
		expect(reachable).toBe('192.168.1.204');
	});

	it('reports ONLINE status when DSM responds and authenticates', async () => {
		// Mock discoverReachableHost probe
		requestSpy.mockResolvedValueOnce({
			success: true,
			data: {}
		});
		// Mock auth login
		requestSpy.mockResolvedValueOnce({
			success: true,
			data: { sid: 'valid_sid', synotoken: 'valid_token' }
		});
		// Mock DSM.Info
		requestSpy.mockResolvedValueOnce({
			success: true,
			data: {
				model: 'DS923+',
				version_details: { version: 'DSM 7.2.1-69057' },
				uptime: 86400
			}
		});

		const status = await nas.getStatus();
		expect(status.state).toBe('ONLINE');
		expect(status.model).toBe('DS923+');
		expect(status.version).toBe('DSM 7.2.1-69057');
		expect(status.uptime).toBe(86400);
	});

	it('reports OFFLINE status when all candidate hosts are unreachable', async () => {
		// Both candidate probes fail
		requestSpy.mockRejectedValue(new Error('connect ECONNREFUSED'));

		const status = await nas.getStatus();
		expect(status.state).toBe('OFFLINE');
		expect(status.errorMessage).toContain('offline or unreachable');
	});

	it('executes safe shutdown via DSM API', async () => {
		// Mock authenticate
		requestSpy.mockResolvedValueOnce({
			success: true,
			data: { sid: 'valid_sid', synotoken: 'valid_token' }
		});
		// Mock SYNO.Core.System shutdown
		requestSpy.mockResolvedValueOnce({
			success: true,
			data: {}
		});

		const result = await nas.shutdown();
		expect(result.success).toBe(true);
		expect(result.action).toBe('shutdown');
		expect(result.message).toContain('Shutdown signal received');
	});

	it('executes safe restart via DSM API', async () => {
		// Mock authenticate
		requestSpy.mockResolvedValueOnce({
			success: true,
			data: { sid: 'valid_sid', synotoken: 'valid_token' }
		});
		// Mock SYNO.Core.System reboot
		requestSpy.mockResolvedValueOnce({
			success: true,
			data: {}
		});

		const result = await nas.restart();
		expect(result.success).toBe(true);
		expect(result.action).toBe('restart');
		expect(result.message).toContain('Restart signal received');
	});
});
