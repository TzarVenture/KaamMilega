import { Suspense } from 'react';
import SinglePostView from '@/components/feed/SinglePostView';

export default async function FeedPostPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  return (
    <Suspense fallback={<div className="min-h-screen bg-km-surface" />}>
      <SinglePostView postId={postId} />
    </Suspense>
  );
}
