import { notFound } from 'next/navigation';
import ToastPreview from './ToastPreview';

// Design preview for the toast system; never shipped to production
export default function ToastPreviewPage() {
    if (process.env.NODE_ENV === 'production') notFound();
    return <ToastPreview />;
}
