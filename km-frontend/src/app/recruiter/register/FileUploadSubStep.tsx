// components/registration/FileUploadSubStep.tsx
"use client";

import { useState } from "react";
import { ChevronLeft, Upload, ShieldAlert } from "lucide-react";

interface Props {
  docType: { id: string; name: string } | null;
  onBack: () => void;
  onComplete: (data: any) => void;
}

export default function FileUploadSubStep({ docType, onBack, onComplete }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [docNumber, setDocNumber] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size <= 2 * 1024 * 1024) { // 2MB Limit
        setFile(selectedFile);
      } else {
        alert("File size exceeds 2MB limit");
      }
    }
  };

  return (
    <div className="animate-in slide-in-from-right duration-300">
      {/* Navigation Header */}
      <button
        onClick={onBack}
        className="flex items-center text-gray-500 hover:text-gray-800 transition mb-4"
      >
        <ChevronLeft className="w-5 h-5" />
        <span className="text-sm font-medium">Back</span>
      </button>

      <header className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Upload {docType?.name}</h2>
        <p className="text-sm text-gray-500">To Verify Your Company & Start Hiring</p>
      </header>

      {/* Upload Area */}
      <div className="border-2 border-dashed border-indigo-200 rounded-2xl bg-indigo-50/30 p-8 mb-4 text-center">
        <input
          type="file"
          id="fileUpload"
          hidden
          accept=".pdf,.jpeg,.jpg,.png"
          onChange={handleFileChange}
        />
        <label
          htmlFor="fileUpload"
          className="cursor-pointer flex flex-col items-center"
        >
          <div className="bg-white p-3 rounded-full shadow-md mb-3">
            <Upload className="w-6 h-6 text-indigo-500" />
          </div>
          <span className="bg-indigo-100 text-indigo-600 px-6 py-2 rounded-full font-bold text-sm mb-2 hover:bg-indigo-200 transition">
            {file ? file.name : "Choose A File"}
          </span>
          <p className="text-[10px] text-gray-400">
            Format: PDF, JPEG, JPG, PNG | Maximum File Size: 2 MB
          </p>
        </label>
      </div>

      <div className="flex items-start gap-2 mb-8 bg-orange-50 p-3 rounded-lg border border-orange-100">
        <ShieldAlert className="w-4 h-4 text-orange-500 mt-0.5" />
        <p className="text-[11px] text-orange-700 font-medium">
          (Note: DO NOT Upload Your Personal Documents)
        </p>
      </div>

      {/* Dynamic Number Field */}
      <div className="space-y-2 mb-8 text-left">
        <label className="block text-xs font-extrabold text-slate-900 uppercase tracking-wider">
          {docType?.name || "Document"} Number *
        </label>
        <input
          type="text"
          placeholder={`Enter ${docType?.name || "Document"} Number`}
          className="w-full px-4 py-3.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 outline-none text-sm font-extrabold text-slate-900 bg-white placeholder:text-slate-400 shadow-sm transition-all"
          value={docNumber}
          onChange={(e) => setDocNumber(e.target.value)}
        />
      </div>

      <button
        disabled={!file || !docNumber}
        onClick={() => onComplete({ file, docNumber })}
        className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-300 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 transition-all text-lg"
      >
        Verify Account
      </button>
    </div>
  );
}