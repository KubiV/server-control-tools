import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dockerService } from '$lib/server/docker/DockerService';

export const POST: RequestHandler = async ({ params }) => {
	const containerId = params.id;
	if (!containerId) {
		return json({ error: 'Container ID is required' }, { status: 400 });
	}

	const response = await dockerService.startContainer(containerId);
	return json(response, { status: response.success ? 200 : 500 });
};

