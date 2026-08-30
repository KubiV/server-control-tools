import { describe, it, expect, vi } from 'vitest';
import { DockerService } from '$lib/server/docker/DockerService';

describe('DockerService', () => {
	it('handles missing Docker daemon gracefully without crashing', async () => {
		const docker = new DockerService();
		const status = await docker.getStatus();

		expect(status).toBeDefined();
		expect(typeof status.available).toBe('boolean');
		expect(Array.isArray(status.containers)).toBe(true);
	});

	it('handles container operations when docker is unavailable', async () => {
		const docker = new DockerService();
		// Mock getClient returning null
		vi.spyOn(docker as unknown as { getClient: () => unknown }, 'getClient').mockReturnValue(null);

		const startRes = await docker.startContainer('non_existent_id');
		expect(startRes.success).toBe(false);
		expect(startRes.message).toContain('not accessible');

		const stopRes = await docker.stopContainer('non_existent_id');
		expect(stopRes.success).toBe(false);

		const restartRes = await docker.restartContainer('non_existent_id');
		expect(restartRes.success).toBe(false);

		const logsRes = await docker.getContainerLogs('non_existent_id');
		expect(logsRes.success).toBe(false);
	});
});

