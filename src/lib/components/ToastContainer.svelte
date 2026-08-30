<script lang="ts">
	import { toasts, type ToastMessage } from '$lib/stores/toasts';
	import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-svelte';

	function getBgColor(type: ToastMessage['type']): string {
		switch (type) {
			case 'success':
				return 'bg-emerald-950/90 border-emerald-500/50 text-emerald-100 shadow-emerald-950/40';
			case 'warning':
				return 'bg-amber-950/90 border-amber-500/50 text-amber-100 shadow-amber-950/40';
			case 'error':
				return 'bg-rose-950/90 border-rose-500/50 text-rose-100 shadow-rose-950/40';
			default:
				return 'bg-surface-900/95 border-surface-700 text-surface-100 shadow-black/40';
		}
	}
</script>

<div class="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none px-4 sm:px-0">
	{#each $toasts as toast (toast.id)}
		<div
			class="pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 {getBgColor(toast.type)}"
			role="alert"
		>
			<div class="mt-0.5 shrink-0">
				{#if toast.type === 'success'}
					<CheckCircle2 class="w-5 h-5 text-emerald-400" />
				{:else if toast.type === 'warning'}
					<AlertTriangle class="w-5 h-5 text-amber-400" />
				{:else if toast.type === 'error'}
					<XCircle class="w-5 h-5 text-rose-400" />
				{:else}
					<Info class="w-5 h-5 text-brand-400" />
				{/if}
			</div>

			<div class="flex-1 min-w-0">
				<h4 class="text-sm font-semibold leading-5">{toast.title}</h4>
				{#if toast.message}
					<p class="text-xs mt-0.5 opacity-90 leading-normal break-words">{toast.message}</p>
				{/if}
			</div>

			<button
				type="button"
				on:click={() => toasts.remove(toast.id)}
				class="shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors opacity-70 hover:opacity-100"
				aria-label="Close notification"
			>
				<X class="w-4 h-4" />
			</button>
		</div>
	{/each}
</div>

