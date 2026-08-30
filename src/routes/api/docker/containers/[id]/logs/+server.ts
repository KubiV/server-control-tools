import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dockerService } from '$lib/server/docker/DockerService';

export const GET: RequestHandler = async ({ params, url }) => {
	const containerId = params.id;
	if (!containerId) {
		return json({ error: 'Container ID is required' }, { status: 400 });
	}

	const tailParam = url.searchParams.get('tail');
	const tail = tailParam ? parseInt(tailParam, 10) : 100;

	const response = await dockerService.getContainerLogs(containerId, isNaN(tail) ? 100 : tail);
	return json(response, { status: response.success ? 200 : 500 });
};

