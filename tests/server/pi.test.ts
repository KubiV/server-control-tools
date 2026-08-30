import { describe, it, expect } from 'vitest';
import { PiService } from '$lib/server/pi/PiService';

describe('PiService', () => {
	const pi = new PiService();

	it('retrieves host status with CPU, memory, and OS metrics', () => {
		const status = pi.getStatus();

		expect(status.hostname).toBeDefined();
		expect(status.platform).toBeDefined();
		expect(status.arch).toBeDefined();
		expect(status.cpu.cores).toBeGreaterThan(0);
		expect(status.cpu.usagePercent).toBeGreaterThanOrEqual(0);
		expect(status.cpu.usagePercent).toBeLessThanOrEqual(100);
		expect(status.memory.totalBytes).toBeGreaterThan(0);
		expect(status.memory.usagePercent).toBeGreaterThanOrEqual(0);
		expect(status.memory.usagePercent).toBeLessThanOrEqual(100);
		expect(status.temperature).toBeDefined();
		expect(['ok', 'warm', 'hot', 'unknown']).toContain(status.temperature.status);
	});
});

