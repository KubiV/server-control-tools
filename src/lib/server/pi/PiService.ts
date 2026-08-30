import os from 'node:os';
import fs from 'node:fs';
import { logger } from '../logger';
import type { PiStatusResponse } from '$lib/types';

export class PiService {
	private previousCpuTimes: { idle: number; total: number } | null = null;

	/**
	 * Calculate CPU utilization percentage over a sampling interval
	 */
	private getCpuUsage(): number {
		const cpus = os.cpus();
		let idle = 0;
		let total = 0;

		for (const cpu of cpus) {
			for (const type in cpu.times) {
				total += (cpu.times as Record<string, number>)[type];
			}
			idle += cpu.times.idle;
		}

		if (!this.previousCpuTimes) {
			this.previousCpuTimes = { idle, total };
			// Initial estimate from load average normalized to core count
			const load1 = os.loadavg()[0];
			const cores = cpus.length || 1;
			return Math.min(100, Math.round((load1 / cores) * 100));
		}

		const idleDiff = idle - this.previousCpuTimes.idle;
		const totalDiff = total - this.previousCpuTimes.total;
		this.previousCpuTimes = { idle, total };

		if (totalDiff <= 0) return 0;

		const usage = 100 - (100 * idleDiff) / totalDiff;
		return Math.max(0, Math.min(100, Math.round(usage * 10) / 10));
	}

	/**
	 * Read CPU temperature from Raspberry Pi hardware sensor
	 */
	private getCpuTemperature(): { celsius: number | null; status: 'ok' | 'warm' | 'hot' | 'unknown' } {
		const thermalPaths = [
			'/sys/class/thermal/thermal_zone0/temp',
			'/sys/devices/virtual/thermal/thermal_zone0/temp'
		];

		for (const thermalPath of thermalPaths) {
			try {
				if (fs.existsSync(thermalPath)) {
					const raw = fs.readFileSync(thermalPath, 'utf8').trim();
					const tempMilli = parseInt(raw, 10);
					if (!isNaN(tempMilli)) {
						const celsius = Math.round((tempMilli / 1000) * 10) / 10;
						let status: 'ok' | 'warm' | 'hot' = 'ok';
						if (celsius >= 75) status = 'hot';
						else if (celsius >= 60) status = 'warm';

						return { celsius, status };
					}
				}
			} catch {
				// Ignore read errors and fall through
			}
		}

		return { celsius: null, status: 'unknown' };
	}

	/**
	 * Get root filesystem disk usage using native Node.js statfsSync
	 */
	private getDiskUsage(): { totalBytes: number; usedBytes: number; freeBytes: number; usagePercent: number } {
		try {
			if (typeof fs.statfsSync === 'function') {
				const stats = fs.statfsSync('/');
				const totalBytes = stats.bsize * stats.blocks;
				const freeBytes = stats.bsize * stats.bavail;
				const usedBytes = totalBytes - freeBytes;
				const usagePercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0;

				return { totalBytes, usedBytes, freeBytes, usagePercent };
			}
		} catch (err) {
			logger.debug('Native statfsSync not available or failed', { err: String(err) });
		}

		// Fallback dummy values if statfsSync fails
		return { totalBytes: 0, usedBytes: 0, freeBytes: 0, usagePercent: 0 };
	}

	/**
	 * Gather full Raspberry Pi / Host server metrics
	 */
	public getStatus(): PiStatusResponse {
		const totalMem = os.totalmem();
		const freeMem = os.freemem();
		const usedMem = totalMem - freeMem;
		const memUsagePercent = totalMem > 0 ? Math.round((usedMem / totalMem) * 1000) / 10 : 0;

		const cpus = os.cpus();
		const cpuUsagePercent = this.getCpuUsage();
		const temperature = this.getCpuTemperature();
		const disk = this.getDiskUsage();

		return {
			hostname: os.hostname(),
			platform: os.platform(),
			release: os.release(),
			arch: os.arch(),
			uptime: os.uptime(),
			cpu: {
				cores: cpus.length,
				usagePercent: cpuUsagePercent,
				loadAvg: os.loadavg().map((n) => Math.round(n * 100) / 100)
			},
			memory: {
				totalBytes: totalMem,
				usedBytes: usedMem,
				freeBytes: freeMem,
				usagePercent: memUsagePercent
			},
			disk,
			temperature,
			timestamp: new Date().toISOString()
		};
	}
}

export const piService = new PiService();

