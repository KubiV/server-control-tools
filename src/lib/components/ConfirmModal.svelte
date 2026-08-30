<script lang="ts">
	import { AlertTriangle, Loader2 } from 'lucide-svelte';
	import { createEventDispatcher } from 'svelte';

	export let open: boolean = false;
	export let title: string = 'Confirm Action';
	export let message: string = 'Are you sure you want to perform this action?';
	export let confirmText: string = 'Confirm';
	export let cancelText: string = 'Cancel';
	export let variant: 'danger' | 'warning' | 'primary' = 'danger';
	export let loading: boolean = false;

	const dispatch = createEventDispatcher<{
		confirm: void;
		cancel: void;
	}>();

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && open && !loading) {
			dispatch('cancel');
		}
	}

	function getButtonClass(): string {
		if (variant === 'danger') {
			return 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500 text-white';
		}
		if (variant === 'warning') {
			return 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500 text-white';
		}
		return 'bg-brand-600 hover:bg-brand-700 focus:ring-brand-500 text-white';
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in"
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
	>
		<!-- Backdrop click handler -->
		<button
			type="button"
			class="fixed inset-0 w-full h-full cursor-default bg-transparent border-0"
			on:click={() => !loading && dispatch('cancel')}
			tabindex="-1"
			aria-label="Close modal overlay"
		></button>

		<!-- Dialog Card -->
		<div
			class="relative w-full max-w-md bg-surface-900 border border-surface-750 rounded-2xl p-6 shadow-2xl z-10 animate-in zoom-in-95 duration-150"
		>
			<div class="flex items-start gap-4">
				<div
					class="p-3 rounded-xl shrink-0 {variant === 'danger'
						? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
						: variant === 'warning'
							? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
							: 'bg-brand-500/10 text-brand-400 border border-brand-500/20'}"
				>
					<AlertTriangle class="w-6 h-6" />
				</div>

				<div class="flex-1">
					<h3 id="modal-title" class="text-lg font-bold text-surface-50">
						{title}
					</h3>
					<p class="mt-2 text-sm text-surface-300 leading-relaxed">
						{message}
					</p>
				</div>
			</div>

			<div class="mt-6 flex items-center justify-end gap-3">
				<button
					type="button"
					disabled={loading}
					on:click={() => dispatch('cancel')}
					class="px-4 py-2 text-sm font-medium text-surface-300 hover:text-surface-100 hover:bg-surface-800 rounded-xl transition-colors disabled:opacity-50"
				>
					{cancelText}
				</button>

				<button
					type="button"
					disabled={loading}
					on:click={() => dispatch('confirm')}
					class="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-colors shadow-lg disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface-900 {getButtonClass()}"
				>
					{#if loading}
						<Loader2 class="w-4 h-4 animate-spin" />
					{/if}
					<span>{confirmText}</span>
				</button>
			</div>
		</div>
	</div>
{/if}

