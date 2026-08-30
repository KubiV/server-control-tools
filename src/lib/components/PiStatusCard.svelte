<script lang="ts">
	import { Cpu, Server, HardDrive, Thermometer, Clock, MemoryStick } from 'lucide-svelte';
	import type { PiStatusResponse } from '$lib/types';

	export let status: PiStatusResponse = {
		hostname: 'raspberrypi',
		platform: 'linux',
		release: '',
		arch: 'arm64',
		uptime: 0,
		cpu: { cores: 4, usagePercent: 0, loadAvg: [0, 0, 0] },
		memory: { totalBytes: 0, usedBytes: 0, freeBytes: 0, usagePercent: 0 },
		disk: { totalBytes: 0, usedBytes: 0, freeBytes: 0, usagePercent: 0 },
		temperature: { celsius: null, status: 'unknown' },
		timestamp: new Date().toISOString()
	};

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
	}

	function formatUptime(seconds: number): string {
		const days = Math.floor(seconds / 86400);
		const hours = Math.floor((seconds % 86400) / 3600);
		const mins = Math.floor((seconds % 3600) / 60);
		if (days > 0) return `${days}d ${hours}h ${mins}m`;
		if (hours > 0) return `${hours}h ${mins}m`;
		return `${mins}m`;
	}

	function getBarColor(percent: number): string {
		if (percent >= 85) return 'bg-rose-500';
		if (percent >= 70) return 'bg-amber-500';
		return 'bg-brand-500';
	}

	function getTempColor(status: 'ok' | 'warm' | 'hot' | 'unknown'): string {
		switch (status) {
			case 'ok':
				return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
			case 'warm':
				return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
			case 'hot':
				return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
			default:
				return 'bg-surface-800 text-surface-400 border-surface-700';
		}
	}
</script>

<div class="bg-surface-900/70 border border-surface-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm flex flex-col justify-between">
	<!-- Top Details -->
	<div>
		<div class="flex items-start justify-between gap-4">
			<div class="flex items-center gap-3">
				<div class="p-3 bg-gradient-to-tr from-indigo-600/20 to-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-2xl">
					<Server class="w-6 h-6" />
				</div>
				<div>
					<h2 class="text-lg font-bold text-surface-50 flex items-center gap-2">
						{status.hostname || 'Raspberry Pi 5'}
					</h2>
					<p class="text-xs text-surface-400 font-mono">
						{status.platform} • {status.arch}
					</p>
				</div>
			</div>

			<!-- Temperature Badge -->
			<div class="flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold {getTempColor(status.temperature.status)}">
				<Thermometer class="w-3.5 h-3.5" />
				<span>
					{status.temperature.celsius !== null ? `${status.temperature.celsius} °C` : 'N/A'}
				</span>
			</div>
		</div>

		<!-- Resource Utilization Bars -->
		<div class="mt-6 space-y-4">
			<!-- CPU Usage -->
			<div>
				<div class="flex items-center justify-between text-xs mb-1.5">
					<span class="text-surface-300 font-medium flex items-center gap-1.5">
						<Cpu class="w-3.5 h-3.5 text-brand-400" /> CPU Load ({status.cpu.cores} Cores)
					</span>
					<span class="font-mono text-surface-200 font-semibold">{status.cpu.usagePercent}%</span>
				</div>
				<div class="w-full h-2 bg-surface-950 rounded-full overflow-hidden border border-surface-800">
					<div
						class="h-full rounded-full transition-all duration-500 {getBarColor(status.cpu.usagePercent)}"
						style="width: {Math.min(100, Math.max(0, status.cpu.usagePercent))}%"
					></div>
				</div>
				<div class="flex items-center justify-between text-[10px] text-surface-500 font-mono mt-1">
					<span>Load Avg: {status.cpu.loadAvg.join(', ')}</span>
				</div>
			</div>

			<!-- Memory Usage -->
			<div>
				<div class="flex items-center justify-between text-xs mb-1.5">
					<span class="text-surface-300 font-medium flex items-center gap-1.5">
						<MemoryStick class="w-3.5 h-3.5 text-indigo-400" /> RAM Usage
					</span>
					<span class="font-mono text-surface-200 font-semibold">
						{formatBytes(status.memory.usedBytes)} / {formatBytes(status.memory.totalBytes)} ({status.memory.usagePercent}%)
					</span>
				</div>
				<div class="w-full h-2 bg-surface-950 rounded-full overflow-hidden border border-surface-800">
					<div
						class="h-full rounded-full transition-all duration-500 {getBarColor(status.memory.usagePercent)}"
						style="width: {Math.min(100, Math.max(0, status.memory.usagePercent))}%"
					></div>
				</div>
			</div>

			<!-- Disk Usage -->
			<div>
				<div class="flex items-center justify-between text-xs mb-1.5">
					<span class="text-surface-300 font-medium flex items-center gap-1.5">
						<HardDrive class="w-3.5 h-3.5 text-emerald-400" /> Root Disk Usage
					</span>
					<span class="font-mono text-surface-200 font-semibold">
						{formatBytes(status.disk.usedBytes)} / {formatBytes(status.disk.totalBytes)} ({status.disk.usagePercent}%)
					</span>
				</div>
				<div class="w-full h-2 bg-surface-950 rounded-full overflow-hidden border border-surface-800">
					<div
						class="h-full rounded-full transition-all duration-500 {getBarColor(status.disk.usagePercent)}"
						style="width: {Math.min(100, Math.max(0, status.disk.usagePercent))}%"
					></div>
				</div>
			</div>
		</div>
	</div>

	<!-- Bottom Uptime Bar -->
	<div class="mt-6 pt-4 border-t border-surface-800/80 flex items-center justify-between text-xs text-surface-400">
		<span class="flex items-center gap-1.5">
			<Clock class="w-3.5 h-3.5 text-surface-500" /> Uptime:
			<span class="font-mono text-surface-200">{formatUptime(status.uptime)}</span>
		</span>
		<span class="text-[11px] font-mono text-surface-500 truncate max-w-[150px]">
			{status.release || 'Kernel OK'}
		</span>
	</div>
</div>

