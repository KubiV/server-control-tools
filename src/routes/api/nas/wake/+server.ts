import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { wakeOnLanService } from '$lib/server/wol/WakeOnLanService';

export const POST: RequestHandler = async ({ request }) => {
	let mac: string | undefined;
	let broadcastAddress: string | undefined;
	let port: number | undefined;

	try {
		const body = await request.json();
		if (body && typeof body === 'object') {
			if (typeof body.mac === 'string') mac = body.mac;
			if (typeof body.broadcastAddress === 'string') broadcastAddress = body.broadcastAddress;
			if (typeof body.port === 'number') port = body.port;
		}
	} catch {
		// Empty body is acceptable, uses configured defaults
	}

	const response = await wakeOnLanService.sendWolPacket({ mac, broadcastAddress, port });
	return json(response, { status: response.success ? 200 : 500 });
};

