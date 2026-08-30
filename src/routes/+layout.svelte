<script lang="ts">
	import '../app.css';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
</script>

<div class="min-h-screen flex flex-col bg-surface-950 text-surface-100 selection:bg-brand-600 selection:text-white">
	<slot />
	<ToastContainer />
</div>

