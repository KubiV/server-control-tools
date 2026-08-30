import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { config } from '$lib/server/config';
import type { AuthSessionResponse } from '$lib/types';

export const GET: RequestHandler = async ({ locals }) => {
	const response: AuthSessionResponse = {
		authenticated: locals.authenticated,
		configured: Boolean(config.auth.password)
	};

	return json(response);
};

