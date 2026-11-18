"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlusIcon, CheckCircleIcon, CircleIcon, ImageIcon, InfoIcon, MapPinIcon, TrashIcon, VideoCameraIcon } from "@phosphor-icons/react";
import api from "@/lib/axios";
import { getCurrentUser } from "@/lib/auth";
import { useIsExpert } from "@/lib/useIsExpert";
import { notify } from "@/lib/notify";
import { uploadFile, UPLOAD_LIMITS } from "@/lib/upload";
import { EmptyState, btn, cx, field } from "@/components/admin/ui";
import EventCard from "@/components/events/EventCard";

/** The event types an Expert can host. Hosted events are free for now (client Q15: paid hosting "can wait") */
const EVENT_TYPES = ["Webinar", "Skill Workshop", "Expert Session", "Community Meetup"];

/** The same limits the server checks (km-backend event/host.go) */
const LIMITS = { title: 120, description: 3000, seats: 100000 };

/** Today in India as YYYY-MM-DD, for the date picker's lower bound */
function todayIST(): string {
    return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const HTTPS_LINK = /^https:\/\/\S+\.\S+/;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="km-card p-5 md:p-6 space-y-5">
            <h2 className="text-lg font-semibold text-km-heading">{title}</h2>
            {children}
        </section>
    );
}

export default function CreateEventPage() {
    const router = useRouter();
    const imageInputRef = useRef<HTMLInputElement>(null);
    const canHost = useIsExpert(true);
    const [online, setOnline] = useState(true);
    const [form, setForm] = useState({
        title: "",
        organizer: "",
        category: EVENT_TYPES[0],
        description: "",
        date: "",
        time: "",
        venue: "",
        meeting_link: "",
        capacity: "",
        image_url: "",
    });
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    // The host name defaults to the signed-in user's name, read after mount (it lives in localStorage)
    useEffect(() => {
        const name = getCurrentUser()?.name;
        if (name) setForm((f) => (f.organizer ? f : { ...f, organizer: name }));
    }, []);

    const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value }));

    const onImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        if (file.size > UPLOAD_LIMITS.event_image) {
            notify.error("This image is over 5 MB. Please choose a smaller one.");
            return;
        }
        setUploading(true);
        try {
            const { url } = await uploadFile(file, "event_image");
            setForm((f) => ({ ...f, image_url: url }));
        } catch (err) {
            notify.error(err, "The image couldn’t be uploaded. Please try again.");
        } finally {
            setUploading(false);
        }
    };

    // What still has to be filled in, shown beside the preview
    const steps = [
        { label: "Title and host name", done: !!form.title.trim() && !!form.organizer.trim() },
        { label: "What people will learn", done: !!form.description.trim() },
        { label: "Date and start time", done: !!form.date && !!form.time },
        online
            ? { label: "Meeting link", done: HTTPS_LINK.test(form.meeting_link.trim()) }
            : { label: "Venue address", done: !!form.venue.trim() },
    ];

    const check = (): string => {
        if (!form.title.trim() || !form.organizer.trim() || !form.description.trim() || !form.date || !form.time) {
            return "Fill in the title, host name, description, date and time.";
        }
        if (new Date(`${form.date}T${form.time}:00+05:30`).getTime() <= Date.now()) {
            return "Choose a date and time that haven’t passed yet.";
        }
        if (online && !HTTPS_LINK.test(form.meeting_link.trim())) {
            return "Add the meeting link for your online event, starting with https://";
        }
        if (!online && !form.venue.trim()) {
            return "Add the venue address for your in-person event.";
        }
        const seats = form.capacity === "" ? 0 : Number(form.capacity);
        if (!Number.isInteger(seats) || seats < 0 || seats > LIMITS.seats) {
            return "Seats must be a whole number up to 1,00,000, or empty for no limit.";
        }
        return "";
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        const problem = check();
        setError(problem);
        if (problem) return;

        setSaving(true);
        try {
            await api.post("/events", {
                title: form.title.trim(),
                organizer: form.organizer.trim(),
                category: form.category,
                description: form.description.trim(),
                date: form.date,
                time: form.time,
                location: online ? "Online" : form.venue.trim(),
                meeting_link: online ? form.meeting_link.trim() : "",
                capacity: form.capacity === "" ? 0 : Number(form.capacity),
                image_url: form.image_url,
            });
            notify.success("Your event is live. People can register now.");
            router.push("/events");
        } catch (err) {
            notify.error(err, "The event couldn’t be created. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    if (canHost === false) {
        return (
            <main className="min-h-screen bg-km-surface pb-20">
                <div className="max-w-3xl mx-auto px-4 pt-16">
                    <div className="km-card">
                        <EmptyState
                            icon={CalendarPlusIcon}
                            title="Hosting events is for approved Experts"
                            description="Apply as an Expert to host webinars and workshops on KaamMilega."
                            action={<Link href="/expert/apply" className={btn.primary}>Apply as an Expert</Link>}
                        />
                    </div>
                </div>
            </main>
        );
    }

    // The preview gets the same shape GET /events returns, with placeholders for empty fields
    const seats = Number(form.capacity);
    const preview = {
        title: form.title.trim() || "Your event title",
        organizer: form.organizer.trim() || "Your name",
        date: form.date,
        time: form.time,
        location: online ? "Online" : form.venue.trim() || "Venue address",
        image_url: form.image_url,
        category: form.category,
        capacity: Number.isInteger(seats) && seats > 0 ? seats : 0,
    };
    const remaining = steps.filter((s) => !s.done).length;

    return (
        <main className="min-h-screen bg-km-surface pb-24">
            <div className="max-w-6xl mx-auto px-4 md:px-6 pt-8 md:pt-10">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-km-mentors-text mb-1.5">
                    <CalendarPlusIcon size={16} weight="bold" aria-hidden="true" />
                    Expert Portal
                </p>
                <h1 className="text-2xl md:text-3xl font-bold text-km-heading">Host an event</h1>
                <p className="mt-1 text-sm text-km-text-secondary">Run a webinar, workshop or meetup for the KaamMilega community.</p>
                <p className="mt-3 flex items-start gap-2 text-sm text-km-text-secondary">
                    <InfoIcon size={16} className="mt-0.5 shrink-0 text-km-link" aria-hidden="true" />
                    Events you host are free to join for now.
                </p>

                <form onSubmit={submit} noValidate className="mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-x-8 gap-y-6 items-start">
                    <div className="space-y-6 lg:col-start-1">
                        <Section title="About the event">
                            <div>
                                <label htmlFor="ev-title" className={field.label}>Event title</label>
                                <input id="ev-title" value={form.title} onChange={set("title")} maxLength={LIMITS.title} placeholder="Cracking your first tech interview" className={field.input} aria-describedby="ev-title-count" required />
                                <p id="ev-title-count" className={field.hint}>{form.title.length} / {LIMITS.title} characters</p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="ev-host" className={field.label}>Hosted by</label>
                                    <input id="ev-host" value={form.organizer} onChange={set("organizer")} maxLength={80} className={field.input} required />
                                </div>
                                <div>
                                    <label htmlFor="ev-type" className={field.label}>Type</label>
                                    <select id="ev-type" value={form.category} onChange={set("category")} className={field.input}>
                                        {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label htmlFor="ev-desc" className={field.label}>What people will learn</label>
                                <textarea id="ev-desc" value={form.description} onChange={set("description")} maxLength={LIMITS.description} rows={5} placeholder="Who it's for, what you'll cover and what to bring." className={field.textarea} aria-describedby="ev-desc-count" required />
                                <p id="ev-desc-count" className={field.hint}>{form.description.length} / 3,000 characters</p>
                            </div>
                        </Section>

                        <Section title="When and where">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="ev-date" className={field.label}>Date</label>
                                    <input id="ev-date" type="date" min={todayIST()} value={form.date} onChange={set("date")} className={field.input} required />
                                </div>
                                <div>
                                    <label htmlFor="ev-time" className={field.label}>Start time (IST)</label>
                                    <input id="ev-time" type="time" value={form.time} onChange={set("time")} className={field.input} required />
                                </div>
                            </div>

                            <fieldset>
                                <legend className={field.label}>Where</legend>
                                <div className="grid grid-cols-2 gap-2" role="radiogroup">
                                    {[
                                        { value: true, label: "Online", Icon: VideoCameraIcon },
                                        { value: false, label: "In person", Icon: MapPinIcon },
                                    ].map(({ value, label, Icon }) => (
                                        <button
                                            key={label}
                                            type="button"
                                            role="radio"
                                            aria-checked={online === value}
                                            onClick={() => setOnline(value)}
                                            className={cx(
                                                "flex items-center justify-center gap-2 h-11 rounded-xl border text-sm font-semibold transition-colors",
                                                online === value ? "border-km-primary bg-km-surface text-km-heading" : "border-km-border text-km-text-secondary hover:text-km-heading",
                                            )}
                                        >
                                            <Icon size={16} weight="bold" aria-hidden="true" /> {label}
                                        </button>
                                    ))}
                                </div>
                            </fieldset>

                            {online ? (
                                <div>
                                    <label htmlFor="ev-link" className={field.label}>Meeting link</label>
                                    <input id="ev-link" type="url" inputMode="url" value={form.meeting_link} onChange={set("meeting_link")} placeholder="https://meet.google.com/abc-defg-hij" className={field.input} aria-describedby="ev-link-hint" />
                                    <p id="ev-link-hint" className={field.hint}>Only people who register can see this link.</p>
                                </div>
                            ) : (
                                <div>
                                    <label htmlFor="ev-venue" className={field.label}>Venue address</label>
                                    <input id="ev-venue" value={form.venue} onChange={set("venue")} maxLength={200} placeholder="Hall 2, Andheri Sports Complex, Mumbai" className={field.input} />
                                </div>
                            )}
                        </Section>

                        <Section title="Seats and banner">
                            <div>
                                <label htmlFor="ev-seats" className={field.label}>Seats <span className="font-normal text-km-text-secondary">(optional)</span></label>
                                <input id="ev-seats" type="number" inputMode="numeric" min={0} max={LIMITS.seats} step={1} value={form.capacity} onChange={set("capacity")} placeholder="No limit" className={cx(field.input, "sm:w-48")} aria-describedby="ev-seats-hint" />
                                <p id="ev-seats-hint" className={field.hint}>Registration closes when the seats are full. Leave empty for no limit.</p>
                            </div>

                            <div>
                                <span className={field.label} id="ev-image-label">Banner image <span className="font-normal text-km-text-secondary">(optional)</span></span>
                                <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onImage} className="hidden" aria-labelledby="ev-image-label" />
                                {form.image_url ? (
                                    <div className="relative overflow-hidden rounded-xl border border-km-border">
                                        <img src={form.image_url} alt="Event banner preview" className="w-full aspect-[16/7] object-cover" />
                                        <button type="button" onClick={() => setForm((f) => ({ ...f, image_url: "" }))} className={cx(btn.secondary, "absolute top-2 right-2 h-8 px-3")}>
                                            <TrashIcon size={14} aria-hidden="true" /> Remove
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => imageInputRef.current?.click()}
                                        disabled={uploading}
                                        className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-km-border px-4 py-6 text-center hover:border-km-link disabled:opacity-60 transition-colors"
                                    >
                                        <ImageIcon size={28} className="text-km-text-secondary" aria-hidden="true" />
                                        <span className="text-sm font-semibold text-km-heading">{uploading ? "Uploading…" : "Upload a banner image"}</span>
                                        <span className="text-xs text-km-text-secondary">JPG, PNG or WebP, up to 5 MB. Wide images look best.</span>
                                    </button>
                                )}
                            </div>
                        </Section>
                    </div>

                    <aside className="lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-24 space-y-4" aria-label="Preview">
                        <div>
                            <p className="text-sm font-semibold text-km-heading mb-2">Preview</p>
                            <EventCard event={preview} preview />
                            <p className={field.hint}>This is how your event appears on the Events page.</p>
                        </div>

                        <div className="km-card p-4">
                            <p className="text-sm font-semibold text-km-heading">
                                {remaining === 0 ? "Ready to publish" : `${remaining} ${remaining === 1 ? "thing" : "things"} left`}
                            </p>
                            <ul className="mt-3 space-y-2">
                                {steps.map((s) => (
                                    <li key={s.label} className={cx("flex items-center gap-2 text-sm", s.done ? "text-km-heading" : "text-km-text-secondary")}>
                                        {s.done
                                            ? <CheckCircleIcon size={18} weight="fill" className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                                            : <CircleIcon size={18} className="shrink-0 text-km-text-muted" aria-hidden="true" />}
                                        {s.label}
                                        <span className="sr-only">{s.done ? "(done)" : "(not done yet)"}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </aside>

                    <div className="lg:col-start-1">
                        {error && <p role="alert" className={cx(field.error, "mb-3 text-sm")}>{error}</p>}
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                            <Link href="/events" className={btn.secondary}>Cancel</Link>
                            <button type="submit" disabled={saving || uploading} className={btn.primary}>
                                {saving ? "Publishing…" : "Publish event"}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </main>
    );
}
