import { useState, useEffect, useRef } from "react";
import QRCode from "react-qr-code";
import {
  Baby,
  Stethoscope,
  Download,
  User,
  Mail,
  Calendar,
} from "lucide-react";
import Swal from "sweetalert2";
function PatientProfile() {
  const [userInfo, setUserInfo] = useState({
    full_name: "",
    email: "",
    qr_code: "",
  });

  const [formData, setFormData] = useState({
    gender: "",
    father_name: "",
    mother_name: "",
    guardian: "",
    phone_number: "",
    guardian_number: "",
    address: "",
    blood_type: "",
    allergies: "",
    chronic_conditions: "",
    last_checkup: "",
    birth_date: "",
    age: "",
    created_at: "",
    role: "",
  });

  const [message, setMessage] = useState("");
  const [qrSize, setQrSize] = useState(180);
  const qrRef = useRef(null);

  // Vaccination records
  const [vaccinations, setVaccinations] = useState([]);
  const [vacLoading, setVacLoading] = useState(true);
  const [vacError, setVacError] = useState(null);
  const [showVaccineModal, setShowVaccineModal] = useState(false);
  const [vaccineDefs, setVaccineDefs] = useState([]);
  const [defsLoading, setDefsLoading] = useState(false);
  const [defsError, setDefsError] = useState(null);

  // Update QR code size based on window width
  useEffect(() => {
    const updateQrSize = () => {
      setQrSize(window.innerWidth < 640 ? 140 : 180);
    };

    updateQrSize();
    window.addEventListener("resize", updateQrSize);
    return () => window.removeEventListener("resize", updateQrSize);
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchUserInfo();
    fetchLastCheckup(); // ✅ Get latest completed appointment
    fetchVaccinationHistory();
  }, []);

  // Allow page scrolling when modal is open so mobile users can reach the close button.
  // Also keep a persistent return to restore previous overflow.
  useEffect(() => {
    const prev = document.body.style.overflow;
    if (showVaccineModal) {
      // enable scrolling on the page (so users can scroll up to access modal controls)
      document.body.style.overflow = "auto";
    } else {
      document.body.style.overflow = prev || "";
    }

    return () => {
      document.body.style.overflow = prev || "";
    };
  }, [showVaccineModal]);

  // Fetch vaccine definitions (available vaccines) when needed
  const fetchVaccineDefinitions = async () => {
    setDefsLoading(true);
    setDefsError(null);
    try {
      const base = import.meta.env.VITE_API_URL;
      // try a few common endpoints defensively (prioritize DB-backed endpoint)
      const candidates = [
        "/vaccine_definitions",
        "/vaccine-definitions",
        "/vaccines",
        "/vaccine-defs",
      ];
      let data = null;
      for (const path of candidates) {
        try {
          const res = await fetch(`${base}${path}`, {
            headers: {
              Authorization: `Bearer ${
                window.localStorage.getItem("token") || ""
              }`,
              "Content-Type": "application/json",
            },
          });
          if (!res.ok) continue;
          const json = await res.json();
          if (Array.isArray(json) && json.length > 0) {
            data = json;
            break;
          }
        } catch (e) {
          // ignore and try next
        }
      }

      if (!data) {
        // fallback: derive from existing vaccination history
        const derived = Array.from(
          new Set(
            (vaccinations || [])
              .map((v) => v.vaccine_name || v.name || v.vaccine)
              .filter(Boolean)
          )
        );
        data = derived.map((n) => ({ name: n }));
      }

      setVaccineDefs(data || []);
      return data || [];
    } catch (err) {
      console.error("Error fetching vaccine definitions:", err);
      setDefsError("Unable to load vaccine definitions.");
      setVaccineDefs([]);
      return [];
    } finally {
      setDefsLoading(false);
    }
  };

  // 🔹 Fetch vaccination history for logged-in patient
  const fetchVaccinationHistory = async () => {
    setVacLoading(true);
    setVacError(null);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/patient/vaccination-history`,
        {
          headers: {
            Authorization: `Bearer ${
              window.localStorage.getItem("token") || ""
            }`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        if (res.status === 404) {
          setVaccinations([]);
          setVacLoading(false);
          return;
        }
        throw new Error("Failed to fetch vaccination history");
      }

      const data = await res.json();
      // Expecting an array of vaccination records; be defensive
      const arr = Array.isArray(data) ? data : [];
      setVaccinations(arr);
      return arr;
    } catch (err) {
      console.error("Error fetching vaccination history:", err);
      setVacError("Unable to load vaccination records.");
      return [];
    } finally {
      setVacLoading(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return "-";
    try {
      return new Date(d).toLocaleDateString();
    } catch (e) {
      return String(d);
    }
  };

  // Build matrix grouped by vaccine name with slots for doses and boosters
  const buildVaccineMatrix = (records) => {
    const map = {};

    const parseDoseNumber = (rec) => {
      // Try numeric fields
      const n = rec.dose_number || rec.doseNum || rec.dose_no || null;
      if (n != null && !Number.isNaN(Number(n))) return Number(n);

      // Try string like '1st', '2nd', '3rd', 'Booster 1'
      const s = (rec.dose || rec.series || "" + rec.note || "")
        .toString()
        .toLowerCase();
      if (/1st|first|\b1\b/.test(s)) return 1;
      if (/2nd|second|\b2\b/.test(s)) return 2;
      if (/3rd|third|\b3\b/.test(s)) return 3;
      if (/booster\s*1|boost1|b1/.test(s)) return 4;
      if (/booster\s*2|boost2|b2/.test(s)) return 5;
      if (/booster\s*3|boost3|b3/.test(s)) return 6;

      return null;
    };

    (records || []).forEach((rec) => {
      const name =
        rec.vaccine_name || rec.name || rec.vaccine || "Unknown Vaccine";
      if (!map[name]) {
        map[name] = { name, slots: Array(6).fill(null) }; // 0..2 doses, 3..5 boosters
      }

      const idx = parseDoseNumber(rec);
      const date =
        rec.date_given ||
        rec.vaccination_date ||
        rec.administered_at ||
        rec.date ||
        null;

      if (idx && idx >= 1 && idx <= 3) {
        map[name].slots[idx - 1] = date || rec.note || "Recorded";
      } else if (idx && idx >= 4 && idx <= 6) {
        map[name].slots[idx - 4 + 3] = date || rec.note || "Recorded";
      } else {
        // Try to place in first empty slot (prioritize doses)
        const firstEmpty = map[name].slots.findIndex(
          (s, i) => s == null && i < 3
        );
        if (firstEmpty !== -1)
          map[name].slots[firstEmpty] = date || rec.note || "Recorded";
        else {
          const firstBoostEmpty = map[name].slots.findIndex(
            (s, i) => s == null && i >= 3
          );
          if (firstBoostEmpty !== -1)
            map[name].slots[firstBoostEmpty] = date || rec.note || "Recorded";
        }
      }
    });

    return Object.values(map);
  };

  // 🔹 Fetch patient profile record for the logged-in user (patient_profiles table)
  const fetchProfile = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/patient/profile-data`,
        {
          headers: {
            Authorization: `Bearer ${
              window.localStorage?.getItem("token") || ""
            }`,
            "Content-Type": "application/json",
          },
        }
      );

      if (res.ok) {
        const data = await res.json();
        console.log("✅ Loaded patient_profiles record:", data);
        updatePatientData(data);
      } else if (res.status === 404) {
        Swal.fire({
          icon: "info",
          title: "Profile Not Found",
          text: "No patient profile found for this account. Please contact the clinic staff.",
          confirmButtonColor: "#0ea5e9",
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Load Failed",
          text: "Failed to load your profile data. Please try again.",
          confirmButtonColor: "#0ea5e9",
        });
      }
    } catch (err) {
      console.error("❌ Error fetching patient profile:", err);
      Swal.fire({
        icon: "error",
        title: "Connection Error",
        text: "Unable to load profile. Please check your internet connection.",
        confirmButtonColor: "#0ea5e9",
      });
    }
  };

  // 🔹 Fetch gender + birth_date from users table
  const fetchUserInfo = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/patient/user-info`,
        {
          headers: {
            Authorization: `Bearer ${
              window.localStorage?.getItem("token") || ""
            }`,
            "Content-Type": "application/json",
          },
        }
      );

      if (res.ok) {
        const data = await res.json();
        console.log("✅ Loaded user info:", data);

        const birthDate = data.birth_date ? data.birth_date.split("T")[0] : "";
        const age = calculateAgeDetailed(birthDate);

        setFormData((prev) => ({
          ...prev,
          birth_date: birthDate,
          gender: data.gender || "",
          age,
        }));
      }
    } catch (err) {
      console.error("❌ Error fetching user info:", err);
    }
  };

  // 🔹 Fetch latest completed appointment as last checkup
  const fetchLastCheckup = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/patient/last-checkup`,
        {
          headers: {
            Authorization: `Bearer ${
              window.localStorage.getItem("token") || ""
            }`,
            "Content-Type": "application/json",
          },
        }
      );

      if (res.ok) {
        const data = await res.json();
        console.log("✅ Loaded last checkup:", data);
        setFormData((prev) => ({
          ...prev,
          last_checkup: data.last_checkup
            ? data.last_checkup.split("T")[0]
            : "No completed appointments",
        }));
      } else if (res.status === 404) {
        setFormData((prev) => ({
          ...prev,
          last_checkup: "No completed appointments",
        }));
      }
    } catch (err) {
      console.error("❌ Error fetching last checkup:", err);
    }
  };

  // ✅ More detailed age calculation (handles days/months/years)
  const calculateAgeDetailed = (birthDate) => {
    if (!birthDate) return "";

    const birth = new Date(birthDate);
    const today = new Date();

    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();
    let days = today.getDate() - birth.getDate();

    if (days < 0) {
      const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      days += prevMonth.getDate();
      months--;
    }

    if (months < 0) {
      months += 12;
      years--;
    }

    if (years < 1) {
      if (months < 1) {
        return days <= 1 ? `${days} day old` : `${days} days old`;
      }
      return months === 1 ? `${months} month old` : `${months} months old`;
    }

    return years === 1 ? `${years} year old` : `${years} years old`;
  };

  const updatePatientData = (patient) => {
    setUserInfo({
      full_name: patient.full_name || "Unknown Patient",
      email: patient.email || "No email available",
      qr_code:
        patient.qr_code ||
        (patient.user_id
          ? `PAT${String(patient.user_id).padStart(3, "0")}`
          : ""),
    });

    setFormData((prev) => ({
      ...prev,
      father_name: patient.father_name || "",
      mother_name: patient.mother_name || "",
      guardian: patient.guardian || "",
      phone_number: patient.phone_number || "",
      guardian_number: patient.guardian_number || "",
      address: patient.address || "",
      blood_type: patient.blood_type || "",
      allergies: patient.allergies || "",
      chronic_conditions: patient.chronic_conditions || "",
      created_at: patient.created_at
        ? new Date(patient.created_at).toLocaleDateString()
        : "",
      role: patient.role || "patient",
    }));
  };

  const downloadQR = () => {
    if (!qrRef.current) {
      Swal.fire({
        icon: "error",
        title: "Download Failed",
        text: "QR code not available. Please refresh the page.",
        confirmButtonColor: "#0ea5e9",
      });
      return;
    }

    const svg = qrRef.current.querySelector("svg");
    if (!svg) {
      Swal.fire({
        icon: "error",
        title: "Download Failed",
        text: "QR code not available. Please refresh the page.",
        confirmButtonColor: "#0ea5e9",
      });
      return;
    }

    try {
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

        // Success notification
        Swal.fire({
          icon: "success",
          title: "QR Code Downloaded!",
          text: "Your QR code has been saved successfully",
          confirmButtonColor: "#0ea5e9",
          timer: 2000,
          showConfirmButton: false,
        });
      };

      img.onerror = () => {
        Swal.fire({
          icon: "error",
          title: "Download Failed",
          text: "Failed to generate QR code image. Please try again.",
          confirmButtonColor: "#0ea5e9",
        });
      };

      img.src = url;
    } catch (err) {
      console.error("Error downloading QR:", err);
      Swal.fire({
        icon: "error",
        title: "Download Failed",
        text: "An error occurred while downloading. Please try again.",
        confirmButtonColor: "#0ea5e9",
      });
    }
  };

  return (
    <div className="min-h-screen px-4 sm:px-6 md:px-8 py-6 sm:py-8 md:py-10 bg-transparent">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-4 sm:gap-6 lg:gap-8">
        {/* LEFT PANEL */}
        <div className="bg-white/80 backdrop-blur-sm border-t-4 sm:border-t-8 border-sky-400 rounded-2xl sm:rounded-3xl shadow-md flex-1 p-4 sm:p-5 md:p-6 lg:max-w-sm">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <Baby className="text-sky-500 w-8 h-8 sm:w-10 sm:h-10" />
            <h1 className="text-xl sm:text-2xl font-extrabold text-sky-700">
              Patient Info
            </h1>
          </div>

          <div className="bg-sky-50 rounded-xl p-3 sm:p-4 mb-4 sm:mb-5 border border-sky-100">
            <h2 className="font-semibold text-sm sm:text-base text-sky-700 mb-2 flex items-center gap-2">
              <Stethoscope className="w-4 h-4 sm:w-5 sm:h-5 text-sky-600 flex-shrink-0" />
              <span>Account Details</span>
            </h2>
            <p className="text-gray-700 mb-1.5 sm:mb-1 flex items-center gap-2 text-sm sm:text-base">
              <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-500 flex-shrink-0" />
              <span className="font-medium break-words">
                {userInfo.full_name}
              </span>
            </p>
            <p className="text-gray-700 mb-1.5 sm:mb-1 flex items-center gap-2 text-sm sm:text-base">
              <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-500 flex-shrink-0" />
              <span className="font-medium break-all">{userInfo.email}</span>
            </p>
            <p className="text-gray-700 mb-1.5 sm:mb-1 flex items-center gap-2 text-sm sm:text-base">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-500 flex-shrink-0" />
              <span className="font-medium">
                Created: {formData.created_at || "Unknown"}
              </span>
            </p>
            <p className="text-gray-700 mb-1.5 sm:mb-1 flex items-center gap-2 text-sm sm:text-base">
              <Stethoscope className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-500 flex-shrink-0" />
              <span className="font-medium capitalize">
                Role: {formData.role || "Patient"}
              </span>
            </p>

            <div className="mt-3 sm:mt-4 border-t border-sky-200 pt-3 space-y-1.5 sm:space-y-2">
              <p className="text-gray-700 flex flex-col sm:flex-row sm:justify-between gap-1 text-sm sm:text-base">
                <span className="font-semibold">Birth Date:</span>
                <span className="sm:text-right">
                  {formData.birth_date || "Not provided"}
                </span>
              </p>
              <p className="text-gray-700 flex flex-col sm:flex-row sm:justify-between gap-1 text-sm sm:text-base">
                <span className="font-semibold">Age:</span>
                <span className="sm:text-right">{formData.age || "N/A"}</span>
              </p>
              <p className="text-gray-700 flex flex-col sm:flex-row sm:justify-between gap-1 text-sm sm:text-base">
                <span className="font-semibold">Gender:</span>
                <span className="sm:text-right">
                  {formData.gender || "Not provided"}
                </span>
              </p>
            </div>
          </div>

          {userInfo.qr_code ? (
            <div className="text-center mt-4 sm:mt-6">
              <h2 className="text-base sm:text-lg font-semibold text-sky-700 mb-2 sm:mb-3">
                Your KIOSK QR Code
              </h2>
              <div
                ref={qrRef}
                className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl inline-block shadow-inner border-2 sm:border-4 border-yellow-300/70"
              >
                <QRCode value={userInfo.qr_code} size={qrSize} />
              </div>
              <p className="mt-2 text-gray-600 text-xs sm:text-sm">
                QR ID: <span className="font-semibold">{userInfo.qr_code}</span>
              </p>

              <div className="mt-3 sm:mt-4 flex items-center justify-center">
                <button
                  onClick={downloadQR}
                  className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-sky-400 to-yellow-400 text-white text-sm sm:text-base font-semibold rounded-full shadow-md hover:scale-105 active:scale-95 transition touch-manipulation"
                >
                  <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Download QR</span>
                </button>
              </div>
            </div>
          ) : (
            <p className="text-red-500 text-center mt-4 sm:mt-6 text-sm sm:text-base">
              QR Code not assigned yet.
            </p>
          )}
        </div>

        {/* RIGHT PANEL — READ ONLY DISPLAY */}
        <div className="flex-1 bg-white/80 backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-md p-4 sm:p-5 md:p-6">
          <h2 className="text-xl sm:text-2xl font-bold text-sky-700 mb-4 sm:mb-6">
            Personal Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {[
              ["Father's Name", formData.father_name],
              ["Mother's Name", formData.mother_name],
              ["Guardian", formData.guardian],
              ["Guardian Number", formData.guardian_number],
              ["Phone Number", formData.phone_number],
              ["Address", formData.address],
              ["Blood Type", formData.blood_type],
              ["Allergies", formData.allergies],
              ["Chronic Conditions", formData.chronic_conditions],
              ["Last Checkup", formData.last_checkup],
            ].map(([label, value]) => (
              <div
                key={label}
                className="bg-sky-50 border border-sky-100 p-3 sm:p-3.5 rounded-lg"
              >
                <span className="block text-xs sm:text-sm text-sky-700 font-semibold mb-1 sm:mb-1.5">
                  {label}
                </span>
                <span className="block text-gray-800 text-sm sm:text-base break-words">
                  {value || "Not provided"}
                </span>
              </div>
            ))}
          </div>

          {/* Vaccination Records */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg sm:text-xl font-bold text-sky-700">
                Vaccination Records
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    // Show modal immediately so mobile users see it, then fetch data
                    setShowVaccineModal(true);
                    // fetch defs/history (do not await here so modal shows quickly)
                    fetchVaccineDefinitions();
                    fetchVaccinationHistory();
                  }}
                  className="text-sm bg-yellow-400 text-sky-900 px-3 py-1 rounded-md font-semibold hover:bg-yellow-500 transition"
                >
                  Vaccine record
                </button>
                <button
                  onClick={fetchVaccinationHistory}
                  className="text-xs text-sky-600 bg-sky-50 border border-sky-100 px-2 py-1 rounded hover:bg-sky-100 transition"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="bg-white/50 border border-sky-100 rounded-lg p-3 sm:p-4 text-sm text-gray-600">
              <p>
                Click the{" "}
                <span className="font-semibold text-sky-700">
                  Vaccine record
                </span>{" "}
                button to view detailed vaccination history.
              </p>
            </div>
          </div>

          {/* Vaccine Record Modal */}
          {showVaccineModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => setShowVaccineModal(false)}
              />
              <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] overflow-auto z-10">
                <div className="sticky top-0 bg-white z-30 flex items-center justify-between p-4 border-b">
                  <h3 className="text-lg font-bold text-sky-800">
                    Vaccine Record
                  </h3>
                  <button
                    onClick={() => setShowVaccineModal(false)}
                    className="text-xl px-3 py-1 hover:bg-gray-100 rounded"
                  >
                    ×
                  </button>
                </div>

                <div className="p-4">
                  <div className="overflow-x-auto">
                    <table className="table-auto w-full text-sm">
                      <thead>
                        <tr className="bg-sky-50">
                          <th className="px-3 py-2 text-left font-semibold">
                            Vaccine
                          </th>
                          <th className="px-3 py-2 text-center font-semibold">
                            1st Dose
                          </th>
                          <th className="px-3 py-2 text-center font-semibold">
                            2nd Dose
                          </th>
                          <th className="px-3 py-2 text-center font-semibold">
                            3rd Dose
                          </th>
                          <th className="px-3 py-2 text-center font-semibold">
                            Booster 1
                          </th>
                          <th className="px-3 py-2 text-center font-semibold">
                            Booster 2
                          </th>
                          <th className="px-3 py-2 text-center font-semibold">
                            Booster 3
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {defsLoading || vacLoading ? (
                          <tr>
                            <td
                              colSpan={7}
                              className="p-4 text-center text-sky-600"
                            >
                              Loading vaccination records…
                            </td>
                          </tr>
                        ) : (
                          (function () {
                            // Build a quick map of existing vaccine rows from history
                            const historyRows = buildVaccineMatrix(
                              vaccinations || []
                            ).reduce((acc, r) => {
                              acc[r.name] = r;
                              return acc;
                            }, {});

                            const defs =
                              vaccineDefs && vaccineDefs.length > 0
                                ? vaccineDefs
                                : Object.keys(historyRows).map((n) => ({
                                    name: n,
                                  }));

                            if (!defs || defs.length === 0) {
                              return (
                                <tr>
                                  <td
                                    colSpan={7}
                                    className="p-6 text-center text-gray-600"
                                  >
                                    No vaccine record available.
                                  </td>
                                </tr>
                              );
                            }

                            return defs.map((def, i) => {
                              const name =
                                def.name ||
                                def.vaccine_name ||
                                def.title ||
                                "Unknown Vaccine";
                              const row = historyRows[name];
                              const slots =
                                row && row.slots
                                  ? row.slots
                                  : Array(6).fill(null);

                              return (
                                <tr
                                  key={name + i}
                                  className="odd:bg-white even:bg-sky-50"
                                >
                                  <td className="px-3 py-2 align-top">
                                    <div className="font-medium text-sky-900 truncate max-w-xs">
                                      {name}
                                    </div>
                                  </td>
                                  {slots.map((s, idx) => (
                                    <td
                                      key={idx}
                                      className="px-3 py-2 text-center align-top text-xs"
                                    >
                                      {s ? (
                                        <span className="text-gray-700">
                                          {formatDate(s)}
                                        </span>
                                      ) : (
                                        <span className="text-gray-400 font-semibold">
                                          ----
                                        </span>
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              );
                            });
                          })()
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {message && (
            <p className="mt-4 text-center text-red-600 text-sm sm:text-base px-2">
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default PatientProfile;