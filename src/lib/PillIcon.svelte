<script lang="ts">
  import { icons } from '@lucide/svelte';
  import { normalizeIconName } from '$lib/pill-icons';

  let { name, size = 12 }: { name: string; size?: number } = $props();

  let Icon = $derived(icons[normalizeIconName(name) as keyof typeof icons]);
</script>

{#if Icon}
  <Icon {size} strokeWidth={2.25} />
{/if}
