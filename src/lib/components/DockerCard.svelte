<script lang="ts">
	import {
		Boxes,
		Play,
		Square,
		RotateCw,
		FileText,
		Search,
		AlertCircle,
		Loader2,
		CheckCircle2,
		XCircle,
		Filter
	} from 'lucide-svelte';
	import type { DockerStatusResponse, DockerContainerSummary } from '$lib/types';
	import { toasts } from '$lib/stores/toasts';
	import ConfirmModal from './ConfirmModal.svelte';
	import LogViewerModal from './LogViewerModal.svelte';

	export let dockerStatus: DockerStatusResponse = {
		available: false,
		total: 0,
		running: 0,
		stopped: 0,
		containers: [],
		timestamp: new Date().toISOString()
	};
	export let onRefresh: () => Promise<void>;

	let searchQuery: string = '';
	let statusFilter: 'all' | 'running' | 'stopped' = 'all';

	// Container Action State
	let actionLoading: boolean = false;
	let pendingAction: { type: 'stop' | 'restart'; container: DockerContainerSummary } | null = null;
	let showConfirmModal: boolean = false;

	// Logs Modal State
	let selectedLogContainer: DockerContainerSummary | null = null;
	let showLogsModal: boolean = false;

	$: filteredContainers = (dockerStatus.containers || []).filter((c) => {
		const nameMatch = c.names.some((n) => n.toLowerCase().includes(searchQuery.toLowerCase()));
		const imageMatch = c.image.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesSearch = nameMatch || imageMatch;

		if (!matchesSearch) return false;
		if (statusFilter === 'running') return c.state === 'running';
		if (statusFilter === 'stopped') return c.state !== 'running';
		return true;
	});

	async function handleStartContainer(container: DockerContainerSummary) {
		actionLoading = true;
		try {
			const res = await fetch(`/api/docker/containers/${container.id}/start`, { method: 'POST' });
			const data = await res.json();

			if (data.success) {
				toasts.success('Container Started', `Container ${container.names[0] || container.id} is now running.`);
				await onRefresh();
			} else {
				toasts.error('Start Failed', data.error || 'Failed to start container.');
			}
		} catch (err) {
			toasts.error('Docker Error', String(err));
		} finally {
			actionLoading = false;
		}
	}

	function confirmStop(container: DockerContainerSummary) {
		pendingAction = { type: 'stop', container };
		showConfirmModal = true;
	}

	function confirmRestart(container: DockerContainerSummary) {
		pendingAction = { type: 'restart', container };
		showConfirmModal = true;
	}

	async function executePendingAction() {
		if (!pendingAction) return;
		actionLoading = true;
		const { type, container } = pendingAction;
		const containerName = container.names[0] || container.id;

		try {
			const res = await fetch(`/api/docker/containers/${container.id}/${type}`, { method: 'POST' });
			const data = await res.json();

			if (data.success) {
				toasts.success(
					`Container ${type === 'stop' ? 'Stopped' : 'Restarted'}`,
					`Container ${containerName} was ${type === 'stop' ? 'stopped' : 'restarted'} successfully.`
				);
				showConfirmModal = false;
				pendingAction = null;
				await onRefresh();
			} else {
				toasts.error(`Failed to ${type} container`, data.error || `Could not ${type} container.`);
			}
		} catch (err) {
			toasts.error('Docker Error', String(err));
		} finally {
			actionLoading = false;
		}
	}

	function openLogs(container: DockerContainerSummary) {
		selectedLogContainer = container;
		showLogsModal = true;
	}
</script>

<div class="bg-surface-900/70 border border-surface-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
	<!-- Top Bar -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
		<div class="flex items-center gap-3">
			<div class="p-3 bg-gradient-to-tr from-sky-600/20 to-sky-500/10 text-sky-400 border border-sky-500/20 rounded-2xl">
				<Boxes class="w-6 h-6" />
			</div>
			<div>
				<h2 class="text-lg font-bold text-surface-50 flex items-center gap-2">
					Docker Containers
				</h2>
				<p class="text-xs text-surface-400">
					{dockerStatus.running} running / {dockerStatus.total} total containers
				</p>
			</div>
		</div>

		<!-- Summary Badges -->
		<div class="flex items-center gap-2">
			<button
				type="button"
				on:click={() => (statusFilter = 'all')}
				class="px-3 py-1 rounded-xl text-xs font-semibold border transition-colors {statusFilter === 'all'
					? 'bg-surface-800 text-white border-surface-600 shadow-sm'
					: 'bg-surface-950/60 text-surface-400 border-surface-800 hover:text-surface-200'}"
			>
				All ({dockerStatus.total})
			</button>

			<button
				type="button"
				on:click={() => (statusFilter = 'running')}
				class="px-3 py-1 rounded-xl text-xs font-semibold border transition-colors {statusFilter === 'running'
					? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
					: 'bg-surface-950/60 text-surface-400 border-surface-800 hover:text-surface-200'}"
			>
				Running ({dockerStatus.running})
			</button>

			<button
				type="button"
				on:click={() => (statusFilter = 'stopped')}
				class="px-3 py-1 rounded-xl text-xs font-semibold border transition-colors {statusFilter === 'stopped'
					? 'bg-surface-700 text-surface-200 border-surface-600 shadow-sm'
					: 'bg-surface-950/60 text-surface-400 border-surface-800 hover:text-surface-200'}"
			>
				Stopped ({dockerStatus.stopped})
			</button>
		</div>
	</div>

	<!-- Search & Filter Controls -->
	<div class="mt-5 flex items-center gap-3">
		<div class="relative flex-1">
			<Search class="w-4 h-4 text-surface-400 absolute left-3.5 top-3" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search containers by name or image..."
				class="w-full pl-10 pr-4 py-2 bg-surface-950/80 border border-surface-800 rounded-xl text-xs text-surface-100 placeholder-surface-500 focus:outline-none focus:border-brand-500 transition-colors"
			/>
		</div>
	</div>

	<!-- Docker Unavailability Warning -->
	{#if !dockerStatus.available}
		<div class="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-start gap-3">
			<AlertCircle class="w-5 h-5 shrink-0 mt-0.5" />
			<div>
				<h4 class="font-semibold text-amber-200">Docker Daemon Not Accessible</h4>
				<p class="mt-1 leading-relaxed">{dockerStatus.error || 'Ensure Docker is running and /var/run/docker.sock is mounted.'}</p>
			</div>
		</div>
	{/if}

	<!-- Container List -->
	<div class="mt-5 space-y-3">
		{#if dockerStatus.available && filteredContainers.length === 0}
			<div class="p-8 text-center bg-surface-950/40 border border-dashed border-surface-800 rounded-xl text-surface-400 text-xs">
				No containers match your search filter.
			</div>
		{/if}

		{#each filteredContainers as container (container.id)}
			<div
				class="p-4 bg-surface-950/70 hover:bg-surface-950 border border-surface-800/80 hover:border-surface-700 rounded-xl transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
			>
				<!-- Container Info -->
				<div class="flex items-start gap-3 min-w-0 flex-1">
					<div class="mt-1">
						{#if container.state === 'running'}
							<span class="relative flex h-3 w-3">
								<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
								<span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
							</span>
						{:else}
							<span class="inline-flex rounded-full h-3 w-3 bg-surface-600"></span>
						{/if}
					</div>

					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2 flex-wrap">
							<h3 class="text-sm font-bold text-surface-100 truncate">
								{container.names[0] || container.id}
							</h3>
							<span class="text-[10px] font-mono text-surface-400 px-2 py-0.5 bg-surface-900 border border-surface-800 rounded-md">
								{container.id}
							</span>
						</div>

						<p class="text-xs text-surface-400 font-mono mt-0.5 truncate max-w-lg">
							{container.image}
						</p>

						<div class="flex items-center gap-3 mt-2 flex-wrap text-[11px] text-surface-500">
							<span class="font-medium text-surface-300">
								{container.status}
							</span>

							{#if container.ports && container.ports.length > 0}
								<div class="flex items-center gap-1 flex-wrap">
									{#each container.ports as port}
										{#if port.publicPort}
											<span class="px-1.5 py-0.5 bg-surface-900 border border-surface-800 text-brand-300 font-mono rounded text-[10px]">
												{port.publicPort}:{port.privatePort}/{port.type}
											</span>
										{/if}
									{/each}
								</div>
							{/if}
						</div>
					</div>
				</div>

				<!-- Action Buttons -->
				<div class="flex items-center gap-2 shrink-0 self-end md:self-center">
					<button
						type="button"
						on:click={() => openLogs(container)}
						class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-surface-300 hover:text-white bg-surface-900 hover:bg-surface-800 border border-surface-800 rounded-lg transition-colors"
						title="View container logs"
					>
						<FileText class="w-3.5 h-3.5" />
						<span>Logs</span>
					</button>

					{#if container.state === 'running'}
						<button
							type="button"
							on:click={() => confirmRestart(container)}
							class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-300 hover:text-amber-100 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg transition-colors"
							title="Restart container"
						>
							<RotateCw class="w-3.5 h-3.5" />
							<span>Restart</span>
						</button>

						<button
							type="button"
							on:click={() => confirmStop(container)}
							class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-300 hover:text-rose-100 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-colors"
							title="Stop container"
						>
							<Square class="w-3.5 h-3.5" />
							<span>Stop</span>
						</button>
					{:else}
						<button
							type="button"
							disabled={actionLoading}
							on:click={() => handleStartContainer(container)}
							class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:text-emerald-100 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-colors"
							title="Start container"
						>
							<Play class="w-3.5 h-3.5" />
							<span>Start</span>
						</button>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>

<!-- Destructive Action Confirmation Modal -->
{#if pendingAction}
	<ConfirmModal
		bind:open={showConfirmModal}
		title="{pendingAction.type === 'stop' ? 'Stop' : 'Restart'} Container?"
		message="Are you sure you want to {pendingAction.type} container '{pendingAction.container.names[0] || pendingAction.container.id}'? Services running inside this container will be interrupted."
		confirmText="{pendingAction.type === 'stop' ? 'Stop Container' : 'Restart Container'}"
		variant={pendingAction.type === 'stop' ? 'danger' : 'warning'}
		loading={actionLoading}
		on:confirm={executePendingAction}
		on:cancel={() => {
			showConfirmModal = false;
			pendingAction = null;
		}}
	/>
{/if}

<!-- Container Log Viewer Modal -->
{#if selectedLogContainer}
	<LogViewerModal
		bind:open={showLogsModal}
		containerId={selectedLogContainer.id}
		containerName={selectedLogContainer.names[0] || selectedLogContainer.id}
		on:close={() => {
			showLogsModal = false;
			selectedLogContainer = null;
		}}
	/>
{/if}

