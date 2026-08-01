"use client";

import { useState } from "react";
import ProfileStep from "./ProfileStep";
import EmailStep from "./EmailStep";
import OtpStep from "./OtpStep";
import FileUploadSubStep from "./FileUploadSubStep";
import DocumentUploadStep from "./DocumentUploadStep";
import api from "@/lib/axios";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    docType: null as { id: string; name: string } | null,
    fullName: "",
    isConsultant: null as boolean | null,
    email: "",
  });

  const nextStep = () => setStep((prev) => prev + 1);
  const prevStep = () => {
    if (step > 1) {
      setStep((prev) => prev - 1);
    } else {
      router.push("/recruiter");
    }
  };

  const handleEmailNext = async () => {
    try {
      await api.post("/auth/otp/email/send", { email: formData.email });
      nextStep();
    } catch (error: any) {
      console.error("Error sending email OTP:", error);
      alert(error.message || "Failed to send OTP to email");
    }
  };

  const submitForm = async () => {
    try {
      const payload = {
        roles: ["recruiter"],
        name: formData.fullName,
        email: formData.email,
        is_consultant: formData.isConsultant,
      };
      const data = await api.post("/user/register", payload);
      localStorage.setItem("user", JSON.stringify(data));
      router.push("/recruiter"); // Redirect to Recruiter Dashboard
    } catch (error: any) {
      console.error("Registration error:", error);
      alert(error.message || "Registration failed");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        {/* Simple Progress Indicator */}
        <div className="flex gap-2 mb-8">
          <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-indigo-600' : 'bg-gray-200'}`} />
          <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-indigo-600' : 'bg-gray-200'}`} />
          <div className={`h-1 flex-1 rounded-full ${step >= 3 ? 'bg-indigo-600' : 'bg-gray-200'}`} />
          <div className={`h-1 flex-1 rounded-full ${step >= 4 ? 'bg-indigo-600' : 'bg-gray-200'}`} />
          <div className={`h-1 flex-1 rounded-full ${step >= 5 ? 'bg-indigo-600' : 'bg-gray-200'}`} />
        </div>

        {step === 1 && (
          <ProfileStep
            data={formData}
            updateData={(val) => setFormData({ ...formData, ...val })}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}

        {step === 2 && (
          <EmailStep
            data={formData}
            updateData={(val) => setFormData({ ...formData, ...val })}
            onNext={handleEmailNext}
            onBack={prevStep}
          />
        )}

        {step === 3 && (
          <OtpStep
            data={formData}
            updateData={(val) => setFormData({ ...formData, ...val })}
            onBack={prevStep}
            onNext={nextStep}
          />
        )}

        {step === 4 && (
          <DocumentUploadStep
            onSelect={(docType: { id: string; name: string }) => {
              setFormData({ ...formData, docType });
              nextStep();
            }}
            onVerifyLater={submitForm}
          />
        )}

        {step === 5 && (
          <FileUploadSubStep
            docType={formData?.docType}
            onBack={prevStep}
            onComplete={(data) => {
              setFormData({ ...formData, ...data });
              submitForm();
            }}
          />
        )}
      </div>
    </div>
  );
}