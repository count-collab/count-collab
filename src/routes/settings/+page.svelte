<script lang="ts">
	import { enhance } from "$app/forms";
	import MetaTags from "$lib/components/MetaTags.svelte";
	import Modal from "$lib/components/Modal.svelte";
	import type { ActionData, PageData } from "./$types";

	const { data, form }: { data: PageData; form: ActionData } = $props();

	let showDeleteModal = $state(false);
	let confirmInput = $state("");

	const user = $derived(data.session?.user);
	const canDelete = $derived(confirmInput === user?.username);

	function capitalize(s: string): string {
		return s.charAt(0).toUpperCase() + s.slice(1);
	}
</script>

<MetaTags
	title="Settings | Count Collab"
	description="Manage your account settings."
	path="/settings"
/>

<div class="space-y-8">
	<h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">Settings</h1>

	<section class="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 space-y-4">
		<h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">Account Info</h2>
		<div class="space-y-3 text-sm">
			<div class="flex items-center gap-2">
				<span class="font-medium text-slate-500 dark:text-slate-400 w-32">Username</span>
				<span class="text-slate-900 dark:text-slate-100">@{user?.username}</span>
			</div>
			<div class="flex items-center gap-2">
				<span class="font-medium text-slate-500 dark:text-slate-400 w-32">Email</span>
				<span class="text-slate-900 dark:text-slate-100">{user?.email}</span>
			</div>
			<div class="flex items-center gap-2">
				<span class="font-medium text-slate-500 dark:text-slate-400 w-32">Providers</span>
				<span class="text-slate-900 dark:text-slate-100">
					{data.providers.map(capitalize).join(", ")}
				</span>
			</div>
		</div>
	</section>

	<section
		class="bg-white dark:bg-slate-800 rounded-lg border-2 border-red-200 dark:border-red-800 p-6 space-y-4"
	>
		<h2 class="text-xl font-semibold text-red-700 dark:text-red-400">Danger Zone</h2>
		<p class="text-sm text-slate-600 dark:text-slate-400">
			Permanently delete your account and all associated data. This action
			cannot be undone.
		</p>
		<button
			type="button"
			onclick={() => (showDeleteModal = true)}
			class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-semibold"
		>
			Delete Account
		</button>
	</section>
</div>

<Modal bind:open={showDeleteModal} title="Delete Account">
	<div class="space-y-4">
		<ul class="list-disc pl-5 text-sm text-slate-700 dark:text-slate-300 space-y-1">
			{#if data.ownedCounterCount > 0}
				<li>
					{data.ownedCounterCount} counter{data.ownedCounterCount === 1
						? ""
						: "s"} you own will be permanently deleted
				</li>
			{/if}
			{#if data.membershipCount > 0}
				<li>
					You will be removed from {data.membershipCount} counter{data.membershipCount ===
					1
						? ""
						: "s"} you're a member of
				</li>
			{/if}
			<li>
				Your increment history on other users' counters will be anonymized
			</li>
		</ul>
		<p class="text-sm font-semibold text-red-600">
			This action cannot be undone.
		</p>

		{#if form?.error}
			<p class="text-sm text-red-600">{form.error}</p>
		{/if}

		<form method="POST" action="?/delete" use:enhance class="space-y-4">
			<div>
				<label for="confirmUsername" class="block text-sm text-slate-700 dark:text-slate-300 mb-1">
					Type your username to confirm
				</label>
				<input
					id="confirmUsername"
					name="confirmUsername"
					type="text"
					bind:value={confirmInput}
					placeholder={user?.username}
					autocomplete="off"
					class="w-full px-3 py-2 border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-400 focus:border-red-500 dark:focus:border-red-400 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
				/>
			</div>
			<div class="flex items-center justify-end gap-3">
				<button
					type="button"
					onclick={() => (showDeleteModal = false)}
					class="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={!canDelete}
					class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700"
				>
					Delete Account
				</button>
			</div>
		</form>
	</div>
</Modal>
