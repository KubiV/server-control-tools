import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { nasService } from '$lib/server/nas/NasService';

export const GET: RequestHandler = async () => {
	const status = await nasService.getStatus();
	return json(status);
};

