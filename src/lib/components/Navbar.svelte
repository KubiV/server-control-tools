<script lang="ts">
	import { Server, RefreshCw, LogOut, ShieldCheck } from 'lucide-svelte';
	import { createEventDispatcher } from 'svelte';

	export let refreshing: boolean = false;
	export let autoRefreshInterval: number = 10; // seconds, 0 = off

	const dispatch = createEventDispatcher<{
		refresh: void;
		intervalChange: number;
		logout: void;
	}>();

	function handleIntervalChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const val = parseInt(target.value, 10);
		dispatch('intervalChange', val);
	}
</script>

<header class="sticky top-0 z-30 bg-surface-950/80 backdrop-blur-md border-b border-surface-800">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
		<!-- Brand -->
		<div class="flex items-center gap-3">
			<div class="p-2 bg-gradient-to-tr from-brand-600 to-indigo-500 text-white rounded-xl shadow-lg shadow-brand-500/20">
				<Server class="w-5 h-5" />
			</div>
			<div>
				<h1 class="text-base font-bold tracking-tight text-surface-50 flex items-center gap-2">
					Server Control Panel
					<span class="inline-flex items-center gap-1 text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
						<ShieldCheck class="w-3 h-3" /> Secure
					</span>
				</h1>
				<p class="text-xs text-surface-400 hidden sm:block">Synology NAS & Raspberry Pi Host Manager</p>
			</div>
		</div>

		<!-- Actions -->
		<div class="flex items-center gap-3">
			<!-- Auto-refresh interval -->
			<div class="flex items-center gap-2 text-xs text-surface-400 bg-surface-900 border border-surface-800 rounded-xl px-2.5 py-1.5">
				<span class="hidden md:inline">Auto-refresh:</span>
				<select
					value={autoRefreshInterval}
					on:change={handleIntervalChange}
					class="bg-transparent text-surface-200 focus:outline-none cursor-pointer"
					aria-label="Auto-refresh interval"
				>
					<option value={0}>Off</option>
					<option value={5}>5s</option>
					<option value={10}>10s</option>
					<option value={30}>30s</option>
					<option value={60}>60s</option>
				</select>
			</div>

			<!-- Manual refresh button -->
			<button
				type="button"
				disabled={refreshing}
				on:click={() => dispatch('refresh')}
				class="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-surface-200 hover:text-white bg-surface-900 hover:bg-surface-800 border border-surface-800 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
				title="Refresh dashboard data"
			>
				<RefreshCw class="w-3.5 h-3.5 {refreshing ? 'animate-spin text-brand-400' : ''}" />
				<span class="hidden sm:inline">Refresh</span>
			</button>

			<!-- Logout button -->
			<button
				type="button"
				on:click={() => dispatch('logout')}
				class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-300 hover:text-rose-100 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition-all"
				title="Log out"
			>
				<LogOut class="w-3.5 h-3.5" />
				<span class="hidden sm:inline">Logout</span>
			</button>
		</div>
	</div>
</header>

