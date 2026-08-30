import { redirect, json, type Handle } from '@sveltejs/kit';
import { authService, SESSION_COOKIE_NAME } from '$lib/server/auth/AuthService';

export const handle: Handle = async ({ event, resolve }) => {
	const sessionToken = event.cookies.get(SESSION_COOKIE_NAME);
	const isAuthenticated = authService.verifySessionToken(sessionToken);

	event.locals.authenticated = isAuthenticated;

	const { pathname } = event.url;

	// Public paths that do not require authentication
	const isPublicApi =
		pathname === '/api/health' ||
		pathname === '/api/auth/login' ||
		pathname === '/api/auth/session';
	const isLoginPage = pathname === '/login';

	// Protect API routes
	if (pathname.startsWith('/api/') && !isPublicApi) {
		if (!isAuthenticated) {
			return json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
		}
	}

	// Protect Web UI routes
	if (!pathname.startsWith('/api/')) {
		if (!isAuthenticated && !isLoginPage) {
			throw redirect(303, '/login');
		}

		if (isAuthenticated && isLoginPage) {
			throw redirect(303, '/');
		}
	}

	return resolve(event);
};

