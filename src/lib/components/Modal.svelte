<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open = $bindable(),
		title,
		children,
		maxWidth = 'max-w-lg',
		describedBy,
		onclose
	}: {
		open: boolean;
		title: string;
		children: Snippet;
		maxWidth?: string;
		describedBy?: string;
		onclose?: () => void;
	} = $props();

	let titleId = $derived(
		`${title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')}-title`
	);

	function close() {
		open = false;
		onclose?.();
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (open && e.key === 'Escape') close();
	}}
/>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		role="dialog"
		aria-modal="true"
		aria-labelledby={titleId}
		aria-describedby={describedBy}
		tabindex="-1"
		onclick={(e) => {
			if (e.target === e.currentTarget) close();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') close();
		}}
	>
		<div
			class="bg-white dark:bg-slate-800 rounded-lg shadow-xl dark:shadow-slate-900/50 {maxWidth} w-full mx-4 p-6 space-y-4"
		>
			<div class="flex items-center justify-between">
				<h2 id={titleId} class="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h2>
				<button
					type="button"
					onclick={close}
					class="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
					aria-label="Close"
				>
					<ion-icon name="close-outline" style="font-size: 20px;"></ion-icon>
				</button>
			</div>
			{@render children()}
		</div>
	</div>
{/if}
