<script lang="ts">
	import { X, RefreshCw, Copy, Check, Terminal, Search, Loader2 } from 'lucide-svelte';
	import { createEventDispatcher, onMount } from 'svelte';
	import { toasts } from '$lib/stores/toasts';

	export let open: boolean = false;
	export let containerId: string = '';
	export let containerName: string = '';

	const dispatch = createEventDispatcher<{
		close: void;
	}>();

	let logs: string = '';
	let loading: boolean = false;
	let tail: number = 100;
	let searchTerm: string = '';
	let copied: boolean = false;
	let logContainer: HTMLPreElement | null = null;

	async function fetchLogs() {
		if (!containerId) return;
		loading = true;
		try {
			const res = await fetch(`/api/docker/containers/${containerId}/logs?tail=${tail}`);
			const data = await res.json();
			if (data.success) {
				logs = data.logs || 'No logs available.';
				// Scroll to bottom on fetch
				setTimeout(() => {
					if (logContainer) {
						logContainer.scrollTop = logContainer.scrollHeight;
					}
				}, 50);
			} else {
				logs = `Error loading logs: ${data.error || 'Unknown error'}`;
			}
		} catch (err) {
			logs = `Failed to fetch logs: ${String(err)}`;
		} finally {
			loading = false;
		}
	}

	function handleCopy() {
		if (!logs) return;
		navigator.clipboard.writeText(logs);
		copied = true;
		toasts.success('Logs copied', 'Logs copied to clipboard.');
		setTimeout(() => {
			copied = false;
		}, 2000);
	}

	$: if (open && containerId) {
		fetchLogs();
	}

	$: filteredLogs = searchTerm
		? logs
				.split('\n')
				.filter((line) => line.toLowerCase().includes(searchTerm.toLowerCase()))
				.join('\n')
		: logs;

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			dispatch('close');
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
		role="dialog"
		aria-modal="true"
	>
		<!-- Backdrop click -->
		<button
			type="button"
			class="fixed inset-0 w-full h-full cursor-default bg-transparent border-0"
			on:click={() => dispatch('close')}
			tabindex="-1"
			aria-label="Close logs dialog"
		></button>

		<!-- Modal content -->
		<div
			class="relative w-full max-w-4xl bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl flex flex-col h-[85vh] z-10 overflow-hidden"
		>
			<!-- Header -->
			<div class="px-6 py-4 border-b border-surface-800 flex items-center justify-between bg-surface-950/60">
				<div class="flex items-center gap-3">
					<div class="p-2 bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded-xl">
						<Terminal class="w-5 h-5" />
					</div>
					<div>
						<h3 class="text-base font-bold text-surface-50 flex items-center gap-2">
							Logs: {containerName || containerId}
						</h3>
						<p class="text-xs text-surface-400 font-mono">ID: {containerId}</p>
					</div>
				</div>

				<div class="flex items-center gap-2">
					<button
						type="button"
						on:click={handleCopy}
						class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-surface-300 hover:text-white bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors border border-surface-700"
						title="Copy logs"
					>
						{#if copied}
							<Check class="w-3.5 h-3.5 text-emerald-400" />
							<span>Copied</span>
						{:else}
							<Copy class="w-3.5 h-3.5" />
							<span>Copy</span>
						{/if}
					</button>

					<button
						type="button"
						disabled={loading}
						on:click={fetchLogs}
						class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-surface-300 hover:text-white bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors border border-surface-700 disabled:opacity-50"
						title="Refresh logs"
					>
						<RefreshCw class="w-3.5 h-3.5 {loading ? 'animate-spin' : ''}" />
						<span>Refresh</span>
					</button>

					<button
						type="button"
						on:click={() => dispatch('close')}
						class="p-1.5 text-surface-400 hover:text-white hover:bg-surface-800 rounded-lg transition-colors ml-2"
						aria-label="Close logs dialog"
					>
						<X class="w-5 h-5" />
					</button>
				</div>
			</div>

			<!-- Filter Bar -->
			<div class="px-6 py-2.5 bg-surface-900/90 border-b border-surface-800 flex flex-wrap items-center justify-between gap-3 text-xs">
				<div class="relative flex-1 min-w-[200px]">
					<Search class="w-4 h-4 text-surface-400 absolute left-3 top-2.5" />
					<input
						type="text"
						bind:value={searchTerm}
						placeholder="Filter log lines..."
						class="w-full pl-9 pr-3 py-1.5 bg-surface-950 border border-surface-700 rounded-lg text-surface-100 placeholder-surface-500 focus:outline-none focus:border-brand-500"
					/>
				</div>

				<div class="flex items-center gap-2">
					<label for="tail-select" class="text-surface-400">Tail:</label>
					<select
						id="tail-select"
						bind:value={tail}
						on:change={fetchLogs}
						class="bg-surface-950 border border-surface-700 rounded-lg px-2.5 py-1.5 text-surface-200 focus:outline-none focus:border-brand-500"
					>
						<option value={50}>50 lines</option>
						<option value={100}>100 lines</option>
						<option value={200}>200 lines</option>
						<option value={500}>500 lines</option>
					</select>
				</div>
			</div>

			<!-- Terminal Output -->
			<div class="relative flex-1 bg-black/90 p-4 overflow-hidden">
				{#if loading && !logs}
					<div class="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
						<Loader2 class="w-8 h-8 text-brand-500 animate-spin" />
					</div>
				{/if}

				<pre
					bind:this={logContainer}
					class="w-full h-full font-mono text-xs text-surface-300 overflow-auto whitespace-pre-wrap break-all select-text leading-relaxed font-normal"
				>{filteredLogs || (loading ? 'Loading...' : 'No output')}</pre>
			</div>
		</div>
	</div>
{/if}

