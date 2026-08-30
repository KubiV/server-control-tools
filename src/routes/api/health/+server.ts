import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { nasService } from '$lib/server/nas/NasService';
import { dockerService } from '$lib/server/docker/DockerService';
import { config } from '$lib/server/config';
import os from 'node:os';
import type { HealthResponse } from '$lib/types';

export const GET: RequestHandler = async () => {
	const nasConfigured = Boolean(config.nas.host && config.nas.username);
	
	// Quick check on services without blocking
	const dockerAvailable = await dockerService.isAvailable();

	const response: HealthResponse = {
		status: 'healthy',
		version: '1.0.0',
		uptime: Math.floor(process.uptime()),
		timestamp: new Date().toISOString(),
		services: {
			nas: {
				configured: nasConfigured,
				state: nasConfigured ? 'ONLINE' : 'UNKNOWN'
			},
			docker: {
				available: dockerAvailable,
				containerCount: 0
			},
			system: {
				platform: os.platform(),
				loadAvg: os.loadavg()
			}
		}
	};

	return json(response);
};

