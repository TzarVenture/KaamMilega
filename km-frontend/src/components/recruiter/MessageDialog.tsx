'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { AdminModal, btn, cx, field } from '@/components/admin/ui';
import { fillTemplate, recruiterApi, type ReplyTemplate } from '@/lib/api/recruiter';
import { notify } from '@/lib/notify';

export type Recipient = { candidateId: string; name: string; job?: string };

const BODY_MAX = 1000;
const TITLE_MAX = 60;
const PARALLEL = 3;
/** The chat allows 60 messages a minute, so one send stays under that */
export const MAX_RECIPIENTS = 50;

type Editing = { id?: string; title: string; body: string };

/**
 * Sends a chat message to one or many applicants, from a saved template or typed fresh.
 * {name} and {job} are filled in for each person. Templates can be added, edited and deleted here.
 */
export default function MessageDialog({ recipients, onClose, onSent }: {
    recipients: Recipient[];
    onClose: () => void;
    onSent?: (sentTo: string[]) => void;
}) {
    const t = useTranslations('recruiterMessages');
    const [templates, setTemplates] = useState<ReplyTemplate[] | null>(null);
    const [picked, setPicked] = useState<string>('');
    const [body, setBody] = useState('');
    const [editing, setEditing] = useState<Editing | null>(null);
    const [savingTpl, setSavingTpl] = useState(false);
    const [progress, setProgress] = useState<{ done: number } | null>(null);
    const sending = progress !== null;
    const tooMany = recipients.length > MAX_RECIPIENTS;

    useEffect(() => {
        let alive = true;
        recruiterApi.templates()
            .then((list) => { if (alive) setTemplates(list || []); })
            .catch(() => { if (alive) setTemplates([]); });
        return () => { alive = false; };
    }, []);

    const pick = (tpl: ReplyTemplate) => {
        setPicked(tpl.id);
        setBody(tpl.body);
    };

    const saveTemplate = async () => {
        if (!editing) return;
        const title = editing.title.trim();
        const text = editing.body.trim();
        if (!title || !text) return;
        setSavingTpl(true);
        try {
            const saved = editing.id
                ? await recruiterApi.updateTemplate(editing.id, { title, body: text })
                : await recruiterApi.createTemplate({ title, body: text });
            setTemplates((list) => [saved, ...(list || []).filter((x) => x.id !== saved.id)]);
            pick(saved);
            setEditing(null);
            notify.success(t('templateSaved'));
        } catch (err) {
            notify.error(err, t('templateSaveFailed'));
        } finally {
            setSavingTpl(false);
        }
    };

    const removeTemplate = async (tpl: ReplyTemplate) => {
        const before = templates;
        setTemplates((list) => (list || []).filter((x) => x.id !== tpl.id));
        if (picked === tpl.id) setPicked('');
        try {
            await recruiterApi.deleteTemplate(tpl.id);
        } catch (err) {
            setTemplates(before);
            notify.error(err, t('templateDeleteFailed'));
        }
    };

    const send = async () => {
        const text = body.trim();
        if (!text || sending) return;
        setProgress({ done: 0 });
        const sentTo: string[] = [];
        let failed = 0;
        let lastError: unknown;
        const queue = [...recipients];
        const worker = async () => {
            for (let r = queue.shift(); r; r = queue.shift()) {
                try {
                    await recruiterApi.sendMessage(r.candidateId, fillTemplate(text, { name: r.name, job: r.job }));
                    sentTo.push(r.candidateId);
                } catch (err) {
                    failed++;
                    lastError = err;
                }
                setProgress((p) => ({ done: (p?.done || 0) + 1 }));
            }
        };
        await Promise.all(Array.from({ length: Math.min(PARALLEL, recipients.length) }, worker));
        setProgress(null);
        if (sentTo.length && failed) notify.warning(t('sentPartial', { sent: sentTo.length, failed }));
        else if (sentTo.length) notify.success(t('sent', { count: sentTo.length }));
        else notify.error(lastError, t('sendFailed'));
        if (sentTo.length) {
            onSent?.(sentTo);
            onClose();
        }
    };

    const first = recipients[0];
    const preview = first ? fillTemplate(body, { name: first.name, job: first.job }) : '';
    const title = recipients.length === 1 ? t('titleOne', { name: first?.name || '' }) : t('titleMany', { count: recipients.length });

    return (
        <AdminModal isOpen onClose={() => { if (!sending) onClose(); }} title={title} size="lg">
            <div className="space-y-5">
                {/* Templates */}
                <section>
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <h3 className="text-sm font-semibold text-km-heading">{t('templates')}</h3>
                        {!editing && (
                            <button type="button" onClick={() => setEditing({ title: '', body: body.trim() })} className="inline-flex items-center gap-1 text-sm font-semibold text-km-link hover:underline cursor-pointer">
                                <PlusIcon size={14} aria-hidden="true" />{t('newTemplate')}
                            </button>
                        )}
                    </div>

                    {editing ? (
                        <div className="space-y-3 rounded-xl border border-km-border bg-km-surface p-3">
                            <div>
                                <label htmlFor="tpl-title" className={field.label}>{t('templateTitle')}</label>
                                <input id="tpl-title" value={editing.title} maxLength={TITLE_MAX} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder={t('templateTitlePlaceholder')} className={field.input} />
                            </div>
                            <div>
                                <label htmlFor="tpl-body" className={field.label}>{t('templateBody')}</label>
                                <textarea id="tpl-body" rows={4} value={editing.body} maxLength={BODY_MAX} onChange={(e) => setEditing({ ...editing, body: e.target.value })} placeholder={t('bodyPlaceholder')} className={field.textarea} />
                                <p className={field.hint}>{t('placeholdersHint')}</p>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setEditing(null)} disabled={savingTpl} className={cx(btn.secondary, 'h-9')}>{t('cancel')}</button>
                                <button type="button" onClick={saveTemplate} disabled={savingTpl || !editing.title.trim() || !editing.body.trim()} className={cx(btn.primary, 'h-9')}>
                                    {savingTpl ? t('saving') : t('saveTemplate')}
                                </button>
                            </div>
                        </div>
                    ) : templates === null ? (
                        <div className="h-10 rounded-xl bg-km-surface animate-pulse" aria-busy="true" />
                    ) : templates.length === 0 ? (
                        <p className="text-sm text-km-text-secondary">{t('noTemplates')}</p>
                    ) : (
                        <ul className="flex flex-wrap gap-2" aria-label={t('templates')}>
                            {templates.map((tpl) => (
                                <li key={tpl.id} className={cx('inline-flex items-center rounded-full border text-sm', picked === tpl.id ? 'border-km-blue bg-blue-50 dark:bg-[#14357F]' : 'border-km-border bg-km-surface-card')}>
                                    <button type="button" onClick={() => pick(tpl)} aria-pressed={picked === tpl.id} className="pl-3 pr-1.5 py-1.5 font-medium text-km-heading cursor-pointer max-w-[14rem] truncate">
                                        {tpl.title}
                                    </button>
                                    <button type="button" onClick={() => setEditing({ id: tpl.id, title: tpl.title, body: tpl.body })} className="p-1.5 text-km-text-secondary hover:text-km-heading cursor-pointer" aria-label={t('editTemplate', { title: tpl.title })}>
                                        <PencilSimpleIcon size={14} aria-hidden="true" />
                                    </button>
                                    <button type="button" onClick={() => removeTemplate(tpl)} className="p-1.5 pr-2.5 text-km-text-secondary hover:text-red-600 cursor-pointer" aria-label={t('deleteTemplate', { title: tpl.title })}>
                                        <TrashIcon size={14} aria-hidden="true" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                {/* Message */}
                <section>
                    <label htmlFor="msg-body" className={cx(field.label, 'font-semibold')}>{t('message')}</label>
                    <textarea
                        id="msg-body"
                        rows={5}
                        value={body}
                        maxLength={BODY_MAX}
                        onChange={(e) => { setBody(e.target.value); setPicked(''); }}
                        placeholder={t('bodyPlaceholder')}
                        className={field.textarea}
                    />
                    <p className={field.hint}>{t('placeholdersHint')}</p>
                </section>

                {body.trim() && first && (
                    <section>
                        <h3 className="text-sm font-semibold text-km-heading mb-1">{t('previewFor', { name: first.name })}</h3>
                        <p className="rounded-xl border border-km-border bg-km-surface px-3 py-2 text-sm text-km-text-primary whitespace-pre-line break-words">{preview}</p>
                    </section>
                )}

                <p className="text-xs text-km-text-secondary">{t('chatNote', { count: recipients.length })}</p>
                {tooMany && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{t('tooMany', { max: MAX_RECIPIENTS })}</p>}
            </div>

            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button type="button" onClick={onClose} disabled={sending} className={btn.secondary}>{t('cancel')}</button>
                <button type="button" onClick={send} disabled={sending || !body.trim() || !!editing || tooMany} className={btn.accent}>
                    {sending ? t('sending', { done: progress?.done || 0, count: recipients.length }) : t('send', { count: recipients.length })}
                </button>
            </div>
        </AdminModal>
    );
}
