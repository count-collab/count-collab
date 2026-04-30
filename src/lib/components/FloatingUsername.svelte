<script lang="ts">
	type FloatingEntry = { id: number; username: string; amount: number };

	const {
		usernames,
		oncomplete,
		size = "lg"
	}: {
		usernames: FloatingEntry[];
		oncomplete: (id: number) => void;
		size?: "sm" | "lg";
	} = $props();
</script>

<div
	class="pointer-events-none absolute inset-x-0 bottom-full flex flex-col items-center gap-1"
>
	{#each usernames as entry (entry.id)}
		<span
			class="floating-username {size === 'sm'
				? 'floating-username-sm'
				: 'floating-username-lg'} whitespace-nowrap"
			onanimationend={() => oncomplete(entry.id)}
		>
			{entry.username} <span class="opacity-60">{entry.amount > 0 ? `+${entry.amount}` : entry.amount}</span>
		</span>
	{/each}
</div>

<style>
	.floating-username {
		font-weight: 600;
		letter-spacing: 0.01em;
		border-radius: 9999px;
		background: color-mix(in srgb, rgb(59 130 246) 12%, transparent);
		color: rgb(59 130 246);
		box-shadow: 0 1px 4px rgb(59 130 246 / 0.1);
	}

	:global(.dark) .floating-username {
		background: color-mix(in srgb, rgb(96 165 250) 15%, transparent);
		color: rgb(147 197 253);
		box-shadow: 0 1px 4px rgb(96 165 250 / 0.12);
	}

	.floating-username-lg {
		font-size: 0.8125rem;
		line-height: 1;
		padding: 0.25rem 0.625rem;
		animation: float-up-lg 1.8s ease-out forwards;
	}

	.floating-username-sm {
		font-size: 0.625rem;
		line-height: 1;
		padding: 0.125rem 0.4rem;
		animation: float-up-sm 1.2s ease-out forwards;
	}

	@keyframes float-up-lg {
		0% {
			opacity: 0;
			transform: translateY(0);
		}
		30% {
			opacity: 1;
		}
		70% {
			opacity: 0.8;
		}
		100% {
			opacity: 0;
			transform: translateY(-90px);
		}
	}

	@keyframes float-up-sm {
		0% {
			opacity: 0;
			transform: translateY(0);
		}
		35% {
			opacity: 1;
		}
		65% {
			opacity: 0.75;
		}
		100% {
			opacity: 0;
			transform: translateY(-44px);
		}
	}
</style>
