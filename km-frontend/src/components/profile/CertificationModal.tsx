'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CheckIcon, FileTextIcon, SpinnerGapIcon, UploadSimpleIcon, XIcon } from '@phosphor-icons/react';
import ModalWrapper from '@/components/ui/ModalWrapper';
import { credentialsApi, type Certification, type CertificationInput } from '@/lib/api/credentials';
import { notify } from '@/lib/notify';
import { uploadFile, UPLOAD_LIMITS } from '@/lib/upload';

const empty: CertificationInput = { name: '', issuer: '', issued_on: '', expires_on: '', credential_id: '', credential_url: '', file_id: '', skills: [] };

const input =
  'w-full h-11 px-3.5 rounded-xl border border-km-border bg-km-surface-card text-[15px] text-km-text-primary placeholder:text-km-text-muted outline-none focus:border-km-link focus:ring-4 focus:ring-[#DCE8FB] dark:focus:ring-[#16294F]';
const label = 'block text-sm font-medium text-km-heading mb-1.5';

/** Add or edit a certificate. Changing anything a reviewer checks sends it back for review. */
export default function CertificationModal({ cert, open, skills, onClose, onSaved }: {
  cert: Certification | null;
  open: boolean;
  /** The member's skills, to pick the ones this certificate covers */
  skills: string[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [form, setForm] = useState<CertificationInput>(empty);
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const thisMonth = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    if (!open) return;
    setForm(
      cert
        ? {
            name: cert.name, issuer: cert.issuer, issued_on: cert.issued_on, expires_on: cert.expires_on ?? '',
            credential_id: cert.credential_id ?? '', credential_url: cert.credential_url ?? '', file_id: cert.file_id ?? '', skills: cert.skills,
          }
        : empty,
    );
    setFileName(cert?.file_id ? 'Uploaded file' : '');
  }, [open, cert]);

  const set = <K extends keyof CertificationInput>(k: K, v: CertificationInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const pickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > UPLOAD_LIMITS.certificate) {
      notify.error('This file is over 5 MB. Please choose a smaller one.');
      return;
    }
    setUploading(true);
    try {
      const up = await uploadFile(file, 'certificate');
      set('file_id', up.id);
      setFileName(file.name);
    } catch (err) {
      notify.error(err, "Couldn't upload the file");
    } finally {
      setUploading(false);
    }
  };

  const toggleSkill = (s: string) =>
    set('skills', form.skills.includes(s) ? form.skills.filter((x) => x !== s) : form.skills.length < 10 ? [...form.skills, s] : form.skills);

  const hasEvidence = !!(form.file_id || form.credential_url.trim() || form.credential_id.trim());
  const valid = form.name.trim().length >= 2 && form.issuer.trim().length >= 2 && !!form.issued_on && (!form.expires_on || form.expires_on >= form.issued_on);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || saving || uploading) return;
    setSaving(true);
    try {
      const saved = cert ? await credentialsApi.updateCertification(cert.id, form) : await credentialsApi.addCertification(form);
      notify.success(saved.status === 'pending' ? 'Saved and sent for review' : 'Certificate saved');
      await onSaved();
    } catch (err) {
      notify.error(err, "Couldn't save the certificate");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper isOpen={open} onClose={() => !saving && onClose()} title={cert ? 'Edit certificate' : 'Add certificate'}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="cert-name" className={label}>Name</label>
          <input id="cert-name" className={input} value={form.name} maxLength={120} onChange={(e) => set('name', e.target.value)} placeholder="For example: Wireman licence" required />
        </div>
        <div>
          <label htmlFor="cert-issuer" className={label}>Issued by</label>
          <input id="cert-issuer" className={input} value={form.issuer} maxLength={120} onChange={(e) => set('issuer', e.target.value)} placeholder="For example: ITI Pune, NSDC, Google" required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="cert-issued" className={label}>Issue month</label>
            <input id="cert-issued" type="month" className={input} value={form.issued_on} max={thisMonth} onChange={(e) => set('issued_on', e.target.value)} required />
          </div>
          <div>
            <label htmlFor="cert-expires" className={label}>Expiry month <span className="font-normal text-km-text-secondary">(if any)</span></label>
            <input id="cert-expires" type="month" className={input} value={form.expires_on} min={form.issued_on || undefined} onChange={(e) => set('expires_on', e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="cert-id" className={label}>Credential ID</label>
            <input id="cert-id" className={input} value={form.credential_id} maxLength={100} onChange={(e) => set('credential_id', e.target.value)} />
          </div>
          <div>
            <label htmlFor="cert-url" className={label}>Credential link</label>
            <input id="cert-url" type="url" className={input} value={form.credential_url} maxLength={500} onChange={(e) => set('credential_url', e.target.value)} placeholder="https://" />
          </div>
        </div>

        <div>
          <p className={label}>Certificate file <span className="font-normal text-km-text-secondary">(PDF, JPG or PNG, up to 5 MB)</span></p>
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={pickFile} />
          {form.file_id ? (
            <div className="flex items-center justify-between gap-3 h-11 px-3.5 rounded-xl border border-km-border bg-km-surface">
              <span className="flex items-center gap-2 min-w-0 text-sm text-km-text-primary">
                <FileTextIcon size={18} className="shrink-0" aria-hidden="true" />
                <span className="truncate">{fileName}</span>
              </span>
              <button type="button" onClick={() => { set('file_id', ''); setFileName(''); }} aria-label="Remove file" className="p-1 text-km-text-secondary hover:text-red-600 cursor-pointer">
                <XIcon size={16} weight="bold" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-outline h-11 w-full text-sm disabled:opacity-60">
              {uploading ? <SpinnerGapIcon size={16} className="animate-spin" aria-hidden="true" /> : <UploadSimpleIcon size={16} aria-hidden="true" />}
              {uploading ? 'Uploading…' : 'Upload file'}
            </button>
          )}
          <p className="mt-1.5 text-[13px] text-km-text-secondary">Only you and our review team can open this file.</p>
        </div>

        {skills.length > 0 && (
          <fieldset>
            <legend className={label}>Skills it covers</legend>
            <div className="flex flex-wrap gap-2">
              {skills.map((s) => {
                const on = form.skills.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSkill(s)}
                    aria-pressed={on}
                    className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[13px] font-medium cursor-pointer ${
                      on ? 'border-km-link bg-km-link text-white' : 'border-km-border text-km-text-primary hover:border-km-link'
                    }`}
                  >
                    {on && <CheckIcon size={13} weight="bold" aria-hidden="true" />}
                    {s}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[13px] text-km-text-secondary">Once verified, these skills show a Certified badge.</p>
          </fieldset>
        )}

        <p className="text-[13px] text-km-text-secondary">
          {hasEvidence ? 'Our team will check this and add a Verified badge.' : 'Add a file, link or ID so we can verify it. Without one it shows as not verified.'}
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={saving} className="btn-outline h-10 px-4 text-sm">Cancel</button>
          <button type="submit" disabled={!valid || saving || uploading} className="btn-primary h-10 px-5 text-sm disabled:opacity-60 disabled:cursor-not-allowed">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}
