const SENSITIVE_KEYS = [
	'password',
	'passwd',
	'secret',
	'token',
	'synotoken',
	'sid',
	'_sid',
	'authorization',
	'cookie'
];

function sanitize(value: unknown): unknown {
	if (typeof value === 'string') {
		// Check if string contains key=value patterns for sensitive fields
		let sanitized = value;
		for (const key of SENSITIVE_KEYS) {
			const regex = new RegExp(`(${key}=)[^&\\s]+`, 'gi');
			sanitized = sanitized.replace(regex, '$1[REDACTED]');
		}
		return sanitized;
	}

	if (Array.isArray(value)) {
		return value.map(sanitize);
	}

	if (value !== null && typeof value === 'object') {
		const result: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value)) {
			if (SENSITIVE_KEYS.some((sensitive) => k.toLowerCase().includes(sensitive))) {
				result[k] = '[REDACTED]';
			} else {
				result[k] = sanitize(v);
			}
		}
		return result;
	}

	return value;
}

export const logger = {
	info(message: string, context?: Record<string, unknown>) {
		const timestamp = new Date().toISOString();
		if (context) {
			console.log(`[${timestamp}] [INFO] ${message}`, JSON.stringify(sanitize(context)));
		} else {
			console.log(`[${timestamp}] [INFO] ${message}`);
		}
	},
	warn(message: string, context?: Record<string, unknown>) {
		const timestamp = new Date().toISOString();
		if (context) {
			console.warn(`[${timestamp}] [WARN] ${message}`, JSON.stringify(sanitize(context)));
		} else {
			console.warn(`[${timestamp}] [WARN] ${message}`);
		}
	},
	error(message: string, error?: unknown, context?: Record<string, unknown>) {
		const timestamp = new Date().toISOString();
		const errStr = error instanceof Error ? error.message : String(error ?? '');
		const fullContext = {
			...(context ? (sanitize(context) as Record<string, unknown>) : {}),
			...(errStr ? { error: errStr } : {})
		};
		console.error(`[${timestamp}] [ERROR] ${message}`, JSON.stringify(fullContext));
	},
	debug(message: string, context?: Record<string, unknown>) {
		if (process.env.NODE_ENV !== 'production') {
			const timestamp = new Date().toISOString();
			if (context) {
				console.debug(`[${timestamp}] [DEBUG] ${message}`, JSON.stringify(sanitize(context)));
			} else {
				console.debug(`[${timestamp}] [DEBUG] ${message}`);
			}
		}
	}
};

