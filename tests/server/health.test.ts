import { describe, it, expect } from 'vitest';
import { GET } from '../../src/routes/api/health/+server';

describe('Health API', () => {
	it('returns a healthy status object with subsystems data', async () => {
		const mockEvent = {} as Parameters<typeof GET>[0];
		const response = await GET(mockEvent);

		expect(response.status).toBe(200);

		const data = await response.json();
		expect(data.status).toBe('healthy');
		expect(data.version).toBe('1.0.0');
		expect(typeof data.uptime).toBe('number');
		expect(data.services).toBeDefined();
		expect(data.services.nas).toBeDefined();
		expect(data.services.docker).toBeDefined();
		expect(data.services.system).toBeDefined();
	});
});

