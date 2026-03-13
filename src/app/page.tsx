import { redirect } from 'next/navigation';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ device?: string }>;
}) {
  const params = await searchParams;
  if (params.device === 'tv') {
    redirect('/dashboard');
  }
  redirect('/login');
}
