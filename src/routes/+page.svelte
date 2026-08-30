<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import NasCard from '$lib/components/NasCard.svelte';
	import PiStatusCard from '$lib/components/PiStatusCard.svelte';
	import DockerCard from '$lib/components/DockerCard.svelte';
	import { toasts } from '$lib/stores/toasts';
	import type { NasStatusResponse, PiStatusResponse, DockerStatusResponse } from '$lib/types';

	let refreshing: boolean = false;
	let autoRefreshInterval: number = 10; // seconds
	let refreshTimer: ReturnType<typeof setInterval> | null = null;

	let nasStatus: NasStatusResponse = {
		state: 'UNKNOWN',
		host: '127.0.0.1',
		port: 5001,
		lastChecked: new Date().toISOString()
	};

	let piStatus: PiStatusResponse = {
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

	let dockerStatus: DockerStatusResponse = {
		available: false,
		total: 0,
		running: 0,
		stopped: 0,
		containers: [],
		timestamp: new Date().toISOString()
	};

	async function fetchNasStatus() {
		try {
			const res = await fetch('/api/nas/status');
			if (res.ok) {
				nasStatus = await res.json();
			}
		} catch (err) {
			console.error('Failed to fetch NAS status:', err);
		}
	}

	async function fetchPiStatus() {
		try {
			const res = await fetch('/api/pi/status');
			if (res.ok) {
				piStatus = await res.json();
			}
		} catch (err) {
			console.error('Failed to fetch Pi status:', err);
		}
	}

	async function fetchDockerStatus() {
		try {
			const res = await fetch('/api/docker/containers');
			if (res.ok) {
				dockerStatus = await res.json();
			}
		} catch (err) {
			console.error('Failed to fetch Docker status:', err);
		}
	}

	async function refreshAll() {
		refreshing = true;
		await Promise.allSettled([fetchNasStatus(), fetchPiStatus(), fetchDockerStatus()]);
		refreshing = false;
	}

	function setupAutoRefresh() {
		if (refreshTimer) {
			clearInterval(refreshTimer);
			refreshTimer = null;
		}

		if (autoRefreshInterval > 0) {
			refreshTimer = setInterval(() => {
				refreshAll();
			}, autoRefreshInterval * 1000);
		}
	}

	function handleIntervalChange(event: CustomEvent<number>) {
		autoRefreshInterval = event.detail;
		setupAutoRefresh();
		if (autoRefreshInterval > 0) {
			toasts.info('Auto-refresh updated', `Dashboard refreshes every ${autoRefreshInterval} seconds.`);
		} else {
			toasts.info('Auto-refresh paused');
		}
	}

	async function handleLogout() {
		try {
			await fetch('/api/auth/logout', { method: 'POST' });
			window.location.href = '/login';
		} catch {
			window.location.href = '/login';
		}
	}

	onMount(() => {
		refreshAll();
		setupAutoRefresh();
	});

	onDestroy(() => {
		if (refreshTimer) clearInterval(refreshTimer);
	});
</script>

<div class="min-h-screen flex flex-col">
	<Navbar
		{refreshing}
		{autoRefreshInterval}
		on:refresh={refreshAll}
		on:intervalChange={handleIntervalChange}
		on:logout={handleLogout}
	/>

	<main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
		<!-- Top Cards: NAS + Raspberry Pi side-by-side on desktop, stacked on mobile -->
		<section class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<NasCard bind:status={nasStatus} onRefresh={fetchNasStatus} />
			<PiStatusCard bind:status={piStatus} />
		</section>

		<!-- Bottom Card: Docker Containers -->
		<section>
			<DockerCard bind:dockerStatus onRefresh={fetchDockerStatus} />
		</section>
	</main>

	<footer class="border-t border-surface-850 py-6 text-center text-xs text-surface-500">
		<p>NAS & Server Control Panel • Raspberry Pi & Synology Integration</p>
	</footer>
</div>

