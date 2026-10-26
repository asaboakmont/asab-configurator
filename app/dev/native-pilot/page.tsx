import { notFound } from 'next/navigation';
import NativePilotBench from '@/components/dev/NativePilotBench';
export const dynamic = 'force-dynamic';
export default function NativePilotPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <NativePilotBench />;
}
