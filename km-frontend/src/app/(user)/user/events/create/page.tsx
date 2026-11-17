"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlusIcon, ImageIcon, InfoIcon, MapPinIcon, TrashIcon, VideoCameraIcon } from "@phosphor-icons/react";
import api from "@/lib/axios";
import { getCurrentUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { uploadFile, UPLOAD_LIMITS } from "@/lib/upload";
import { EmptyState, btn, cx, field } from "@/components/admin/ui";

/** The event types an Expert can host (paid hiring drives are run by KaamMilega) */
const EVENT_TYPES = ["Webinar", "Skill Workshop", "Expert Session", "Community Meetup"];

const LIMITS = { title: 120, description: 3000, seats: 100000 };

/** Today in India as YYYY-MM-DD, for the date picker's lower bound */
function todayIST(): string {
    return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function CreateEventPage() {
    const router = useRouter();
    const imageInputRef = useRef<HTMLInputElement>(null);
    const [canHost, setCanHost] = useState<boolean | null>(null);
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

    // Roles and the name live in localStorage, so read them after mount
    useEffect(() => {
        const user = getCurrentUser();
        const roles = Array.isArray(user?.roles) ? user.roles : user?.role ? [user.role] : [];
        setCanHost(roles.includes("expert") || roles.includes("admin"));
        if (user?.name) setForm((f) => (f.organizer ? f : { ...f, organizer: user.name as string }));
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

    const check = (): string => {
        if (!form.title.trim() || !form.organizer.trim() || !form.description.trim() || !form.date || !form.time) {
            return "Fill in the title, host name, description, date and time.";
        }
        if (new Date(`${form.date}T${form.time}:00+05:30`).getTime() <= Date.now()) {
            return "Choose a date and time that haven’t passed yet.";
        }
        if (online && !/^https:\/\/\S+\.\S+/.test(form.meeting_link.trim())) {
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

    return (
        <main className="min-h-screen bg-km-surface pb-24">
            <div className="max-w-2xl mx-auto px-4 pt-8 md:pt-10">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-km-mentors-text mb-1.5">
                    <CalendarPlusIcon size={16} weight="bold" aria-hidden="true" />
                    Expert Portal
                </p>
                <h1 className="text-2xl md:text-3xl font-bold text-km-heading">Host an event</h1>
                <p className="mt-1 text-sm text-km-text-secondary">Run a webinar, workshop or meetup for the KaamMilega community.</p>

                <p className="mt-4 flex items-start gap-2 text-sm text-km-text-secondary">
                    <InfoIcon size={16} className="mt-0.5 shrink-0 text-km-link" aria-hidden="true" />
                    Events you host are free to join. Paid events are run by KaamMilega.
                </p>

                <form onSubmit={submit} noValidate className="km-card p-5 md:p-8 mt-6 space-y-5">
                    <div>
                        <label htmlFor="ev-title" className={field.label}>Event title</label>
                        <input id="ev-title" value={form.title} onChange={set("title")} maxLength={LIMITS.title} placeholder="Cracking your first tech interview" className={field.input} required />
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

                    {error && <p role="alert" className={field.error}>{error}</p>}

                    <div className="pt-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                        <Link href="/events" className={btn.secondary}>Cancel</Link>
                        <button type="submit" disabled={saving || uploading} className={btn.primary}>
                            {saving ? "Publishing…" : "Publish event"}
                        </button>
                    </div>
                </form>
            </div>
        </main>
    );
}
