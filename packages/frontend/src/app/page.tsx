import { redirect } from 'next/navigation';

export default function Home() {
  // The dashboard layout / middleware handle auth; send everyone to the cockpit.
  redirect('/dashboard/ceo');
}
