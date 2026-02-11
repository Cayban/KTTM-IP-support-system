import React, { useEffect, useState, useRef } from "react";
import QRCode from "react-qr-code";
import { Download, LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom"; // ✅ Added for routing

const GetQRPage = () => {
  const [qrValue, setQrValue] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const qrRef = useRef(null);
  const navigate = useNavigate(); // ✅ Initialize navigate

  useEffect(() => {
    try {
      const stored = localStorage.getItem("patient");
      if (!stored) {
        console.warn("⚠️ No patient data found in localStorage.");
        setErrorMsg("No patient data found. Please log in first.");
        return;
      }

      const patient = JSON.parse(stored);
      console.log("🧩 Loaded patient from localStorage:", patient);

      // ✅ Use qr_code if available, else fallback to PAT + id
      const qrCodeString =
        patient.qr_code ||
        (patient.id ? `PAT${String(patient.id).padStart(3, "0")}` : "");

      if (!qrCodeString) {
        setErrorMsg("No QR code available for this patient.");
        return;
      }

      setQrValue(qrCodeString);
    } catch (err) {
      console.error("Error parsing patient data:", err);
      setErrorMsg("Failed to load patient data.");
    }
  }, []);

  // ✅ Use navigate instead of window.location.href
  const handleGoToLogin = () => {
    navigate("/"); // Go back to LoginPage route
  };

  const downloadQR = () => {
    if (!qrRef.current) return;
    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    const svgBlob = new Blob([svgData], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const pngUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = "PatientQR.png";
      link.click();
    };

    img.src = url;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-transparent relative overflow-hidden p-6">
      {/* Soft floating backgrounds for pediatric vibe */}
      <div className="absolute w-56 h-56 bg-yellow-300/30 rounded-full blur-3xl top-10 left-10 animate-float-slow" />
      <div className="absolute w-64 h-64 bg-sky-300/30 rounded-full blur-3xl bottom-20 right-10 animate-float-slower" />

      <div className="bg-white/60 backdrop-blur-md rounded-3xl shadow-2xl p-10 w-full max-w-md text-center border border-sky-200/70 relative z-10">
        <h1 className="text-3xl font-extrabold text-sky-700 mb-2 drop-shadow-sm">
          Your Child’s Health QR
        </h1>
        <p className="text-gray-700 mb-8 text-sm">
          Scan this QR at the clinic kiosk to access your child’s health record.
        </p>

        {errorMsg ? (
          <div className="text-center">
            <p className="text-red-500 font-medium mb-6">{errorMsg}</p>
            <button
              onClick={handleGoToLogin}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-sky-400 text-white font-semibold rounded-full shadow-md hover:bg-sky-500 active:scale-95 transition-all duration-300"
            >
              <LogIn className="w-5 h-5" />
              Go to Login
            </button>
          </div>
        ) : (
          <>
            <div
              ref={qrRef}
              className="relative bg-white p-6 rounded-full shadow-inner inline-block animate-fade-in border-4 border-yellow-300/70"
            >
              <div className="absolute inset-0 rounded-full border-2 border-sky-400 opacity-30 animate-glow" />
              <QRCode value={qrValue} size={220} />
            </div>

            <button
              onClick={downloadQR}
              disabled={!qrValue}
              className="mt-8 flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-sky-400 to-yellow-400 text-white font-semibold rounded-full shadow-md hover:scale-105 hover:shadow-lg active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-5 h-5" />
              Download QR Code
            </button>
          </>
        )}
      </div>

      {/* Pediatric animations */}
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
          .animate-fade-in {
            animation: fadeIn 0.8s ease-out forwards;
          }
          @keyframes glow {
            0%, 100% { box-shadow: 0 0 20px 4px rgba(253, 224, 71, 0.3); }
            50% { box-shadow: 0 0 25px 6px rgba(56, 189, 248, 0.4); }
          }
          .animate-glow {
            animation: glow 3s infinite ease-in-out;
          }
          @keyframes floatSlow {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
          }
          .animate-float-slow {
            animation: floatSlow 9s ease-in-out infinite;
          }
          .animate-float-slower {
            animation: floatSlow 13s ease-in-out infinite;
          }
        `}
      </style>
    </div>
  );
};

export default GetQRPage;
