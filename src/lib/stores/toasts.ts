import { writable } from 'svelte/store';

export interface ToastMessage {
	id: string;
	type: 'info' | 'success' | 'warning' | 'error';
	title: string;
	message?: string;
	durationMs?: number;
}

function createToastStore() {
	const { subscribe, update } = writable<ToastMessage[]>([]);

	function add(toast: Omit<ToastMessage, 'id'>) {
		const id = Math.random().toString(36).substring(2, 9);
		const newToast: ToastMessage = {
			...toast,
			id,
			durationMs: toast.durationMs ?? 4000
		};

		update((toasts) => [...toasts, newToast]);

		if (newToast.durationMs && newToast.durationMs > 0) {
			setTimeout(() => {
				remove(id);
			}, newToast.durationMs);
		}

		return id;
	}

	function remove(id: string) {
		update((toasts) => toasts.filter((t) => t.id !== id));
	}

	return {
		subscribe,
		info: (title: string, message?: string) => add({ type: 'info', title, message }),
		success: (title: string, message?: string) => add({ type: 'success', title, message }),
		warning: (title: string, message?: string) => add({ type: 'warning', title, message }),
		error: (title: string, message?: string) => add({ type: 'error', title, message, durationMs: 6000 }),
		remove
	};
}

export const toasts = createToastStore();

