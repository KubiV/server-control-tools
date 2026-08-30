<script lang="ts">
	import { Server, Lock, Loader2, AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-svelte';

	let password = '';
	let showPassword = false;
	let loading = false;
	let errorMessage = '';

	async function handleLogin() {
		if (!password) {
			errorMessage = 'Please enter your dashboard password.';
			return;
		}

		loading = true;
		errorMessage = '';

		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ password })
			});

			const data = await res.json();

			if (res.ok && data.success) {
				window.location.replace('/');
			} else {
				errorMessage = data.error || 'Authentication failed. Please check your password.';
			}
		} catch (err) {
			errorMessage = 'Network error while attempting to log in. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-surface-950 via-surface-900 to-surface-950">
	<div class="w-full max-w-md bg-surface-900/90 border border-surface-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
		<!-- Header -->
		<div class="text-center mb-8">
			<div class="inline-flex p-3 bg-gradient-to-tr from-brand-600 to-indigo-500 text-white rounded-2xl shadow-xl shadow-brand-500/20 mb-4">
				<Server class="w-8 h-8" />
			</div>
			<h1 class="text-xl font-bold tracking-tight text-surface-50">
				Server Control Panel
			</h1>
			<p class="text-xs text-surface-400 mt-1">
				Synology NAS & Raspberry Pi Dashboard
			</p>
		</div>

		<!-- Error alert -->
		{#if errorMessage}
			<div class="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-start gap-2.5 animate-in fade-in">
				<AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
				<p class="font-medium leading-relaxed">{errorMessage}</p>
			</div>
		{/if}

		<!-- Login form -->
		<form on:submit|preventDefault={handleLogin} class="space-y-5">
			<div>
				<label for="password" class="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-2">
					Dashboard Password
				</label>
				<div class="relative">
					<div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-400">
						<Lock class="w-4 h-4" />
					</div>
					<input
						id="password"
						type={showPassword ? 'text' : 'password'}
						bind:value={password}
						placeholder="Enter your dashboard password..."
						required
						class="w-full pl-10 pr-10 py-2.5 bg-surface-950/80 border border-surface-750 focus:border-brand-500 rounded-xl text-sm text-surface-100 placeholder-surface-500 focus:outline-none transition-colors"
					/>
					<button
						type="button"
						on:click={() => (showPassword = !showPassword)}
						class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-surface-400 hover:text-surface-200 transition-colors"
						aria-label={showPassword ? 'Hide password' : 'Show password'}
					>
						{#if showPassword}
							<EyeOff class="w-4 h-4" />
						{:else}
							<Eye class="w-4 h-4" />
						{/if}
					</button>
				</div>
			</div>

			<button
				type="submit"
				disabled={loading}
				class="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-500/25 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{#if loading}
					<Loader2 class="w-4 h-4 animate-spin" />
					<span>Authenticating...</span>
				{:else}
					<span>Unlock Dashboard</span>
				{/if}
			</button>
		</form>

		<!-- Security notice -->
		<div class="mt-8 pt-6 border-t border-surface-800/80 text-center flex items-center justify-center gap-1.5 text-[11px] text-surface-500">
			<ShieldCheck class="w-3.5 h-3.5 text-emerald-500" />
			<span>Secured via HMAC-SHA256 & LAN Agent Protection</span>
		</div>
	</div>
</div>

