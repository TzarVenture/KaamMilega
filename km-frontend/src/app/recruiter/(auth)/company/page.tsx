"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowSquareOutIcon, BuildingsIcon, CaretDownIcon, ImageIcon, TrashIcon } from "@phosphor-icons/react";
import api from "@/lib/axios";
import { saveSession, type StoredUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { UPLOAD_LIMITS, uploadFile } from "@/lib/upload";
import { COMPANY_ABOUT_MAX, COMPANY_SIZES, INDUSTRIES, normalizeWebsite, useCityOptions } from "@/lib/companyProfile";
import { FullPageSkeleton } from "@/components/ui/LoadingSkeleton";
import CustomImage from "@/components/ui/CustomImage";
import ImageCropper, { CROPPABLE_ACCEPT, isCroppableImage, isSvgImage } from "@/components/ui/ImageCropper";
import ModalWrapper from "@/components/ui/ModalWrapper";

type CompanyUser = StoredUser & {
    _id?: string;
    id?: string;
    company_name?: string;
    company_logo?: string;
    company_cover?: string;
    company_website?: string;
    company_about?: string;
    company_city?: string;
    company_size?: string;
    industry?: string;
    city?: string;
};

interface Form {
    name: string;
    industry: string;
    size: string;
    city: string;
    website: string;
    about: string;
}

const formFrom = (u: CompanyUser): Form => ({
    name: u.company_name || "",
    industry: u.industry || "",
    size: u.company_size || "",
    city: u.company_city || u.city || "",
    website: (u.company_website || "").replace(/^https?:\/\//i, ""),
    about: u.company_about || "",
});

type ImageKind = "company_logo" | "cover";

/** Larger files are refused before cropping, since the browser has to decode them */
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

/** The cover is shown wide across the top of the company page */
const COVER_ASPECT = 4;

const field =
    "w-full h-11 px-3.5 bg-km-surface-card border border-km-border rounded-xl text-sm text-km-text-primary placeholder:text-km-text-muted outline-none transition-colors focus:border-km-link focus:ring-4 focus:ring-[#DCE8FB] dark:focus:ring-[#16294F]";
const label = "block text-sm font-semibold text-km-text-primary mb-1.5";
const hint = "font-normal text-km-text-secondary";

/** Everything candidates see on the public company page, in one place */
export default function RecruiterCompanyPage() {
    const [user, setUser] = useState<CompanyUser | null>(null);
    const [form, setForm] = useState<Form | null>(null);
    const [saving, setSaving] = useState(false);
    // The image being cropped, before it replaces the logo or cover
    const [cropping, setCropping] = useState<{ kind: ImageKind; file: File } | null>(null);
    // The logo or cover being uploaded or removed right now
    const [imageBusy, setImageBusy] = useState<ImageKind | null>(null);
    const [error, setError] = useState<string | null>(null);
    const cityOptions = useCityOptions();

    useEffect(() => {
        let alive = true;
        api.get("/user/profile")
            .then((u: unknown) => {
                if (!alive || !u) return;
                setUser(u as CompanyUser);
                setForm(formFrom(u as CompanyUser));
            })
            .catch((err: unknown) => alive && notify.error(err, "Couldn’t load your company details."));
        return () => {
            alive = false;
        };
    }, []);

    const companyId = user?._id || user?.id || "";
    const shownLogo = user?.company_logo || "";
    const shownCover = user?.company_cover || "";

    // Only the text fields wait for "Save changes"; the logo and cover save as soon as they're picked
    const changed = useMemo(() => {
        if (!user || !form) return false;
        const saved = formFrom(user);
        return (Object.keys(saved) as (keyof Form)[]).some((k) => saved[k].trim() !== form[k].trim());
    }, [user, form]);

    /** Keeps the page, the stored session and the navbar in step with what the server saved */
    const saved = (updated: CompanyUser | null) => {
        if (!updated) return;
        setUser(updated);
        saveSession(updated, "recruiter");
        window.dispatchEvent(new Event("km:profile-updated"));
    };

    if (!form || !user) return <FullPageSkeleton />;

    const set = (key: keyof Form, value: string) => {
        setForm({ ...form, [key]: value });
        setError(null);
    };

    const imageField = (kind: ImageKind) => (kind === "company_logo" ? "company_logo" : "company_cover");
    const what = (kind: ImageKind) => (kind === "company_logo" ? "Logo" : "Cover photo");

    /** Uploads the image and saves it on the company straight away, like the profile photo */
    const applyImage = async (kind: ImageKind, file: File) => {
        const max = UPLOAD_LIMITS[kind];
        if (file.size > max) {
            notify.error(`The image must be under ${Math.round(max / (1 << 20))} MB.`);
            return;
        }
        setImageBusy(kind);
        try {
            const { url } = await uploadFile(file, kind);
            saved((await api.patch("/user/profile", { [imageField(kind)]: url })) as CompanyUser | null);
            setCropping(null);
            notify.success(`${what(kind)} updated`);
        } catch (err: unknown) {
            notify.error(err, `Couldn’t save the ${what(kind).toLowerCase()}. Please try again.`);
        } finally {
            setImageBusy(null);
        }
    };

    const removeImage = async (kind: ImageKind) => {
        if (!confirm(`Remove your company ${what(kind).toLowerCase()}?`)) return;
        setImageBusy(kind);
        try {
            saved((await api.patch("/user/profile", { [imageField(kind)]: "" })) as CompanyUser | null);
            notify.success(`${what(kind)} removed`);
        } catch (err: unknown) {
            notify.error(err, `Couldn’t remove the ${what(kind).toLowerCase()}. Please try again.`);
        } finally {
            setImageBusy(null);
        }
    };

    const pick = (kind: ImageKind, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        // An SVG logo is already sharp at any size: it is used as it is
        if (kind === "company_logo" && isSvgImage(file)) {
            void applyImage(kind, file);
            return;
        }
        if (!isCroppableImage(file)) {
            notify.error("Please choose a JPG, PNG or WebP image.");
            return;
        }
        if (file.size > MAX_SOURCE_BYTES) {
            notify.error("This image is over 15 MB. Please choose a smaller one.");
            return;
        }
        setError(null);
        setCropping({ kind, file });
    };

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) {
            setError("Enter your company or business name.");
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const updated = (await api.patch("/user/profile", {
                company_name: form.name.trim(),
                industry: form.industry,
                company_size: form.size,
                company_city: form.city.trim(),
                company_website: normalizeWebsite(form.website),
                company_about: form.about.trim(),
            })) as CompanyUser | null;
            saved(updated);
            if (updated) setForm(formFrom(updated));
            notify.success("Company details saved");
        } catch (err: unknown) {
            notify.error(err, "Couldn’t save your company details. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    // Industries saved before the list existed still show as their own option
    const industryKnown = !form.industry || INDUSTRIES.some(([, v]) => v === form.industry);

    return (
        <form onSubmit={save} noValidate className="max-w-3xl mx-auto pb-16">
            <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-km-heading">Company profile</h1>
                    <p className="mt-1 text-sm text-km-text-secondary">What candidates see on your company page and job posts.</p>
                </div>
                {companyId && (
                    <Link
                        href={`/company/${companyId}`}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-km-link hover:underline"
                    >
                        View public page <ArrowSquareOutIcon size={14} weight="bold" aria-hidden="true" />
                    </Link>
                )}
            </div>

            {/* Cover and logo, laid out like the public header */}
            <section className="bg-km-surface-card border border-km-border rounded-2xl overflow-hidden">
                <div className="relative h-36 sm:h-44 bg-km-surface border-b border-km-border">
                    {shownCover ? (
                        <CustomImage src={shownCover} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-km-text-secondary text-sm gap-1">
                            <ImageIcon size={28} className="text-km-text-muted" aria-hidden="true" />
                            <span>Add a cover photo: your shop, team or work site</span>
                        </div>
                    )}
                    <div className="absolute right-3 bottom-3 flex gap-2">
                        {shownCover && (
                            <button
                                type="button"
                                onClick={() => void removeImage("cover")}
                                disabled={imageBusy !== null}
                                className="disabled:opacity-60 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-km-surface-card border border-km-border text-xs font-semibold text-km-text-primary hover:bg-km-surface"
                            >
                                <TrashIcon size={13} weight="bold" aria-hidden="true" /> Remove
                            </button>
                        )}
                        <input id="company-cover" type="file" accept={CROPPABLE_ACCEPT} disabled={imageBusy !== null} onChange={(e) => pick("cover", e)} className="sr-only peer" />
                        <label
                            htmlFor="company-cover"
                            className="cursor-pointer px-3 py-1.5 rounded-lg bg-km-surface-card border border-km-border text-xs font-semibold text-km-text-primary hover:bg-km-surface peer-focus-visible:ring-2 peer-focus-visible:ring-km-link"
                        >
                            {imageBusy === "cover" ? "Saving…" : shownCover ? "Change cover" : "Upload cover"}
                        </label>
                    </div>
                </div>
                <div className="px-5 sm:px-6 pb-5 flex flex-wrap items-end gap-4 -mt-8">
                    <span className="relative w-20 h-20 shrink-0 rounded-2xl border-4 border-km-surface-card bg-km-surface flex items-center justify-center overflow-hidden">
                        {shownLogo ? (
                            <CustomImage src={shownLogo} alt="" className="w-full h-full object-contain bg-white" />
                        ) : (
                            <BuildingsIcon size={30} className="text-km-text-muted" aria-hidden="true" />
                        )}
                    </span>
                    <div className="flex items-center gap-3 pb-1 text-sm">
                        <input id="company-logo" type="file" accept={`${CROPPABLE_ACCEPT},image/svg+xml,.svg`} disabled={imageBusy !== null} onChange={(e) => pick("company_logo", e)} className="sr-only peer" />
                        <label htmlFor="company-logo" className="cursor-pointer font-semibold text-km-link hover:underline peer-focus-visible:underline">
                            {imageBusy === "company_logo" ? "Saving…" : shownLogo ? "Change logo" : "Upload logo"}
                        </label>
                        {shownLogo && (
                            <button
                                type="button"
                                onClick={() => void removeImage("company_logo")}
                                disabled={imageBusy !== null}
                                className="disabled:opacity-60 font-semibold text-km-text-secondary hover:text-red-600"
                            >
                                Remove
                            </button>
                        )}
                        <span className="text-xs text-km-text-secondary">PNG, JPG, WebP or SVG, up to 2 MB</span>
                    </div>
                </div>
            </section>

            <section className="mt-5 bg-km-surface-card border border-km-border rounded-2xl p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                <div className="sm:col-span-2">
                    <label htmlFor="company-name" className={label}>Company or business name</label>
                    <input
                        id="company-name"
                        type="text"
                        autoComplete="organization"
                        value={form.name}
                        onChange={(e) => set("name", e.target.value)}
                        aria-invalid={!form.name.trim() || undefined}
                        className={field}
                    />
                </div>

                <div>
                    <label htmlFor="company-industry" className={label}>Industry</label>
                    <div className="relative">
                        <select id="company-industry" value={form.industry} onChange={(e) => set("industry", e.target.value)} className={`${field} appearance-none pr-10 cursor-pointer`}>
                            <option value="">Choose an industry</option>
                            {!industryKnown && <option value={form.industry}>{form.industry}</option>}
                            {INDUSTRIES.map(([key, value]) => (
                                <option key={key} value={value}>{value}</option>
                            ))}
                        </select>
                        <CaretDownIcon size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-km-text-secondary" aria-hidden="true" />
                    </div>
                </div>

                <div>
                    <label htmlFor="company-size" className={label}>Company size</label>
                    <div className="relative">
                        <select id="company-size" value={form.size} onChange={(e) => set("size", e.target.value)} className={`${field} appearance-none pr-10 cursor-pointer`}>
                            <option value="">Choose a size</option>
                            {COMPANY_SIZES.map((s) => (
                                <option key={s} value={s}>{s} employees</option>
                            ))}
                        </select>
                        <CaretDownIcon size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-km-text-secondary" aria-hidden="true" />
                    </div>
                </div>

                <div>
                    <label htmlFor="company-city" className={label}>City</label>
                    <input
                        id="company-city"
                        type="text"
                        list="company-city-options"
                        autoComplete="address-level2"
                        placeholder="Where the company is based"
                        value={form.city}
                        onChange={(e) => set("city", e.target.value)}
                        className={field}
                    />
                    <datalist id="company-city-options">
                        {cityOptions.map((name) => (
                            <option key={name} value={name} />
                        ))}
                    </datalist>
                </div>

                <div>
                    <label htmlFor="company-website" className={label}>Website <span className={hint}>(optional)</span></label>
                    <input
                        id="company-website"
                        type="text"
                        inputMode="url"
                        autoComplete="url"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder="company.com"
                        value={form.website}
                        onChange={(e) => set("website", e.target.value)}
                        className={field}
                    />
                </div>

                <div className="sm:col-span-2">
                    <label htmlFor="company-about" className={label}>About the company</label>
                    <textarea
                        id="company-about"
                        rows={6}
                        maxLength={COMPANY_ABOUT_MAX}
                        placeholder="What you do, who you serve and what it’s like to work with you."
                        value={form.about}
                        onChange={(e) => set("about", e.target.value)}
                        className={`${field.replace("h-11 ", "")} py-2.5 resize-y`}
                    />
                    <p className="mt-1 text-xs text-km-text-secondary text-right">{form.about.length}/{COMPANY_ABOUT_MAX}</p>
                </div>
            </section>

            {error && <p role="alert" className="mt-4 text-sm font-medium text-red-600">{error}</p>}

            <div className="mt-5 flex justify-end">
                <button
                    type="submit"
                    disabled={!changed || saving || !form.name.trim()}
                    className="px-6 py-2.5 bg-km-primary text-white rounded-xl text-sm font-semibold hover:bg-km-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? "Saving…" : "Save changes"}
                </button>
            </div>

            <ModalWrapper
                isOpen={Boolean(cropping)}
                onClose={() => imageBusy === null && setCropping(null)}
                title={cropping?.kind === "cover" ? "Crop your cover photo" : "Crop your logo"}
            >
                {cropping && (
                    <div className="py-2">
                        <p className="mb-4 text-sm text-km-text-secondary text-center">Drag to move the image and use the slider to zoom.</p>
                        <ImageCropper
                            key={`${cropping.kind}-${cropping.file.name}-${cropping.file.lastModified}`}
                            file={cropping.file}
                            aspect={cropping.kind === "cover" ? COVER_ASPECT : 1}
                            shape={cropping.kind === "cover" ? "rect" : "square"}
                            outputSize={cropping.kind === "cover" ? 1600 : 512}
                            format={cropping.kind === "cover" ? "image/jpeg" : "image/png"}
                            saveLabel={cropping.kind === "cover" ? "Save cover photo" : "Save logo"}
                            busy={imageBusy !== null}
                            onCancel={() => setCropping(null)}
                            onError={() => {
                                setCropping(null);
                                notify.error("This image couldn’t be opened. Please try a JPG or PNG.");
                            }}
                            onCrop={(cropped) => void applyImage(cropping.kind, cropped)}
                        />
                    </div>
                )}
            </ModalWrapper>
        </form>
    );
}
