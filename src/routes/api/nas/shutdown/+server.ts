import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { nasService } from '$lib/server/nas/NasService';

export const POST: RequestHandler = async () => {
	const response = await nasService.shutdown();
	return json(response, { status: response.success ? 200 : 500 });
};

