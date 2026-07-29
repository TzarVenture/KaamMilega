import { Mail, CheckCircle2, AlertCircle } from "lucide-react";
import PersonalEmailModal from "./PersonalEmailModal";
import { useState } from "react";

interface Props {
  data: any;
  updateData: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function EmailStep({ data, updateData, onNext, onBack }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const personalDomains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com"];

  const isValidEmail = (emailStr: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(emailStr.trim());
  };

  const handleNextValidation = () => {
    const trimmedEmail = (data.email || "").trim();
    if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
      setError("Please enter a valid official email address (e.g. name@company.com).");
      return;
    }
    setError(null);

    const domain = trimmedEmail.split("@")[1];
    if (personalDomains.includes(domain?.toLowerCase())) {
      setShowModal(true);
    } else {
      onNext();
    }
  };

  return (
    <div className="space-y-6 text-center">
      <div className="flex flex-col items-center">
        <div className="bg-indigo-50 p-4 rounded-2xl mb-4 relative">
          <Mail className="w-10 h-10 text-indigo-600" />
          <CheckCircle2 className="w-5 h-5 text-indigo-600 bg-white rounded-full absolute -top-1 -right-1" />
        </div>
        <h2 className="text-2xl font-black text-slate-900">Verify Your Official Email ID</h2>
        <p className="text-sm font-medium text-slate-500 mt-1">
          Recruiters must verify their email to publish active job listings.
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl flex items-center gap-2 text-xs font-bold text-left">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="text-left space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Official Work Email ID *
          </label>
          <input
            type="email"
            className="w-full px-4 py-3.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-600 outline-none text-sm font-semibold text-slate-900"
            placeholder="Ex: hr@company.com"
            value={data.email}
            onChange={(e) => {
              setError(null);
              updateData({ email: e.target.value });
            }}
          />
          <p className="text-xs font-medium text-slate-400 mt-2">
            We will send a 4-digit verification code to this email address via AWS SES.
          </p>
        </div>
      </div>

      <div className="space-y-3 pt-4">
        <button
          onClick={handleNextValidation}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
        >
          Send Verification Code →
        </button>

        <button
          type="button"
          onClick={onBack}
          className="w-full text-slate-500 hover:text-slate-800 text-xs font-bold py-2"
        >
          ← Back to Profile Step
        </button>
      </div>

      <PersonalEmailModal
        isOpen={showModal}
        email={data.email}
        onClose={() => setShowModal(false)}
        onContinue={() => {
          setShowModal(false);
          onNext(); // Proceed despite it being a personal email
        }}
      />
    </div>
  );
}