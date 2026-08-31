import dgram from 'node:dgram';
import os from 'node:os';
import { config, maskMacAddress } from '../config';
import { logger } from '../logger';
import type { WolResponse } from '$lib/types';

/**
 * Calculates the IPv4 broadcast address given an IP address and a subnet mask.
 * E.g. ("192.168.1.50", "255.255.255.0") -> "192.168.1.255"
 */
export function calculateBroadcastAddress(ip: string, netmask: string): string | null {
	const ipParts = ip.split('.').map((p) => parseInt(p, 10));
	const maskParts = netmask.split('.').map((p) => parseInt(p, 10));

	if (ipParts.length !== 4 || maskParts.length !== 4) return null;
	if (ipParts.some(isNaN) || maskParts.some(isNaN)) return null;

	const broadcastParts = ipParts.map((part, i) => part | (~maskParts[i] & 255));
	return broadcastParts.join('.');
}

/**
 * Derives a standard /24 subnet broadcast address from an IPv4 address.
 * E.g. "192.168.1.204" -> "192.168.1.255"
 */
export function deriveSubnetBroadcast(ip: string): string | null {
	if (!ip) return null;
	const parts = ip.split('.');
	if (parts.length === 4 && parts.every((p) => !isNaN(Number(p)) && Number(p) >= 0 && Number(p) <= 255)) {
		return `${parts[0]}.${parts[1]}.${parts[2]}.255`;
	}
	return null;
}

/**
 * Retrieves all active non-internal IPv4 broadcast addresses across network interfaces.
 */
export function getLocalBroadcastAddresses(): string[] {
	const broadcasts: Set<string> = new Set();
	try {
		const interfaces = os.networkInterfaces();
		for (const ifaceName of Object.keys(interfaces)) {
			const addrs = interfaces[ifaceName];
			if (!addrs) continue;
			for (const addr of addrs) {
				if ((addr.family === 'IPv4' || (addr.family as unknown) === 4) && !addr.internal) {
					if (addr.netmask) {
						const bcast = calculateBroadcastAddress(addr.address, addr.netmask);
						if (bcast) broadcasts.add(bcast);
					}
				}
			}
		}
	} catch (err) {
		logger.warn(`Could not enumerate network interfaces for WOL broadcast: ${err}`);
	}
	return Array.from(broadcasts);
}

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
	 * Send Wake-on-LAN magic packet over UDP broadcast to all candidate broadcast targets.
	 */
	public async sendWolPacket(options?: {
		mac?: string;
		broadcastAddress?: string;
		port?: number;
	}): Promise<WolResponse> {
		const targetMac = options?.mac || config.nas.wolMac;
		const defaultBroadcastAddress = options?.broadcastAddress || config.nas.wolBroadcastAddress || '255.255.255.255';
		const port = options?.port || config.nas.wolPort || 9;
		const timestamp = new Date().toISOString();

		if (!targetMac || targetMac === '00:00:00:00:00:00') {
			const errorMsg = 'Wake-on-LAN MAC address is not configured. Set NAS_WOL_MAC in environment variables.';
			logger.warn(errorMsg);
			return {
				success: false,
				targetMacMasked: maskMacAddress(targetMac || ''),
				broadcastAddress: defaultBroadcastAddress,
				port,
				timestamp,
				error: errorMsg
			};
		}

		try {
			const magicPacket = this.createMagicPacket(targetMac);

			// Collect all candidate broadcast addresses
			const broadcastTargets = new Set<string>();
			if (defaultBroadcastAddress) broadcastTargets.add(defaultBroadcastAddress);
			broadcastTargets.add('255.255.255.255');

			// Add discovered local interface broadcast addresses
			for (const bcast of getLocalBroadcastAddresses()) {
				broadcastTargets.add(bcast);
			}

			// If local/fallback hosts are configured, calculate their subnet broadcasts
			for (const host of config.nas.candidateHosts) {
				const derived = deriveSubnetBroadcast(host);
				if (derived) broadcastTargets.add(derived);
			}

			const targetPorts = Array.from(new Set([port, 9, 7]));
			const sendPromises: Promise<void>[] = [];

			for (const bcastAddr of broadcastTargets) {
				for (const targetPort of targetPorts) {
					sendPromises.push(this.sendPacketBurst(magicPacket, bcastAddr, targetPort));
				}
			}

			await Promise.allSettled(sendPromises);

			const targetsSummary = Array.from(broadcastTargets).join(', ');
			logger.info(
				`Wake-on-LAN magic packet sent to ${maskMacAddress(targetMac)} via [${targetsSummary}] on ports [${targetPorts.join(', ')}]`
			);

			return {
				success: true,
				targetMacMasked: maskMacAddress(targetMac),
				broadcastAddress: defaultBroadcastAddress,
				port,
				timestamp
			};
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			logger.error(`Failed to send Wake-on-LAN packet: ${errorMsg}`, err, {
				targetMacMasked: maskMacAddress(targetMac),
				broadcastAddress: defaultBroadcastAddress,
				port
			});

			return {
				success: false,
				targetMacMasked: maskMacAddress(targetMac),
				broadcastAddress: defaultBroadcastAddress,
				port,
				timestamp,
				error: errorMsg
			};
		}
	}

	/**
	 * Sends a burst of UDP magic packets to a specific broadcast address and port.
	 */
	private async sendPacketBurst(
		packet: Buffer,
		broadcastAddress: string,
		port: number,
		burstCount = 3
	): Promise<void> {
		return new Promise<void>((resolve) => {
			const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

			socket.on('error', (err) => {
				logger.debug(`Socket error sending WOL to ${broadcastAddress}:${port} - ${err.message}`);
				try {
					socket.close();
				} catch {
					// Ignore close error
				}
				resolve();
			});

			socket.bind(() => {
				try {
					socket.setBroadcast(true);
					let sent = 0;
					const sendOne = () => {
						socket.send(packet, 0, packet.length, port, broadcastAddress, (err) => {
							sent++;
							if (sent >= burstCount || err) {
								try {
									socket.close();
								} catch {
									// Ignore close error
								}
								resolve();
							} else {
								setTimeout(sendOne, 20);
							}
						});
					};
					sendOne();
				} catch (err) {
					logger.debug(`Error during WOL broadcast to ${broadcastAddress}:${port} - ${err}`);
					try {
						socket.close();
					} catch {
						// Ignore close error
					}
					resolve();
				}
			});
		});
	}
}

export const wakeOnLanService = new WakeOnLanService();

