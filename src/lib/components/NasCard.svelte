<script lang="ts">
	import {
		HardDrive,
		Power,
		RotateCw,
		Zap,
		Activity,
		Clock,
		AlertTriangle,
		CheckCircle2,
		Loader2,
		Network,
		Wifi,
		ExternalLink,
		Globe
	} from 'lucide-svelte';
	import type { NasStatusResponse, NasStatusState } from '$lib/types';
	import { toasts } from '$lib/stores/toasts';
	import ConfirmModal from './ConfirmModal.svelte';

	export let status: NasStatusResponse = {
		state: 'UNKNOWN',
		host: '127.0.0.1',
		port: 5001,
		lastChecked: new Date().toISOString()
	};
	export let onRefresh: () => Promise<void>;

	let waking: boolean = false;
	let wolPolling: boolean = false;
	let wolPollSecondsLeft: number = 0;
	let wolPollInterval: ReturnType<typeof setInterval> | null = null;

	let showShutdownModal: boolean = false;
	let showRestartModal: boolean = false;
	let actionLoading: boolean = false;

	function formatUptime(seconds?: number): string {
		if (!seconds) return '—';
		const days = Math.floor(seconds / 86400);
		const hours = Math.floor((seconds % 86400) / 3600);
		const mins = Math.floor((seconds % 3600) / 60);
		if (days > 0) return `${days}d ${hours}h ${mins}m`;
		if (hours > 0) return `${hours}h ${mins}m`;
		return `${mins}m`;
	}

	function getStateBadge(state: NasStatusState) {
		switch (state) {
			case 'ONLINE':
				return {
					text: 'Online',
					bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
					dot: 'bg-emerald-400 animate-pulse'
				};
			case 'STARTING':
				return {
					text: 'Starting Up',
					bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
					dot: 'bg-amber-400 animate-ping'
				};
			case 'OFFLINE':
				return {
					text: 'Offline',
					bg: 'bg-surface-800 text-surface-400 border-surface-700',
					dot: 'bg-surface-500'
				};
			case 'AUTH_ERROR':
				return {
					text: 'Auth Error',
					bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
					dot: 'bg-amber-400'
				};
			case 'NETWORK_ERROR':
				return {
					text: 'Network Error',
					bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
					dot: 'bg-rose-400'
				};
			default:
				return {
					text: 'Unknown',
					bg: 'bg-surface-800 text-surface-400 border-surface-700',
					dot: 'bg-surface-500'
				};
		}
	}

	async function handleWakeOnLan() {
		waking = true;
		try {
			const res = await fetch('/api/nas/wake', { method: 'POST' });
			const data = await res.json();

			if (data.success) {
				toasts.success('WOL Packet Sent', `Magic packet broadcasted to ${data.targetMacMasked}.`);
				status.state = 'STARTING';
				startWolPolling();
			} else {
				toasts.error('Wake-on-LAN Failed', data.error || 'Could not send WOL magic packet.');
			}
		} catch (err) {
			toasts.error('WOL Error', String(err));
		} finally {
			waking = false;
		}
	}

	function startWolPolling() {
		if (wolPollInterval) clearInterval(wolPollInterval);
		wolPolling = true;
		wolPollSecondsLeft = 120; // Poll for up to 2 minutes

		wolPollInterval = setInterval(async () => {
			wolPollSecondsLeft -= 5;
			await onRefresh();

			if (status.state === 'ONLINE') {
				toasts.success('NAS is Online', 'Synology DSM WebAPI responded and is fully accessible.');
				stopWolPolling();
			} else if (wolPollSecondsLeft <= 0) {
				toasts.info('WOL Polling Completed', 'NAS has not responded yet. It may take another minute to boot.');
				stopWolPolling();
			}
		}, 5000);
	}

	function stopWolPolling() {
		if (wolPollInterval) {
			clearInterval(wolPollInterval);
			wolPollInterval = null;
		}
		wolPolling = false;
	}

	async function handleShutdown() {
		actionLoading = true;
		try {
			const res = await fetch('/api/nas/shutdown', { method: 'POST' });
			const data = await res.json();

			if (data.success) {
				toasts.warning('Shutdown Initiated', data.message || 'NAS shutdown command received.');
				showShutdownModal = false;
				status.state = 'OFFLINE';
				await onRefresh();
			} else {
				toasts.error('Shutdown Failed', data.error || 'DSM rejected shutdown request.');
			}
		} catch (err) {
			toasts.error('Shutdown Request Error', String(err));
		} finally {
			actionLoading = false;
		}
	}

	async function handleRestart() {
		actionLoading = true;
		try {
			const res = await fetch('/api/nas/restart', { method: 'POST' });
			const data = await res.json();

			if (data.success) {
				toasts.info('Reboot Initiated', data.message || 'NAS is rebooting.');
				showRestartModal = false;
				status.state = 'STARTING';
				startWolPolling();
			} else {
				toasts.error('Reboot Failed', data.error || 'DSM rejected reboot request.');
			}
		} catch (err) {
			toasts.error('Reboot Request Error', String(err));
		} finally {
			actionLoading = false;
		}
	}

	$: badge = getStateBadge(status.state);
	$: displayHost = status.activeHost || status.host;
</script>

<div class="bg-surface-900/70 border border-surface-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm flex flex-col justify-between">
	<!-- Top Section -->
	<div>
		<div class="flex items-start justify-between gap-4">
			<div class="flex items-center gap-3">
				<div class="p-3 bg-gradient-to-tr from-brand-600/20 to-brand-500/10 text-brand-400 border border-brand-500/20 rounded-2xl">
					<HardDrive class="w-6 h-6" />
				</div>
				<div>
					<div class="flex items-center gap-2">
						<h2 class="text-lg font-bold text-surface-50">
							Synology NAS
						</h2>
						{#if status.webUrl}
							<a
								href={status.webUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-brand-400 hover:text-brand-300 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 rounded-lg transition-all group"
								title="Open Synology DSM Management ({status.webUrl})"
							>
								<span>Open DSM</span>
								<ExternalLink class="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
							</a>
						{/if}
					</div>
					<p class="text-xs text-surface-400 font-mono flex items-center gap-1.5 mt-0.5">
						<Network class="w-3.5 h-3.5 text-surface-500" />
						<span>{displayHost}:{status.port}</span>
						{#if status.candidateHosts && status.candidateHosts.length > 1}
							<span class="text-[10px] text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded border border-brand-500/20">
								Dual Route
							</span>
						{/if}
					</p>
				</div>
			</div>

			<!-- Status Badge -->
			<div class="flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold {badge.bg}">
				<span class="w-2 h-2 rounded-full {badge.dot}"></span>
				<span>{badge.text}</span>
			</div>
		</div>

		<!-- Warning / Error banner if state is AUTH_ERROR or NETWORK_ERROR -->
		{#if status.errorMessage && status.state !== 'ONLINE'}
			<div class="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-start gap-2.5">
				<AlertTriangle class="w-4 h-4 shrink-0 mt-0.5" />
				<div class="flex-1 min-w-0">
					<p class="font-medium">{status.errorMessage}</p>
				</div>
			</div>
		{/if}

		<!-- WOL Polling Progress Banner -->
		{#if wolPolling}
			<div class="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-center justify-between">
				<div class="flex items-center gap-2">
					<Loader2 class="w-4 h-4 animate-spin" />
					<span>Waiting for NAS to boot ({wolPollSecondsLeft}s remaining)...</span>
				</div>
				<button
					type="button"
					on:click={stopWolPolling}
					class="text-xs font-semibold underline hover:text-amber-200"
				>
					Stop
				</button>
			</div>
		{/if}

		<!-- System Metrics Grid -->
		<div class="mt-5 grid grid-cols-2 gap-3 text-xs">
			<div class="bg-surface-950/60 border border-surface-800/80 rounded-xl p-3">
				<span class="text-surface-400 flex items-center gap-1.5 mb-1">
					<Activity class="w-3.5 h-3.5 text-brand-400" /> Model / OS
				</span>
				<span class="font-medium text-surface-200 truncate block">
					{status.model || 'Synology DSM'}
				</span>
				<span class="text-[11px] text-surface-500 font-mono">
					{status.version || 'WebAPI v6'}
				</span>
			</div>

			<div class="bg-surface-950/60 border border-surface-800/80 rounded-xl p-3">
				<span class="text-surface-400 flex items-center gap-1.5 mb-1">
					<Clock class="w-3.5 h-3.5 text-emerald-400" /> Uptime
				</span>
				<span class="font-medium text-surface-200 truncate block">
					{status.state === 'ONLINE' ? formatUptime(status.uptime) : 'Offline'}
				</span>
				<span class="text-[11px] text-surface-500 font-mono">
					{status.state === 'ONLINE' ? 'Running smoothly' : 'Powered down'}
				</span>
			</div>
		</div>

		<!-- Candidate Hosts and QuickConnect Link if configured -->
		{#if status.quickConnectUrl || (status.candidateHosts && status.candidateHosts.length > 1)}
			<div class="mt-3 px-3 py-2 bg-surface-950/40 border border-surface-850 rounded-xl flex flex-wrap items-center justify-between gap-2 text-[11px] text-surface-400 font-mono">
				{#if status.quickConnectUrl}
					<div class="flex items-center gap-1.5">
						<Globe class="w-3.5 h-3.5 text-brand-400" />
						<span class="text-surface-500">QuickConnect:</span>
						<a
							href={status.quickConnectUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="text-brand-400 hover:text-brand-300 underline inline-flex items-center gap-1"
						>
							<span>{status.quickConnectUrl.replace(/^https?:\/\//, '')}</span>
							<ExternalLink class="w-2.5 h-2.5" />
						</a>
					</div>
				{/if}

				{#if status.candidateHosts && status.candidateHosts.length > 1}
					<div class="flex items-center gap-1.5 ml-auto">
						<span class="text-surface-500">Routes:</span>
						{#each status.candidateHosts as candidate}
							<span class="px-1.5 py-0.5 rounded {candidate === status.activeHost ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-surface-900 text-surface-400'}">
								{candidate} {candidate === status.activeHost ? '✓' : ''}
							</span>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Power Controls & Action Buttons -->
	<div class="mt-6 pt-5 border-t border-surface-800/80 flex flex-wrap items-center justify-between gap-3">
		<!-- Wake Button -->
		<button
			type="button"
			disabled={waking || wolPolling || status.state === 'ONLINE'}
			on:click={handleWakeOnLan}
			class="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed {status.state === 'ONLINE'
				? 'bg-surface-800 text-surface-500'
				: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/30'}"
		>
			{#if waking}
				<Loader2 class="w-4 h-4 animate-spin" />
				<span>Sending...</span>
			{:else}
				<Zap class="w-4 h-4" />
				<span>Wake on LAN</span>
			{/if}
		</button>

		<!-- Open DSM Management Button -->
		{#if status.webUrl}
			<a
				href={status.webUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold bg-brand-600/20 hover:bg-brand-600/30 text-brand-300 hover:text-brand-100 hover:border-brand-500/40 border border-brand-500/30 rounded-xl transition-all shadow-sm active:scale-95"
				title="Open Synology DSM in new tab"
			>
				<ExternalLink class="w-4 h-4" />
				<span>Open DSM</span>
			</a>
		{/if}

		<!-- Reboot Button -->
		<button
			type="button"
			disabled={status.state !== 'ONLINE'}
			on:click={() => (showRestartModal = true)}
			class="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold bg-surface-800 hover:bg-amber-600/20 text-surface-200 hover:text-amber-300 hover:border-amber-500/30 border border-surface-700 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
		>
			<RotateCw class="w-4 h-4" />
			<span>Reboot</span>
		</button>

		<!-- Shutdown Button -->
		<button
			type="button"
			disabled={status.state !== 'ONLINE'}
			on:click={() => (showShutdownModal = true)}
			class="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold bg-surface-800 hover:bg-rose-600/20 text-surface-200 hover:text-rose-300 hover:border-rose-500/30 border border-surface-700 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
		>
			<Power class="w-4 h-4" />
			<span>Shutdown</span>
		</button>
	</div>
</div>

<!-- Shutdown Confirmation Dialog -->
<ConfirmModal
	bind:open={showShutdownModal}
	title="Shut Down Synology NAS?"
	message="This will gracefully power down your Synology NAS using the DSM WebAPI. File shares, Docker containers, and services running on the NAS will become inaccessible until powered back on via Wake-on-LAN."
	confirmText="Shut Down NAS"
	variant="danger"
	loading={actionLoading}
	on:confirm={handleShutdown}
	on:cancel={() => (showShutdownModal = false)}
/>

<!-- Reboot Confirmation Dialog -->
<ConfirmModal
	bind:open={showRestartModal}
	title="Reboot Synology NAS?"
	message="This will restart your Synology NAS using the DSM WebAPI. The device will be unavailable for a few minutes while rebooting."
	confirmText="Reboot NAS"
	variant="warning"
	loading={actionLoading}
	on:confirm={handleRestart}
	on:cancel={() => (showRestartModal = false)}
/>
