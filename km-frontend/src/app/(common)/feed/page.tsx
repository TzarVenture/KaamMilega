import { Suspense } from 'react';
import FeedView from '@/components/feed/FeedView';

export default function FeedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-km-surface" />}>
      <FeedView />
    </Suspense>
  );
}
