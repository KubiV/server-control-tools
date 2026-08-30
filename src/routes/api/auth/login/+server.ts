import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authService, SESSION_COOKIE_NAME, isSecureConnection } from '$lib/server/auth/AuthService';
import { logger } from '$lib/server/logger';

export const POST: RequestHandler = async ({ request, url, cookies, getClientAddress }) => {
	const clientIp = getClientAddress ? getClientAddress() : '127.0.0.1';

	if (authService.isRateLimited(clientIp)) {
		logger.warn(`Login rejected: client ${clientIp} is rate limited.`);
		return json(
			{ error: 'Too many failed login attempts. Please wait 5 minutes before trying again.' },
			{ status: 429 }
		);
	}

	try {
		const body = await request.json();
		const password = typeof body.password === 'string' ? body.password : '';

		if (!authService.verifyPassword(password)) {
			authService.recordFailedAttempt(clientIp);
			logger.warn(`Failed login attempt from ${clientIp}`);
			return json({ error: 'Invalid password' }, { status: 401 });
		}

		authService.resetAttempts(clientIp);
		const token = authService.createSessionToken();

		const isHttps = isSecureConnection(request, url);

		cookies.set(SESSION_COOKIE_NAME, token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: isHttps,
			maxAge: 7 * 24 * 60 * 60 // 7 days
		});

		logger.info(`Successful login from ${clientIp} (secure cookie: ${isHttps})`);
		return json({ success: true, message: 'Authenticated successfully' });
	} catch (err) {
		return json({ error: 'Invalid request payload' }, { status: 400 });
	}
};

