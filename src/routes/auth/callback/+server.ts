import { redirect } from '@sveltejs/kit';
import { finishLogin } from '$lib/server/auth';

export async function GET({ url, cookies }) {
  await finishLogin(url, cookies);
  redirect(303, '/');
}
