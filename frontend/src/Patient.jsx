import { useState, useEffect } from "react";
import {
  FaUserCircle,
  FaChartPie,
  FaCalendarAlt,
  FaClipboardList,
  FaHome,
  FaNotesMedical,
  FaQrcode,
  FaSignOutAlt,
} from "react-icons/fa";
import PatientProfile from "./PatientProfile";
import Analysis from "./Analysis";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  Calendar,
  FolderOpen,
  ChevronDown,
  RefreshCw,
  Clock,
  ClipboardList,
  Star,
  User,
  FileText,
  Eye,
  AlertCircle,
  Activity,
  Home,
  LogOut,
  X,
  CheckCircle,
  Bell,
} from "lucide-react";
import Swal from "sweetalert2";

// ✅ APPOINTMENT TYPES
const appointmentTypes = {
  Vaccination: 30,
  "Check-up": 60,
  "Ear Piercing": 5,
  "Follow-up Check-up": 20,
  Consultation: 30,
};

function Patient() {
  const [activePage, setActivePage] = useState("home");
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [patientName, setPatientName] = useState("Patient");
  const [notificationCount, setNotificationCount] = useState(0);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  useEffect(() => {
    const fetchNotificationCount = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/notifications/patient`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await response.json();

        const lastViewedTime = localStorage.getItem("lastNotificationView");
        const unreadCount = lastViewedTime
          ? data.filter(
              (n) => new Date(n.created_at) > new Date(lastViewedTime)
            ).length
          : data.length;

        setNotificationCount(unreadCount);
      } catch (error) {
        console.error("Error fetching notification count:", error);
      }
    };

    fetchNotificationCount();
    const interval = setInterval(fetchNotificationCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const fetchPatientInfo = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/patient/user-info`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (res.ok) {
          const data = await res.json();
          if (data.full_name) {
            setPatientName(data.full_name);
          }
        }
      } catch (err) {
        console.error("Error fetching patient info:", err);
      }
    };

    fetchPatientInfo();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  // ✅ APPOINTMENTS PAGE COMPONENT
  const AppointmentsPage = () => {
    const [filterStatus, setFilterStatus] = useState("all");
    const [patientConcerns, setPatientConcerns] = useState("");
    const [vaccinationType, setVaccinationType] = useState("");
    const [appointmentType, setAppointmentType] = useState("");
    const [additionalServices, setAdditionalServices] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState(null);
    const [availableSlots, setAvailableSlots] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [slotsLoading, setSlotsLoading] = useState(false);

    const [medicalRecords, setMedicalRecords] = useState([]);
    const [medicalLoading, setMedicalLoading] = useState(true);
    const [medicalError, setMedicalError] = useState(null);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFullName, setImportFullName] = useState("");
    const [importMotherName, setImportMotherName] = useState("");
    const [importFatherName, setImportFatherName] = useState("");
    const [importSearchLoading, setImportSearchLoading] = useState(false);
    const [importResults, setImportResults] = useState([]);
    const [importError, setImportError] = useState(null);
    const [selectedImportIds, setSelectedImportIds] = useState(new Set());
    const [importSubmitting, setImportSubmitting] = useState(false);
    const [openFolder, setOpenFolder] = useState(null);
    const [appointmentsOpen, setAppointmentsOpen] = useState(false);
    const [availableVaccines, setAvailableVaccines] = useState([]);
    const [vaccinesLoading, setVaccinesLoading] = useState(false);
    const [selectedVaccine, setSelectedVaccine] = useState(null);

    // Add this state at the top of AppointmentsPage component
    const [calendarSlots, setCalendarSlots] = useState({});
    const [loadingCalendar, setLoadingCalendar] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(new Date());

    // ADD THIS HELPER FUNCTION HERE - before any other functions
    const formatDateDisplay = (dateString) => {
      if (!dateString) return "N/A";

      // dateString format: "2025-12-03"
      const [year, month, day] = dateString.split("-").map(Number);

      // Create date object using LOCAL timezone (not UTC)
      const date = new Date(year, month - 1, day);

      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    };

    // Add this function to fetch slots for entire month
    const fetchMonthSlots = async (month) => {
      if (!appointmentType) return;

      try {
        setLoadingCalendar(true);
        const token = localStorage.getItem("token");

        const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
        const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);

        const startDate = firstDay.toISOString().split("T")[0];
        const endDate = lastDay.toISOString().split("T")[0];

        console.log("Fetching slots from:", startDate, "to:", endDate); // ← ADD THIS

        const response = await fetch(
          `${
            import.meta.env.VITE_API_URL
          }/patient/available-slots-range?start_date=${startDate}&end_date=${endDate}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          console.log("Received slots:", data); // ← ADD THIS
          const slotsByDate = data.reduce((acc, slot) => {
            const date = slot.schedule_date;
            if (!acc[date]) acc[date] = [];
            acc[date].push(slot);
            return acc;
          }, {});
          setCalendarSlots(slotsByDate);
        }
      } catch (error) {
        console.error("Error fetching month slots:", error);
      } finally {
        setLoadingCalendar(false);
      }
    };

    // Fetch month slots when appointment type changes
    useEffect(() => {
      if (appointmentType) {
        fetchMonthSlots(selectedMonth);
      } else {
        setCalendarSlots({});
      }
    }, [appointmentType, selectedMonth]);

    // Helper function to get available slot count for a date
    // Helper function to get available slot count for a date
    const getAvailableSlotCount = (date) => {
      // Format date without timezone conversion
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;

      const slots = calendarSlots[dateStr] || [];
      return slots.reduce((sum, slot) => sum + slot.available_slots, 0);
    };

    // Fetch available slots when date is selected
    const fetchAvailableSlots = async (date) => {
      if (!date) {
        setAvailableSlots([]);
        return;
      }

      try {
        setSlotsLoading(true);
        const token = localStorage.getItem("token");
        // Format date without timezone conversion
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const dateString = `${year}-${month}-${day}`;

        const response = await fetch(
          `${
            import.meta.env.VITE_API_URL
          }/patient/available-slots?date=${dateString}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setAvailableSlots(data);
        } else {
          setAvailableSlots([]);
        }
      } catch (error) {
        console.error("Error fetching slots:", error);
        setAvailableSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    };

    // Fetch slots when date changes
    useEffect(() => {
      if (selectedDate && appointmentType) {
        fetchAvailableSlots(selectedDate);
      } else {
        setAvailableSlots([]);
      }
    }, [selectedDate, appointmentType]);

    // Fetch appointments
    useEffect(() => {
      const fetchAppointments = async () => {
        try {
          setLoading(true);
          const token = localStorage.getItem("token");
          const response = await fetch(
            `${import.meta.env.VITE_API_URL}/get/appointments`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
          if (response.ok) {
            const data = await response.json();
            setAppointments(data);
          }
        } catch (error) {
          console.error("Error fetching appointments:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchAppointments();
    }, []);

    // Fetch available vaccines when Vaccination is selected
    useEffect(() => {
      if (appointmentType === "Vaccination") {
        fetchAvailableVaccines();
      }
    }, [appointmentType]);

    const fetchAvailableVaccines = async () => {
      try {
        setVaccinesLoading(true);
        const token = localStorage.getItem("token");

        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/patient/available-vaccines`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to fetch vaccines");
        }

        const data = await response.json();
        setAvailableVaccines(data.vaccines || []);
        setVaccinesLoading(false);
      } catch (err) {
        console.error("Error fetching vaccines:", err);
        Swal.fire({
          icon: "error",
          title: "Cannot Load Vaccines",
          text:
            err.message ||
            "Please make sure your birth date is set in your profile.",
          confirmButtonColor: "#0ea5e9",
        });
        setVaccinesLoading(false);
        setAppointmentType("");
      }
    };

    // Auto-load medical records and user info
    useEffect(() => {
      const loadUserAndRecords = async () => {
        try {
          const token = localStorage.getItem("token");
          if (!token) return;

          const userRes = await fetch(
            `${import.meta.env.VITE_API_URL}/patient/user-info`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (userRes.ok) {
            const userData = await userRes.json();
            if (userData.full_name) {
              setImportFullName(userData.full_name);
            }
          }

          await fetchPatientRecords();
        } catch (error) {
          console.error("Error loading data:", error);
        }
      };

      loadUserAndRecords();
    }, []);

    const fetchPatientRecords = async () => {
      try {
        setMedicalLoading(true);
        const token = localStorage.getItem("token");

        if (!token) {
          setMedicalError("Please login to view your medical records");
          setMedicalLoading(false);
          return;
        }

        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/patient/medical-records`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("Session expired. Please login again.");
          }
          throw new Error(`Error: ${response.status}`);
        }

        const data = await response.json();
        setMedicalRecords(data);
        setMedicalLoading(false);
      } catch (err) {
        console.error("Error fetching medical records:", err);
        setMedicalError(err.message);
        setMedicalLoading(false);
      }
    };

    const toggleAdditionalService = (type) => {
      if (additionalServices.includes(type)) {
        setAdditionalServices(additionalServices.filter((t) => t !== type));
      } else {
        setAdditionalServices([...additionalServices, type]);
      }
    };

    const handleSelectNone = () => {
      setAdditionalServices([]);
    };

    const handleBookAppointment = async (patientConcerns, vaccinationType) => {
      if (!selectedDate || !appointmentType || !selectedSlot) {
        Swal.fire({
          icon: "warning",
          title: "Missing Information",
          text: "Please select date, appointment type, and time slot.",
          confirmButtonColor: "#0ea5e9",
        });
        return;
      }

      if (appointmentType === "Vaccination" && !vaccinationType) {
        Swal.fire({
          icon: "warning",
          title: "Select Vaccine",
          text: "Please select a vaccination type from the available options.",
          confirmButtonColor: "#0ea5e9",
        });
        return;
      }

      try {
        const token = localStorage.getItem("token");
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/appointments`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              schedule_id: selectedSlot.schedule_id,
              type: appointmentType,
              concerns: patientConcerns,
              additional_services:
                additionalServices.length > 0
                  ? additionalServices.join(", ")
                  : "None",
              vaccination_type: vaccinationType || null,
            }),
          }
        );

        const data = await response.json();

        if (response.ok) {
          await Swal.fire({
            icon: "success",
            title: "Booked!",
            text: data.message,
            confirmButtonColor: "#0ea5e9",
          });

          setSelectedDate(null);
          setAppointmentType("");
          setSelectedSlot(null);
          setPatientConcerns("");
          setAdditionalServices([]);
          setVaccinationType("");
          setSelectedVaccine(null);
          setAvailableVaccines([]);
          window.location.reload();
        } else {
          Swal.fire({
            icon: "error",
            title: "Booking Failed",
            text: data.error || "Failed to book appointment",
            confirmButtonColor: "#0ea5e9",
          });
        }
      } catch (error) {
        console.error("Error booking appointment:", error);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Failed to book appointment. Please try again.",
          confirmButtonColor: "#0ea5e9",
        });
      }
    };

    const groupedRecords = medicalRecords.reduce((groups, record) => {
      const type = record.appointment_type || "Others";
      if (!groups[type]) groups[type] = [];
      groups[type].push(record);
      return groups;
    }, {});

    const openRecordDetail = (record) => {
      setSelectedRecord(record);
      setShowModal(true);
    };

    const closeModal = () => {
      setShowModal(false);
      setSelectedRecord(null);
    };

    const printRecord = (patient) => {
      if (!patient) {
        Swal.fire({
          icon: "info",
          title: "No Record",
          text: "No medical record available to print",
          confirmButtonColor: "#0ea5e9",
        });
        return;
      }

      let age = "N/A";
      if (patient.birth_date && patient.appointment_date) {
        const birth = new Date(patient.birth_date);
        const appointmentDateForAge = new Date(patient.appointment_date);
        let years = appointmentDateForAge.getFullYear() - birth.getFullYear();
        let months = appointmentDateForAge.getMonth() - birth.getMonth();

        if (
          months < 0 ||
          (months === 0 && appointmentDateForAge.getDate() < birth.getDate())
        ) {
          years--;
          months += 12;
        }
        if (appointmentDateForAge.getDate() < birth.getDate()) {
          months--;
          if (months < 0) {
            months += 12;
            years--;
          }
        }

        if (years < 2) {
          const totalMonths = years * 12 + months;
          age = `${totalMonths} ${totalMonths === 1 ? "month" : "months"}`;
        } else {
          if (months === 0) {
            age = `${years} ${years === 1 ? "yr" : "yrs"}`;
          } else {
            age = `${years} ${years === 1 ? "yr" : "yrs"} ${months} ${
              months === 1 ? "month" : "months"
            }`;
          }
        }
      }

      const appointmentDate = patient.appointment_date
        ? new Date(patient.appointment_date).toLocaleDateString()
        : "N/A";
      const appointmentTime = patient.appointment_time || "N/A";
      const appointmentType = patient.appointment_type || "N/A";

      const printWindow = window.open("", "_blank");
      printWindow.document.write(`
    <html>
    <head>
        <title>Patient Record - ${patient.full_name}</title>
        <style>
        body {
            font-family: Arial, sans-serif;
            padding: 30px;
            line-height: 1.6;
            color: #333;
        }
        h2 {
            color: #2563eb;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 5px;
        }
        p {
            margin: 6px 0;
        }
        .field {
            margin-bottom: 10px;
        }
        .label {
            font-weight: bold;
            color: #1e3a8a;
        }
        button {
            margin-top: 20px;
            padding: 8px 16px;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
        }
        button:hover {
            background: #1d4ed8;
        }
        .section {
            margin-bottom: 20px;
        }
        </style>
    </head>
    <body>
        <h2>Appointment Details</h2>
        <div class="section">
        <p class="field"><span class="label">Appointment Type:</span> ${appointmentType}</p>
        <p class="field"><span class="label">Date:</span> ${appointmentDate}</p>
        <p class="field"><span class="label">Time:</span> ${appointmentTime}</p>
        ${
          patient.status === "canceled" && patient.cancel_remarks
            ? `<p class="field"><span class="label">Cancellation Reason:</span> ${patient.cancel_remarks}</p>`
            : ""
        }
        </div>

        <h2>Medical Record</h2>
        <div class="section">
        <p class="field"><span class="label">Full Name:</span> ${
          patient.full_name
        }</p>
        <p class="field"><span class="label">Age:</span> ${age}</p>
        <p class="field"><span class="label">Temperature:</span> ${
          patient.temperature || "N/A"
        }</p>
        <p class="field"><span class="label">Pulse Rate:</span> ${
          patient.pulse_rate || "N/A"
        }</p>
        <p class="field"><span class="label">Height:</span> ${
          patient.height || "N/A"
        }</p>
        <p class="field"><span class="label">Weight:</span> ${
          patient.weight || "N/A"
        }</p>
        <p class="field"><span class="label">Diagnosis:</span> ${
          patient.diagnosis || "N/A"
        }</p>
        <p class="field"><span class="label">Remarks:</span> ${
          patient.remarks || "N/A"
        }</p>
        </div>

        <button onclick="window.print()">Print this page</button>
    </body>
    </html>
  `);
      printWindow.document.close();
    };

    const availableAdditionalServices = Object.keys(appointmentTypes).filter(
      (type) => type !== appointmentType
    );

    const filteredAppointments = appointments.filter((appt) => {
      const status = appt.status?.toLowerCase().trim();
      return filterStatus === "all" ? true : status === filterStatus;
    });

    const handleCancelAppointment = async (appointmentId) => {
      const reasonResult = await Swal.fire({
        title: "Reason for cancellation",
        input: "text",
        inputPlaceholder: "Please enter a reason (required)",
        showCancelButton: true,
        confirmButtonColor: "#EF4444",
        cancelButtonColor: "#0EA5E9",
        confirmButtonText: "Submit",
        cancelButtonText: "Keep appointment",
        inputValidator: (value) => {
          if (!value || !value.trim()) {
            return "Please provide a reason for cancelling";
          }
          return null;
        },
      });

      if (!reasonResult.isConfirmed) return;

      const cancelReason = reasonResult.value;

      try {
        const token = localStorage.getItem("token");
        const response = await fetch(
          `${
            import.meta.env.VITE_API_URL
          }/appointments/${appointmentId}/cancel`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ cancel_remarks: cancelReason }),
          }
        );

        const data = await response.json();

        if (response.ok) {
          await Swal.fire({
            icon: "success",
            title: "Canceled!",
            text: data.message,
            confirmButtonColor: "#0EA5E9",
          });

          window.location.reload();
        } else {
          Swal.fire({
            icon: "error",
            title: "Failed",
            text: data.error || "Failed to cancel appointment",
            confirmButtonColor: "#0EA5E9",
          });
        }
      } catch (error) {
        console.error("Error canceling appointment:", error);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Failed to cancel appointment",
          confirmButtonColor: "#0EA5E9",
        });
      }
    };

    const handleAvailVaccine = async (appt) => {
      const defaultVaccine = appt.vaccination_type || "";
      const today = new Date().toISOString().split("T")[0];

      const { value: formValues } = await Swal.fire({
        title: "Record Vaccination",
        html:
          `<input id="swal-vaccine" class="swal2-input" placeholder="Vaccine name" value="${defaultVaccine}">` +
          `<select id="swal-dose" class="swal2-select mt-2" style="display:block;margin:8px auto;padding:8px;border-radius:8px;border:1px solid #e5e7eb;">` +
          `<option value="1">1st Dose</option>` +
          `<option value="2">2nd Dose</option>` +
          `<option value="3">3rd Dose</option>` +
          `<option value="4">Booster 1</option>` +
          `<option value="5">Booster 2</option>` +
          `<option value="6">Booster 3</option>` +
          `</select>` +
          `<input id="swal-date" type="date" class="swal2-input" value="${today}">`,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: "Save",
        cancelButtonText: "Cancel",
        preConfirm: () => {
          const vaccine = document.getElementById("swal-vaccine").value;
          const dose = document.getElementById("swal-dose").value;
          const date = document.getElementById("swal-date").value;
          if (!vaccine || !vaccine.trim()) {
            Swal.showValidationMessage("Please enter vaccine name");
            return null;
          }
          return { vaccine: vaccine.trim(), dose: Number(dose), date };
        },
      });

      if (!formValues) return;

      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/appointments/${
            appt.appointment_id
          }/complete-vaccination`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              vaccine_name: formValues.vaccine,
              dose_number: formValues.dose,
              date_given: formValues.date || new Date().toISOString(),
            }),
          }
        );

        const data = await res.json();
        if (res.ok) {
          await Swal.fire({
            icon: "success",
            title: "Saved",
            text: data.message || "Vaccination recorded",
            confirmButtonColor: "#0EA5E9",
          });
          window.location.reload();
        } else {
          Swal.fire({
            icon: "error",
            title: "Failed",
            text: data.error || "Failed to save vaccination",
            confirmButtonColor: "#0EA5E9",
          });
        }
      } catch (err) {
        console.error("Error saving vaccination:", err);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Failed to save vaccination",
          confirmButtonColor: "#0EA5E9",
        });
      }
    };

    return (
      <div>
        {/* ==================== MEDICAL RECORDS SECTION ==================== */}
        <div className="bg-gradient-to-br from-blue-100 to-yellow-50 rounded-3xl p-6 shadow-2xl border-2 border-blue-200 hover:shadow-2xl transition-all mt-14">
          <div className="mb-3 pb-2 border-b border-blue-100">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-extrabold text-blue-900 flex items-center gap-3">
                <FileText className="w-7 h-7 text-yellow-500" />
                Medical Records
              </h3>
            </div>

            {/* compact blue bar holding Import / Refresh */}
            <div className="mt-3 flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-md w-max">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(true);
                  setImportError(null);
                }}
                className="px-3 py-1 text-xs bg-yellow-400 text-white border border-yellow-500 rounded hover:bg-yellow-500 flex items-center gap-2"
              >
                <FileText className="w-4 h-4 text-white" />
                <span>Import</span>
              </button>

              <button
                onClick={fetchPatientRecords}
                className="px-3 py-1 text-xs bg-blue-500 text-white border border-blue-600 rounded hover:bg-blue-600 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4 text-white" />
                <span>Refresh</span>
              </button>
            </div>
          </div>
          {medicalLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-400 mx-auto mb-6"></div>
              <p className="text-blue-700 text-lg font-semibold">
                Loading your medical records...
              </p>
            </div>
          ) : medicalError ? (
            <div className="text-center p-12 bg-red-50 rounded-2xl border-2 border-red-200">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
              <h3 className="text-2xl font-bold text-red-800 mb-3">
                Unable to Load Records
              </h3>
              <p className="text-red-700 mb-6">{medicalError}</p>
              <button
                onClick={fetchPatientRecords}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="inline w-5 h-5 mr-2" /> Retry
              </button>
            </div>
          ) : medicalRecords.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl shadow-lg border-l-8 border-yellow-400">
              <FileText className="w-20 h-20 text-blue-300 mx-auto mb-6" />
              <h3 className="text-2xl font-bold text-blue-900 mb-3">
                No Medical Records Found
              </h3>
              <p className="text-blue-700 max-w-lg mx-auto text-base">
                Your medical records will appear here after your appointments
                are completed and reviewed by the doctor.
              </p>
            </div>
          ) : (
            <div className="space-y-8 max-h-[60vh] overflow-auto pr-2">
              {Object.keys(groupedRecords).map((type) => (
                <div
                  key={type}
                  className="bg-gradient-to-br from-yellow-50 to-blue-50 rounded-2xl shadow-md border-2 border-yellow-300 overflow-hidden"
                >
                  <div
                    onClick={() =>
                      setOpenFolder(openFolder === type ? null : type)
                    }
                    className="flex items-center justify-between p-3 bg-yellow-100 cursor-pointer hover:bg-yellow-200 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-yellow-600" />
                      <h3 className="text-base font-semibold text-blue-900">
                        {type}
                      </h3>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-blue-600 transform transition-transform duration-300 ${
                        openFolder === type ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                  {openFolder === type && (
                    <div className="p-2 bg-yellow-50 transition-all duration-300">
                      <ul className="divide-y divide-yellow-100">
                        {groupedRecords[type].map((record) => (
                          <li
                            key={record.record_id || record.appointment_id}
                            className="py-2 px-2 flex items-center justify-between cursor-pointer hover:bg-yellow-100"
                            onClick={() => openRecordDetail(record)}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 bg-yellow-200 rounded-full flex items-center justify-center text-yellow-700 text-sm flex-shrink-0">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-blue-900 truncate">
                                  {record.diagnosis || "General Checkup"}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 ml-4 text-sm text-blue-600 whitespace-nowrap">
                              <div>
                                {record.appointment_date}
                                {record.appointment_time
                                  ? ` • ${record.appointment_time}`
                                  : ""}
                              </div>
                              <Eye className="w-4 h-4 text-blue-400" />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {showModal && selectedRecord && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/30">
            <div className="bg-white rounded-3xl shadow-2xl w-11/12 max-w-2xl md:max-w-3xl max-h-[85vh] overflow-y-auto mx-auto">
              {/* Modern Header with Gradient */}
              <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-6 md:px-8 py-8 text-white rounded-t-3xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-3 rounded-full">
                      <FileText className="w-6 h-6 md:w-7 md:h-7" />
                    </div>
                    <div>
                      <h2 className="text-2xl md:text-3xl font-bold">
                        Medical Record
                      </h2>
                      <p className="text-blue-100 text-sm md:text-base">
                        {selectedRecord.appointment_type}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={closeModal}
                    className="p-2 hover:bg-white/20 rounded-full transition-colors text-2xl"
                  >
                    ×
                  </button>
                </div>
                <div className="bg-white/10 px-4 py-2 rounded-lg inline-block">
                  <p className="text-sm md:text-base">
                    📅{" "}
                    {new Date(
                      selectedRecord.appointment_date
                    ).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 md:p-8 space-y-8">
                {/* Patient Information Card */}
                <div className="bg-gradient-to-br from-blue-50 to-sky-50 rounded-2xl p-6 border border-blue-200 shadow-sm">
                  <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                      👤
                    </div>
                    Patient Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-blue-600 font-semibold mb-1">
                        Full Name
                      </p>
                      <p className="text-lg font-bold text-blue-900">
                        {selectedRecord.full_name || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-blue-600 font-semibold mb-1">
                        Age (at appointment)
                      </p>
                      <p className="text-lg font-bold text-blue-900">
                        {selectedRecord.birth_date
                          ? (() => {
                              const birthDate = new Date(
                                selectedRecord.birth_date
                              );
                              const appointmentDate =
                                selectedRecord.appointment_date
                                  ? new Date(selectedRecord.appointment_date)
                                  : new Date();
                              let years =
                                appointmentDate.getFullYear() -
                                birthDate.getFullYear();
                              let months =
                                appointmentDate.getMonth() -
                                birthDate.getMonth();
                              if (
                                months < 0 ||
                                (months === 0 &&
                                  appointmentDate.getDate() <
                                    birthDate.getDate())
                              ) {
                                years--;
                                months += 12;
                              }
                              if (
                                appointmentDate.getDate() < birthDate.getDate()
                              ) {
                                months--;
                                if (months < 0) {
                                  months += 12;
                                  years--;
                                }
                              }
                              if (years < 2) {
                                const totalMonths = years * 12 + months;
                                return `${totalMonths} ${
                                  totalMonths === 1 ? "month" : "months"
                                }`;
                              }
                              if (months === 0) {
                                return `${years} ${years === 1 ? "yr" : "yrs"}`;
                              }
                              return `${years} ${
                                years === 1 ? "yr" : "yrs"
                              } ${months} ${months === 1 ? "month" : "months"}`;
                            })()
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Vital Signs Section */}
                <div>
                  <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                    <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                      ❤️
                    </div>
                    Vital Signs
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Temperature */}
                    <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-5 border-2 border-orange-200 shadow-sm hover:shadow-md transition-shadow">
                      <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-2">
                        Temperature
                      </p>
                      <p className="text-3xl font-bold text-orange-600">
                        {selectedRecord.temperature ? (
                          <>
                            {selectedRecord.temperature}
                            <span className="text-lg">°C</span>
                          </>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </p>
                      {selectedRecord.temperature && (
                        <p className="text-xs text-orange-600 mt-2">
                          {selectedRecord.temperature > 37.5
                            ? "🔴 Elevated"
                            : "✅ Normal"}
                        </p>
                      )}
                    </div>

                    {/* Pulse Rate */}
                    <div className="bg-gradient-to-br from-pink-50 to-red-50 rounded-xl p-5 border-2 border-pink-200 shadow-sm hover:shadow-md transition-shadow">
                      <p className="text-xs font-semibold text-pink-700 uppercase tracking-wide mb-2">
                        Pulse Rate
                      </p>
                      <p className="text-3xl font-bold text-pink-600">
                        {selectedRecord.pulse_rate ? (
                          <>
                            {selectedRecord.pulse_rate}
                            <span className="text-lg">bpm</span>
                          </>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </p>
                      {selectedRecord.pulse_rate && (
                        <p className="text-xs text-pink-600 mt-2">
                          {selectedRecord.pulse_rate < 60 ||
                          selectedRecord.pulse_rate > 100
                            ? "⚠️ Irregular"
                            : "✅ Regular"}
                        </p>
                      )}
                    </div>

                    {/* Weight */}
                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-5 border-2 border-blue-200 shadow-sm hover:shadow-md transition-shadow">
                      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">
                        Weight
                      </p>
                      <p className="text-3xl font-bold text-blue-600">
                        {selectedRecord.weight ? (
                          <>
                            {selectedRecord.weight}
                            <span className="text-lg">kg</span>
                          </>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </p>
                    </div>

                    {/* Height */}
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border-2 border-green-200 shadow-sm hover:shadow-md transition-shadow">
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">
                        Height
                      </p>
                      <p className="text-3xl font-bold text-green-600">
                        {selectedRecord.height ? (
                          <>
                            {selectedRecord.height}
                            <span className="text-lg">cm</span>
                          </>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* BMI Section */}
                {selectedRecord.weight && selectedRecord.height && (
                  <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl p-6 border-2 border-yellow-200 shadow-sm">
                    <h3 className="text-lg font-bold text-yellow-900 mb-4 flex items-center gap-2">
                      <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        📊
                      </div>
                      Body Mass Index (BMI)
                    </h3>
                    <div className="flex items-end gap-6">
                      <div>
                        <p className="text-5xl font-bold text-yellow-600">
                          {(
                            selectedRecord.weight /
                            ((selectedRecord.height / 100) *
                              (selectedRecord.height / 100))
                          ).toFixed(1)}
                        </p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-yellow-700">
                          {(() => {
                            const bmi =
                              selectedRecord.weight /
                              ((selectedRecord.height / 100) *
                                (selectedRecord.height / 100));
                            if (bmi < 18.5) return "Underweight";
                            if (bmi < 25) return "Normal";
                            if (bmi < 30) return "Overweight";
                            return "Obese";
                          })()}
                        </p>
                        <p className="text-sm text-yellow-600 mt-2">
                          Classification
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Clinical Assessment */}
                <div className="space-y-4">
                  {/* Diagnosis */}
                  <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-6 border-l-4 border-purple-500 shadow-sm">
                    <h3 className="text-lg font-bold text-purple-900 mb-3 flex items-center gap-2">
                      <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        🔍
                      </div>
                      Diagnosis
                    </h3>
                    <p className="text-blue-900 leading-relaxed">
                      {selectedRecord.diagnosis || "No diagnosis recorded"}
                    </p>
                  </div>

                  {/* Treatment & Remarks */}
                  {selectedRecord.remarks && (
                    <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-2xl p-6 border-l-4 border-teal-500 shadow-sm">
                      <h3 className="text-lg font-bold text-teal-900 mb-3 flex items-center gap-2">
                        <div className="w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          💊
                        </div>
                        Treatment & Remarks
                      </h3>
                      <p className="text-blue-900 leading-relaxed whitespace-pre-wrap">
                        {selectedRecord.remarks}
                      </p>
                    </div>
                  )}
                </div>

                {/* Appointment Info */}
                <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-2xl p-6 border border-gray-200 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                      📅
                    </div>
                    Appointment Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <p className="text-sm text-gray-600 font-semibold mb-2">
                        Date
                      </p>
                      <p className="text-lg font-bold text-gray-900">
                        {selectedRecord.appointment_date}
                      </p>
                    </div>
                    {selectedRecord.appointment_time && (
                      <div>
                        <p className="text-sm text-gray-600 font-semibold mb-2">
                          Time
                        </p>
                        <p className="text-lg font-bold text-gray-900">
                          {selectedRecord.appointment_time}
                        </p>
                      </div>
                    )}
                    {selectedRecord.updated_at && (
                      <div>
                        <p className="text-sm text-gray-600 font-semibold mb-2">
                          Last Updated
                        </p>
                        <p className="text-lg font-bold text-gray-900">
                          {new Date(
                            selectedRecord.updated_at
                          ).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                  {selectedRecord.status === "canceled" &&
                    selectedRecord.cancel_remarks && (
                      <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                        <p className="text-sm text-red-700">
                          <strong>Cancellation Reason:</strong>{" "}
                          {selectedRecord.cancel_remarks}
                        </p>
                      </div>
                    )}
                </div>
              </div>

              {/* Modern Footer */}
              <div className="bg-gradient-to-r from-gray-50 to-slate-50 px-6 md:px-8 py-6 border-t border-gray-200 rounded-b-3xl flex items-center justify-between flex-wrap gap-4">
                <p className="text-xs md:text-sm text-gray-600">
                  ⚠️ This is your official medical record. Keep this information
                  confidential.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => printRecord(selectedRecord)}
                    className="px-5 py-2 md:px-6 md:py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-all transform hover:scale-105 shadow-md"
                  >
                    🖨️ Print Record
                  </button>
                  <button
                    onClick={closeModal}
                    className="px-5 py-2 md:px-6 md:py-3 bg-gray-300 text-gray-900 font-semibold rounded-lg hover:bg-gray-400 transition-all transform hover:scale-105 shadow-md"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ✅ DAGDAGIN MO ITO - IMPORT MODAL */}
        {showImportModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border-t-8 border-blue-500">
              <div className="p-6 border-b border-blue-100">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-blue-900 flex items-center">
                    <FileText className="w-6 h-6 mr-2 text-blue-500" />
                    Import Medical Records
                  </h2>
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setImportMotherName("");
                      setImportFatherName("");
                      setImportResults([]);
                      setSelectedImportIds(new Set());
                      setImportError(null);
                    }}
                    className="text-blue-500 hover:text-yellow-500 text-2xl"
                  >
                    ×
                  </button>
                </div>
                <p className="text-sm text-blue-600 mt-1">
                  Enter your full name and either your mother&apos;s or
                  father&apos;s name to find your records.
                </p>
              </div>

              <div className="p-6 space-y-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-blue-900 mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={importFullName}
                        onChange={(e) => setImportFullName(e.target.value)}
                        disabled
                        placeholder="e.g., Juan Dela Cruz"
                        className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-blue-900 mb-1">
                        Mother&apos;s Name (optional)
                      </label>
                      <input
                        type="text"
                        value={importMotherName}
                        onChange={(e) => setImportMotherName(e.target.value)}
                        placeholder="e.g., Maria Dela Cruz"
                        className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-blue-900 mb-1">
                        Father&apos;s Name (optional)
                      </label>
                      <input
                        type="text"
                        value={importFatherName}
                        onChange={(e) => setImportFatherName(e.target.value)}
                        placeholder="e.g., Jose Dela Cruz"
                        className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      />
                    </div>
                  </div>
                  {importError && (
                    <p className="text-sm text-red-600 mt-3">{importError}</p>
                  )}
                  <div className="mt-4">
                    <button
                      disabled={importSearchLoading}
                      onClick={async () => {
                        setImportError(null);
                        if (
                          !importFullName.trim() ||
                          (!importMotherName.trim() && !importFatherName.trim())
                        ) {
                          Swal.fire({
                            icon: "warning",
                            title: "Missing Information",
                            text: "Please enter your full name and at least one parent name",
                            confirmButtonColor: "#0ea5e9",
                          });
                          return;
                        }
                        try {
                          setImportSearchLoading(true);
                          const token = localStorage.getItem("token");
                          const res = await fetch(
                            `${
                              import.meta.env.VITE_API_URL
                            }/patient/medical-records/import/search`,
                            {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${token}`,
                              },
                              body: JSON.stringify({
                                full_name: importFullName.trim(),
                                mother_name:
                                  importMotherName.trim() || undefined,
                                father_name:
                                  importFatherName.trim() || undefined,
                              }),
                            }
                          );
                          if (!res.ok) {
                            const data = await res.json().catch(() => ({}));
                            throw new Error(
                              data.error || `Search failed (${res.status})`
                            );
                          }
                          const data = await res.json();
                          setImportResults(Array.isArray(data) ? data : []);
                          setSelectedImportIds(new Set());
                        } catch (err) {
                          setImportError(
                            err.message || "Search failed. Please try again."
                          );
                        } finally {
                          setImportSearchLoading(false);
                        }
                      }}
                      className={`px-5 py-2 rounded-lg font-semibold ${
                        importSearchLoading
                          ? "bg-blue-300 text-white"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      } transition-colors`}
                    >
                      {importSearchLoading ? "Searching..." : "Search Records"}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-md font-semibold text-blue-900">
                    Search Results
                  </h3>
                  {importResults.length === 0 ? (
                    <div className="text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-lg p-3">
                      No records to display. Run a search to see results.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {importResults.map((rec) => {
                        const id =
                          rec.record_id || rec.appointment_id || rec.id;
                        const checked = selectedImportIds.has(id);
                        const isImported = rec.is_imported === true;
                        return (
                          <label
                            key={id}
                            className={`border rounded-lg p-4 transition-all ${
                              isImported
                                ? "bg-green-50 border-green-300 cursor-not-allowed opacity-75"
                                : checked
                                ? "border-yellow-400 bg-yellow-50 cursor-pointer hover:shadow"
                                : "border-blue-100 bg-white cursor-pointer hover:shadow"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={isImported}
                                onChange={(e) => {
                                  if (!isImported) {
                                    const next = new Set(selectedImportIds);
                                    if (e.target.checked) next.add(id);
                                    else next.delete(id);
                                    setSelectedImportIds(next);
                                  }
                                }}
                                className={`mt-1 w-5 h-5 text-yellow-400 border-blue-300 rounded focus:ring-yellow-400 ${
                                  isImported
                                    ? "opacity-50 cursor-not-allowed"
                                    : ""
                                }`}
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-sm font-bold text-yellow-700 uppercase">
                                    {rec.appointment_type || "Record"}
                                  </p>
                                  {isImported && (
                                    <span className="px-2 py-0.5 text-xs font-semibold bg-green-500 text-white rounded-full flex items-center gap-1">
                                      <CheckCircle className="w-3 h-3" />
                                      Imported
                                    </span>
                                  )}
                                </div>
                                <p className="text-blue-900 font-semibold">
                                  {rec.full_name || importFullName}
                                </p>
                                <p className="text-sm text-blue-700">
                                  Date:{" "}
                                  {rec.appointment_date || rec.date || "N/A"}
                                </p>
                                {rec.diagnosis && (
                                  <p className="text-sm text-blue-700">
                                    Diagnosis: {rec.diagnosis}
                                  </p>
                                )}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-blue-100 bg-blue-50 rounded-b-2xl flex items-center justify-between">
                <p className="text-xs text-blue-600">
                  Select the records you recognize as yours, then import them to
                  your account.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setImportMotherName("");
                      setImportFatherName("");
                      setImportResults([]);
                      setSelectedImportIds(new Set());
                      setImportError(null);
                    }}
                    className="px-5 py-2 bg-white border-2 border-blue-200 text-blue-900 font-semibold rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={selectedImportIds.size === 0 || importSubmitting}
                    onClick={async () => {
                      setImportError(null);
                      try {
                        setImportSubmitting(true);
                        const token = localStorage.getItem("token");

                        const importableIds = Array.from(
                          selectedImportIds
                        ).filter((id) => {
                          const rec = importResults.find(
                            (r) =>
                              (r.record_id || r.appointment_id || r.id) === id
                          );
                          return rec && !rec.is_imported;
                        });

                        if (importableIds.length === 0) {
                          Swal.fire({
                            icon: "warning",
                            title: "No Records Selected",
                            text: "Please select records that haven't been imported yet",
                            confirmButtonColor: "#0ea5e9",
                          });
                          setImportSubmitting(false);
                          return;
                        }

                        const res = await fetch(
                          `${
                            import.meta.env.VITE_API_URL
                          }/patient/medical-records/import`,
                          {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({
                              record_ids: importableIds,
                            }),
                          }
                        );

                        if (!res.ok) {
                          const data = await res.json().catch(() => ({}));
                          throw new Error(
                            data.error || `Import failed (${res.status})`
                          );
                        }

                        Swal.fire({
                          icon: "success",
                          title: "Import Successful!",
                          text: `Successfully imported ${importableIds.length} record(s)`,
                          confirmButtonColor: "#0ea5e9",
                          timer: 2000,
                          showConfirmButton: false,
                        });

                        setShowImportModal(false);
                        setImportMotherName("");
                        setImportFatherName("");
                        setImportResults([]);
                        setSelectedImportIds(new Set());
                        await fetchPatientRecords();
                      } catch (err) {
                        Swal.fire({
                          icon: "error",
                          title: "Import Failed",
                          text:
                            err.message || "Import failed. Please try again.",
                          confirmButtonColor: "#0ea5e9",
                        });
                      } finally {
                        setImportSubmitting(false);
                      }
                    }}
                    className={`px-5 py-2 rounded-lg font-semibold ${
                      selectedImportIds.size === 0 || importSubmitting
                        ? "bg-yellow-300 text-blue-900"
                        : "bg-yellow-500 text-blue-900 hover:bg-yellow-400"
                    } transition-colors`}
                  >
                    {importSubmitting ? "Importing..." : "Import Selected"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };
  const Notifications = () => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch notifications
    const fetchNotifications = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/notifications/patient`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) throw new Error("Failed to fetch notifications");

        const data = await response.json();
        setNotifications(data);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching notifications:", err);
        setError(err.message);
        setLoading(false);
      }
    };
    // Inside Notifications component
    useEffect(() => {
      fetchNotifications();

      setNotificationCount(0);

      // Auto-refresh every 10 seconds (faster for testing)
      const interval = setInterval(fetchNotifications, 10000);

      // 🔔 Listen for status changes
      const handleRefresh = () => {
        console.log("🔔 Notification refresh triggered!");
        fetchNotifications();
      };
      window.addEventListener("refreshNotifications", handleRefresh);

      return () => {
        clearInterval(interval);
        window.removeEventListener("refreshNotifications", handleRefresh);
      };
    }, []);

    // Format date nicely
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60)
        return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;

      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24)
        return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;

      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    // Get icon and color based on status
    const getStatusConfig = (status) => {
      const statusLower = status?.toLowerCase();
      if (statusLower === "approved") {
        return {
          icon: <CheckCircle className="w-6 h-6 text-green-600" />,
          bgColor: "bg-green-50",
          borderColor: "border-green-400",
          badgeColor: "bg-green-100 text-green-700",
          title: "Appointment Approved! ✅",
        };
      } else if (statusLower === "completed") {
        return {
          icon: <CheckCircle className="w-6 h-6 text-blue-600" />,
          bgColor: "bg-blue-50",
          borderColor: "border-blue-400",
          badgeColor: "bg-blue-100 text-blue-700",
          title: "Appointment Completed 🎉",
        };
      } else if (statusLower === "canceled") {
        return {
          icon: <AlertCircle className="w-6 h-6 text-red-600" />,
          bgColor: "bg-red-50",
          borderColor: "border-red-400",
          badgeColor: "bg-red-100 text-red-700",
          title: "Appointment Canceled ❌",
        };
      }
      return {
        icon: <Bell className="w-6 h-6 text-gray-600" />,
        bgColor: "bg-gray-50",
        borderColor: "border-gray-400",
        badgeColor: "bg-gray-100 text-gray-700",
        title: "Notification",
      };
    };

    if (loading) {
      return (
        <div className="h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-sky-500 mx-auto mb-3"></div>
            <p className="text-sky-700 text-sm font-semibold">
              Loading notifications…
            </p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="h-screen flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full border-l-4 border-red-500">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-gray-800 text-center mb-2">
              Error
            </h2>
            <p className="text-gray-600 text-center text-sm mb-4">{error}</p>
            <button
              onClick={fetchNotifications}
              className="w-full bg-sky-500 text-white py-1 text-sm rounded hover:bg-sky-600 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="h-screen bg-transparent p-6 md:p-14 flex items-start justify-center overflow-hidden">
        <div className="w-full max-w-3xl flex flex-col h-full">
          {/* Header */}
          <div className="mb-6 text-center flex-shrink-0">
            <div className="inline-flex items-center gap-3 mb-3">
              <div className="p-3 bg-gradient-to-br from-sky-100 to-blue-100 rounded-full">
                <Bell className="w-6 h-6 text-sky-700" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                Notifications
              </h1>
            </div>
            <p className="text-sm text-gray-600">
              You have{" "}
              <span className="font-semibold text-sky-700">
                {notifications.length}
              </span>{" "}
              notification{notifications.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Notifications Container */}
          {notifications.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-md p-12 text-center border border-sky-100">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">
                All Caught Up!
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                You have no new notifications right now.
              </p>
              <button
                onClick={fetchNotifications}
                className="px-4 py-2 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600 transition-colors"
              >
                Check Again
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-4">
                {notifications.map((notif) => {
                  const config = getStatusConfig(notif.status);
                  return (
                    <div
                      key={notif.appointment_id}
                      className="bg-white rounded-xl border border-sky-100 p-4 hover:shadow-lg transition-all hover:border-sky-300 cursor-default flex-shrink-0"
                    >
                      <div className="flex gap-4">
                        {/* Status Icon */}
                        <div className="flex-shrink-0">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${config.bgColor}`}
                          >
                            {config.icon}
                          </div>
                        </div>

                        {/* Main Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className="text-sm font-bold text-gray-900">
                              {config.title}
                            </h3>
                            <span
                              className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${config.badgeColor}`}
                            >
                              {notif.status}
                            </span>
                          </div>

                          <p className="text-xs text-sky-600 font-medium mb-1">
                            {notif.appointment_type}
                            {notif.vaccination_type && (
                              <span className="text-gray-600 ml-1">
                                • {notif.vaccination_type}
                              </span>
                            )}
                          </p>

                          <div className="flex items-center gap-3 text-xs text-gray-600 mb-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-sky-500" />
                              {new Date(
                                notif.appointment_date
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                            <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-sky-500" />
                              {notif.appointment_time}
                            </span>
                          </div>

                          {notif.status?.toLowerCase() === "canceled" &&
                            notif.cancel_remarks && (
                              <div className="mt-2 p-2 bg-red-50 rounded-lg border border-red-200">
                                <p className="text-xs text-red-700">
                                  <span className="font-semibold">Reason:</span>{" "}
                                  {notif.cancel_remarks}
                                </p>
                              </div>
                            )}
                        </div>

                        {/* Time Ago */}
                        <div className="flex-shrink-0 text-right">
                          <span className="text-xs text-gray-500 block">
                            {formatDate(notif.updated_at || notif.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Refresh Footer */}
              <div className="text-center flex-shrink-0">
                <button
                  onClick={fetchNotifications}
                  className="inline-flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-200 rounded-lg text-xs font-medium text-sky-700 hover:border-sky-400 hover:from-sky-100 hover:to-blue-100 transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh Notifications
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const menuItems = [
    { id: "home", label: "Home", icon: Home },
    { id: "appointments", label: "Medical Records", icon: FileText },
  ];
  const renderContent = () => {
    switch (activePage) {
      case "home":
        return (
          <Analysis
            onNavigateToAppointments={() => setActivePage("appointments")}
          />
        );

      case "appointments":
        return <AppointmentsPage />;

      case "checkup":
        return <MedicalRecords />;

      case "profile":
        return <PatientProfile />;

      case "notifications":
        return <Notifications />;

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-blue-50 to-pink-50">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Top Header (replaces sidebar) */}
      <header className="fixed top-0 left-0 right-0 bg-blue-800/80 text-white backdrop-blur-sm border-b border-blue-900 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white p-1.5 rounded-full">
              <img
                src="/clinicsclogo.png"
                alt="Clinic Logo"
                className="w-9 h-9 rounded-full object-cover"
              />
            </div>
            <div className="hidden sm:block">
              <h2 className="text-sm font-bold text-white">Castillo</h2>
              <p className="text-xs text-white/80">Children Clinic</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActivePage(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-md font-semibold transition ${
                    activePage === item.id
                      ? "bg-yellow-400 text-sky-900"
                      : "text-white hover:bg-yellow-400 hover:text-sky-900"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      activePage === item.id ? "text-sky-900" : "text-white"
                    }`}
                  />
                  <span className="text-sm">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setActivePage("notifications");
                localStorage.setItem(
                  "lastNotificationView",
                  new Date().toISOString()
                );
                setNotificationCount(0);
              }}
              className="relative p-2 rounded-md hover:bg-sky-50"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 text-white" />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {notificationCount}
                </span>
              )}
            </button>

            <div className="relative">
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className={`group flex items-center gap-2 px-3 py-1 rounded-md transition ${
                  activePage === "profile"
                    ? "bg-yellow-400 text-sky-900"
                    : "hover:bg-yellow-400 hover:text-sky-900"
                }`}
              >
                <User
                  className={`w-5 h-5 ${
                    activePage === "profile" ? "text-sky-900" : "text-white"
                  } group-hover:text-sky-900`}
                />
                <span
                  className={`text-sm font-semibold max-w-[10rem] truncate ${
                    activePage === "profile" ? "text-sky-900" : "text-white"
                  } group-hover:text-sky-900`}
                >
                  {patientName}
                </span>
                <ChevronDown
                  className={`w-4 h-4 ${
                    activePage === "profile" ? "text-sky-900" : "text-white"
                  } group-hover:text-sky-900`}
                />
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-white border rounded-md shadow-md py-1">
                  <button
                    onClick={() => {
                      setActivePage("profile");
                      setProfileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-sky-700 hover:bg-sky-50"
                  >
                    My Profile
                  </button>
                  <button
                    onClick={() => handleLogout()}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>

            <button
              className="md:hidden p-2 rounded-md"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6 text-sky-700" />
              ) : (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M4 6h16M4 12h16M4 18h16"></path>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile slide-down menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-sky-100">
            <div className="px-4 py-3 space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActivePage(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md ${
                      activePage === item.id
                        ? "bg-yellow-400 text-sky-900"
                        : "text-white hover:bg-yellow-400 hover:text-sky-900"
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${
                        activePage === item.id ? "text-sky-900" : "text-white"
                      }`}
                    />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Mobile Header with Hamburger */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-gradient-to-b from-blue-600 to-blue-800 text-white p-3 sm:p-4 flex items-center justify-between z-40 shadow-lg">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="bg-white bg-opacity-20 p-1.5 sm:p-2 rounded-full flex items-center justify-center shadow-md">
            <img
              src="/clinicsclogo.png"
              alt="Clinic Logo"
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover"
            />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold">Castillo</h2>
            <p className="text-blue-200 text-xs">Children Clinic</p>
          </div>
        </div>

        {/* Notification + Hamburger Container */}
        <div className="flex items-center gap-3">
          {/* Notification Bell */}
          <button
            onClick={() => {
              setActivePage("notifications");
              setIsMobileMenuOpen(false);
              localStorage.setItem(
                "lastNotificationView",
                new Date().toISOString()
              );
              setNotificationCount(0);
            }}
            className="relative p-2 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Bell className="w-5 h-5 text-white" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
                {notificationCount}
              </span>
            )}
          </button>

          {/* Hamburger Menu */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-blue-700 transition"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <svg
                className="w-6 h-6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M4 6h16M4 12h16M4 18h16"></path>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div
        className="flex-1 p-4 sm:p-6 md:p-8 bg-cover bg-center bg-fixed overflow-y-auto relative pt-24"
        style={{ backgroundImage: "url('/doctor.png')" }}
      >
        {renderContent()}
      </div>
    </div>
  );
}

export default Patient;