import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dockerService } from '$lib/server/docker/DockerService';

export const GET: RequestHandler = async () => {
	const status = await dockerService.getStatus();
	return json(status);
};

