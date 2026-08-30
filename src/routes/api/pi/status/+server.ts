import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { piService } from '$lib/server/pi/PiService';

export const GET: RequestHandler = async () => {
	const status = piService.getStatus();
	return json(status);
};

