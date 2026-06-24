import { redirect } from '@sveltejs/kit';
import { buildLoginUrl } from '$lib/server/auth';

export async function GET({ url }) {
  redirect(303, await buildLoginUrl(url.origin));
}
