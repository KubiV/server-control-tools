import dgram from 'node:dgram';
import { config, maskMacAddress } from '../config';
import { logger } from '../logger';
import type { WolResponse } from '$lib/types';

export class WakeOnLanService {
	/**
	 * Parse and normalize a MAC address into a 6-byte Buffer.
	 * Throws an Error if MAC address is invalid.
	 */
	public parseMac(mac: string): Buffer {
		if (!mac || typeof mac !== 'string') {
			throw new Error('MAC address must be a non-empty string');
		}

		const cleaned = mac.replace(/[^0-9a-fA-F]/g, '');
		if (cleaned.length !== 12) {
			throw new Error(`Invalid MAC address format: "${mac}". Must contain exactly 12 hexadecimal characters.`);
		}

		const buffer = Buffer.alloc(6);
		for (let i = 0; i < 6; i++) {
			buffer[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
		}

		return buffer;
	}

	/**
	 * Create standard 102-byte Wake-on-LAN magic packet.
	 * 6 bytes of 0xFF followed by 16 repetitions of the 6-byte MAC address.
	 */
	public createMagicPacket(mac: string): Buffer {
		const macBuffer = this.parseMac(mac);
		const packet = Buffer.alloc(102);

		// First 6 bytes are 0xFF
		packet.fill(0xff, 0, 6);

		// Followed by 16 repetitions of the MAC address
		for (let i = 0; i < 16; i++) {
			macBuffer.copy(packet, 6 + i * 6, 0, 6);
		}

		return packet;
	}

	/**
	 * Send Wake-on-LAN magic packet over UDP broadcast.
	 */
	public async sendWolPacket(options?: {
		mac?: string;
		broadcastAddress?: string;
		port?: number;
	}): Promise<WolResponse> {
		const targetMac = options?.mac || config.nas.wolMac;
		const broadcastAddress = options?.broadcastAddress || config.nas.wolBroadcastAddress;
		const port = options?.port || config.nas.wolPort;
		const timestamp = new Date().toISOString();

		if (!targetMac || targetMac === '00:00:00:00:00:00') {
			const errorMsg = 'Wake-on-LAN MAC address is not configured. Set NAS_WOL_MAC in environment variables.';
			logger.warn(errorMsg);
			return {
				success: false,
				targetMacMasked: maskMacAddress(targetMac || ''),
				broadcastAddress,
				port,
				timestamp,
				error: errorMsg
			};
		}

		try {
			const magicPacket = this.createMagicPacket(targetMac);

			await new Promise<void>((resolve, reject) => {
				const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

				socket.on('error', (err) => {
					socket.close();
					reject(err);
				});

				socket.bind(() => {
					socket.setBroadcast(true);
					socket.send(magicPacket, 0, magicPacket.length, port, broadcastAddress, (err) => {
						socket.close();
						if (err) {
							reject(err);
						} else {
							resolve();
						}
					});
				});
			});

			logger.info(`Wake-on-LAN magic packet sent to ${maskMacAddress(targetMac)} via ${broadcastAddress}:${port}`);

			return {
				success: true,
				targetMacMasked: maskMacAddress(targetMac),
				broadcastAddress,
				port,
				timestamp
			};
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			logger.error(`Failed to send Wake-on-LAN packet: ${errorMsg}`, err, {
				targetMacMasked: maskMacAddress(targetMac),
				broadcastAddress,
				port
			});

			return {
				success: false,
				targetMacMasked: maskMacAddress(targetMac),
				broadcastAddress,
				port,
				timestamp,
				error: errorMsg
			};
		}
	}
}

export const wakeOnLanService = new WakeOnLanService();

