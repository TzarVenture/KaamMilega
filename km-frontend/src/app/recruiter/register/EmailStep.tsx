import { Mail, CheckCircle2 } from "lucide-react";
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

  const personalDomains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com"];

  const handleNextValidation = () => {
    const domain = data.email.split("@")[1];
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
        <h2 className="text-2xl font-bold text-gray-900">Verify Your Official Email ID</h2>
      </div>

      <div className="text-left space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Official Email ID*</label>
          <input
            type="email"
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="Ex: madan@99acres.com"
            value={data.email}
            onChange={(e) => updateData({ email: e.target.value })}
          />
          <p className="text-xs text-gray-400 mt-2">We will sent you an OTP on this Email</p>
        </div>
      </div>

      <div className="space-y-4 pt-4">
        <button
          disabled={!data.email.includes("@")}
          onClick={handleNextValidation}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-full transition-all"
        >
          Next
        </button>

        <button className="text-indigo-600 text-sm font-semibold hover:underline">
          I don't have an Official Email ID
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