import { describe, it, expect } from 'vitest';
import { WakeOnLanService, calculateBroadcastAddress, deriveSubnetBroadcast } from '$lib/server/wol/WakeOnLanService';

describe('WakeOnLanService', () => {
	const wol = new WakeOnLanService();

	it('parses valid colon-separated MAC addresses', () => {
		const buffer = wol.parseMac('00:11:32:AA:BB:CC');
		expect(buffer.length).toBe(6);
		expect(buffer[0]).toBe(0x00);
		expect(buffer[1]).toBe(0x11);
		expect(buffer[2]).toBe(0x32);
		expect(buffer[3]).toBe(0xaa);
		expect(buffer[4]).toBe(0xbb);
		expect(buffer[5]).toBe(0xcc);
	});

	it('parses valid hyphen-separated and unseparated MAC addresses', () => {
		const buf1 = wol.parseMac('00-11-32-aa-bb-cc');
		const buf2 = wol.parseMac('001132AABBCC');
		expect(buf1.equals(buf2)).toBe(true);
	});

	it('throws on invalid MAC addresses', () => {
		expect(() => wol.parseMac('invalid-mac')).toThrow();
		expect(() => wol.parseMac('00:11:22')).toThrow();
		expect(() => wol.parseMac('')).toThrow();
	});

	it('generates exact 102-byte Wake-on-LAN magic packet structure', () => {
		const mac = '00:11:32:22:33:44';
		const packet = wol.createMagicPacket(mac);

		expect(packet.length).toBe(102);

		// First 6 bytes must be 0xFF
		for (let i = 0; i < 6; i++) {
			expect(packet[i]).toBe(0xff);
		}

		// Followed by 16 repetitions of 6 bytes MAC
		const expectedMacBytes = [0x00, 0x11, 0x32, 0x22, 0x33, 0x44];
		for (let rep = 0; rep < 16; rep++) {
			for (let b = 0; b < 6; b++) {
				expect(packet[6 + rep * 6 + b]).toBe(expectedMacBytes[b]);
			}
		}
	});

	it('calculates IPv4 broadcast addresses accurately', () => {
		expect(calculateBroadcastAddress('192.168.1.50', '255.255.255.0')).toBe('192.168.1.255');
		expect(calculateBroadcastAddress('10.0.10.5', '255.255.0.0')).toBe('10.0.255.255');
		expect(calculateBroadcastAddress('invalid', '255.255.255.0')).toBeNull();
	});

	it('derives /24 subnet broadcast address from IP', () => {
		expect(deriveSubnetBroadcast('192.168.1.204')).toBe('192.168.1.255');
		expect(deriveSubnetBroadcast('10.0.0.15')).toBe('10.0.0.255');
		expect(deriveSubnetBroadcast('')).toBeNull();
	});

	it('gracefully handles missing MAC configuration in sendWolPacket', async () => {
		const result = await wol.sendWolPacket({ mac: '00:00:00:00:00:00' });
		expect(result.success).toBe(false);
		expect(result.error).toContain('not configured');
	});
});


