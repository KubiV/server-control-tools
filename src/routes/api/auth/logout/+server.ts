import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SESSION_COOKIE_NAME, isSecureConnection } from '$lib/server/auth/AuthService';

export const POST: RequestHandler = async ({ request, url, cookies }) => {
	const isHttps = isSecureConnection(request, url);
	cookies.delete(SESSION_COOKIE_NAME, { path: '/', secure: isHttps });
	return json({ success: true, message: 'Logged out successfully' });
};


