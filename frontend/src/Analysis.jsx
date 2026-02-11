import { useEffect, useState } from "react";
import {
  CalendarDays,
  Stethoscope,
  Syringe,
  UserPlus,
  HeartPulse,
  User,
  Clock,
  CheckCircle,
  ClipboardList,
  ChevronDown,
  AlertCircle,
} from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Swal from "sweetalert2";

function PatientDashboard({ onNavigateToAppointments }) {
  const [userInfo, setUserInfo] = useState(null);
  const [appointment, setAppointment] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingDate, setBookingDate] = useState(null);
  const [bookingType, setBookingType] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [showAppointmentRecords, setShowAppointmentRecords] = useState(false);
  const [recordFilter, setRecordFilter] = useState("All");
  const [cancellingIds, setCancellingIds] = useState([]);
  const [availableVaccines, setAvailableVaccines] = useState([]);
  const [vaccinesLoading, setVaccinesLoading] = useState(false);
  const [additionalServices, setAdditionalServices] = useState([]);
  const [patientConcerns, setPatientConcerns] = useState("");
  const [selectedVaccine, setSelectedVaccine] = useState(null);

  // States & helpers copied/adapted from Patient booking UI
  const [appointmentType, setAppointmentType] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [calendarSlots, setCalendarSlots] = useState({});
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [vaccinationType, setVaccinationType] = useState("");

  const appointmentTypes = [
    "Vaccination",
    "Check-up",
    "Ear Piercing",
    "Follow-up Check-up",
    "Consultation",
  ];

  // durations in minutes
  const appointmentDurations = {
    Vaccination: 30,
    "Check-up": 60,
    "Ear Piercing": 5,
    "Follow-up Check-up": 20,
    Consultation: 30,
  };

  const appointmentTypesMap = {
    Vaccination: 30,
    "Check-up": 60,
    "Ear Piercing": 5,
    "Follow-up Check-up": 20,
    Consultation: 30,
  };

  const clinicHours = { start: 9, end: 16 };

  const timeStringToMinutes = (timeStr) => {
    const [time, period] = timeStr.split(" ");
    let [hours, minutes] = time.split(":").map(Number);
    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  const minutesToTimeString = (minutes) => {
    let hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${mins.toString().padStart(2, "0")} ${ampm}`;
  };

  const formatSlot = (startMinutes, duration) => {
    const end = startMinutes + duration;
    return `${minutesToTimeString(startMinutes)} - ${minutesToTimeString(end)}`;
  };

  const isSameCalendarDay = (a, b) => {
    const da = new Date(a);
    const db = new Date(b);
    if (Number.isNaN(da) || Number.isNaN(db)) return false;
    return (
      da.getFullYear() === db.getFullYear() &&
      da.getMonth() === db.getMonth() &&
      da.getDate() === db.getDate()
    );
  };

  const fetchAppointments = async () => {
    try {
      setLoadingAppointments(true);
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/get/appointments`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setAppointments(data || []);
      }
    } catch (err) {
      console.error("Error fetching appointments:", err);
    } finally {
      setLoadingAppointments(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const filteredAppointments = appointments.filter((appt) => {
    if (!recordFilter || recordFilter === "All") return true;
    const statusLower = String(appt.status || "").toLowerCase();
    switch (recordFilter) {
      case "Pending":
        return statusLower === "pending";
      case "Approved":
        return statusLower === "approved";
      case "Completed":
        return statusLower === "completed";
      case "Cancelled":
        return statusLower === "cancelled" || statusLower === "canceled";
      default:
        return true;
    }
  });

  const isCancelling = (id) => cancellingIds.includes(id);

  const handleCancelAppointment = async (appointmentId) => {
    if (!appointmentId) return;

    // Ask for cancellation reason first (required by backend)
    const reasonResult = await Swal.fire({
      title: "Cancel appointment",
      input: "textarea",
      inputLabel: "Please provide a reason for cancelling this appointment:",
      inputPlaceholder: "Type the cancellation reason here...",
      inputAttributes: {
        "aria-label": "Cancellation reason",
      },
      showCancelButton: true,
      confirmButtonText: "Submit and Cancel",
      cancelButtonText: "Keep Appointment",
      preConfirm: (value) => {
        if (!value || !value.trim()) {
          Swal.showValidationMessage("Cancellation reason is required");
        }
        return value && value.trim();
      },
    });

    if (!reasonResult.isConfirmed) return;
    const cancelReason = String(reasonResult.value || "").trim();

    try {
      setCancellingIds((s) => [...s, appointmentId]);
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/appointments/${appointmentId}/cancel`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ cancel_remarks: cancelReason }),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        // update local state to reflect cancellation (backend uses 'canceled')
        setAppointments((prev) =>
          prev.map((a) =>
            a.appointment_id === appointmentId
              ? { ...a, status: "canceled", cancel_remarks: cancelReason }
              : a
          )
        );
        Swal.fire({
          icon: "success",
          title: "Canceled",
          text: data.message || "Appointment canceled.",
          confirmButtonColor: "#0ea5e9",
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Cancel Failed",
          text: data.error || "Failed to cancel appointment.",
          confirmButtonColor: "#0ea5e9",
        });
      }
    } catch (err) {
      console.error("Error cancelling appointment:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to cancel appointment. Please try again.",
        confirmButtonColor: "#0ea5e9",
      });
    } finally {
      setCancellingIds((s) => s.filter((id) => id !== appointmentId));
    }
  };

  const hasConflict = (newStart, duration, date) => {
    if (!date) return false;
    const newEnd = newStart + duration;
    return appointments.some((appt) => {
      if (!isSameCalendarDay(appt.appointment_date, date)) return false;
      const status = String(appt.status || "").toLowerCase();
      if (status !== "approved" && status !== "pending") return false;
      if (!appt.appointment_time) return false;
      const [startStr] = appt.appointment_time.split(" - ");
      const existingStart = timeStringToMinutes(startStr);
      const existingEnd =
        existingStart + (appointmentDurations[appt.appointment_type] || 30);
      return newStart < existingEnd && existingStart < newEnd;
    });
  };

  const generateTimeSlots = (type, date) => {
    if (!type || !date) return [];
    const duration = appointmentDurations[type] || 30;
    const slots = [];
    const startMinutes = clinicHours.start * 60;
    const endMinutes = clinicHours.end * 60;
    for (let cur = startMinutes; cur + duration <= endMinutes; cur += 30) {
      const text = formatSlot(cur, duration);
      const available = !hasConflict(cur, duration, date);
      slots.push({ text, value: text, available, start: cur });
    }
    return slots;
  };

  const fetchAvailableVaccines = async () => {
    try {
      setVaccinesLoading(true);
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/patient/available-vaccines`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setAvailableVaccines(data.vaccines || []);
      }
    } catch (err) {
      console.error("Error fetching vaccines:", err);
    } finally {
      setVaccinesLoading(false);
    }
  };

  useEffect(() => {
    if (appointmentType === "Vaccination") fetchAvailableVaccines();
  }, [appointmentType]);

  // --- Booking helpers (calendar + slots) ---
  const formatDateDisplay = (dateString) => {
    if (!dateString) return "N/A";
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };
  const fetchMonthSlots = async (month) => {
    if (!appointmentType) return;
    try {
      setLoadingCalendar(true);
      const token = localStorage.getItem("token");

      // Create dates in local timezone to avoid UTC conversion issues
      const year = month.getFullYear();
      const monthIndex = month.getMonth();

      const firstDay = new Date(year, monthIndex, 1);
      const lastDay = new Date(year, monthIndex + 1, 0);

      // Format dates manually to avoid timezone issues
      const startDate = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
      const endDate = `${year}-${String(monthIndex + 1).padStart(
        2,
        "0"
      )}-${String(lastDay.getDate()).padStart(2, "0")}`;

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
        const slotsByDate = data.reduce((acc, slot) => {
          const date = slot.schedule_date;
          if (!acc[date]) acc[date] = [];
          acc[date].push(slot);
          return acc;
        }, {});
        setCalendarSlots(slotsByDate);
      }
    } catch (err) {
      console.error("Error fetching month slots:", err);
    } finally {
      setLoadingCalendar(false);
    }
  };

  useEffect(() => {
    if (appointmentType) fetchMonthSlots(selectedMonth);
    else setCalendarSlots({});
  }, [appointmentType, selectedMonth]);

  const getAvailableSlotCount = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;
    const slots = calendarSlots[dateStr] || [];
    return slots.reduce((sum, slot) => sum + (slot.available_slots || 0), 0);
  };

  const fetchAvailableSlots = async (date) => {
    if (!date) {
      setAvailableSlots([]);
      return;
    }
    try {
      setSlotsLoading(true);
      const token = localStorage.getItem("token");
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const dateString = `${year}-${month}-${day}`;
      const response = await fetch(
        `${
          import.meta.env.VITE_API_URL
        }/patient/available-slots?date=${dateString}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setAvailableSlots(data);
      } else {
        setAvailableSlots([]);
      }
    } catch (err) {
      console.error("Error fetching slots:", err);
      setAvailableSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDate && appointmentType) fetchAvailableSlots(selectedDate);
    else setAvailableSlots([]);
  }, [selectedDate, appointmentType]);

  const toggleAdditionalService = (type) => {
    if (additionalServices.includes(type)) {
      setAdditionalServices(additionalServices.filter((t) => t !== type));
    } else {
      setAdditionalServices([...additionalServices, type]);
    }
  };

  const handleSelectNone = () => setAdditionalServices([]);

  const handleBookAppointment = async () => {
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
      setBookingLoading(true);
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
        setShowBookingModal(false);
        fetchLatestApprovedAppointment();
        fetchAppointments();
      } else {
        Swal.fire({
          icon: "error",
          title: "Booking Failed",
          text: data.error || "Failed to book appointment",
          confirmButtonColor: "#0ea5e9",
        });
      }
    } catch (err) {
      console.error("Error booking appointment:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to book appointment. Please try again.",
        confirmButtonColor: "#0ea5e9",
      });
    } finally {
      setBookingLoading(false);
    }
  };

  useEffect(() => {
    fetchUserInfo();
    fetchLatestApprovedAppointment();
  }, []);

  // 🔹 Fetch patient profile
  const fetchUserInfo = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/patient/profile-data`,
        {
          headers: {
            Authorization: `Bearer ${
              window.localStorage.getItem("token") || ""
            }`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) throw new Error("Failed to fetch user info");
      const data = await res.json();
      setUserInfo(data);
    } catch (err) {
      console.error("❌ Error fetching user info:", err);
    }
  };

  // 🔹 Fetch the latest approved appointment directly
  const fetchLatestApprovedAppointment = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/appointments/latest-approved`,
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
        setAppointment(null);
        return;
      }

      const data = await res.json();
      setAppointment(data);
    } catch (err) {
      console.error("❌ Error fetching latest approved appointment:", err);
      setAppointment(null);
    }
  };

  const services = [
    {
      title: "Check-up",
      icon: <Stethoscope className="w-6 h-6 text-sky-500" />,
      desc: "Comprehensive health evaluations for children and teens.",
    },
    {
      title: "Vaccination",
      icon: <Syringe className="w-6 h-6 text-green-500" />,
      desc: "Essential immunizations to keep your child protected.",
    },
    {
      title: "Consultation",
      icon: <UserPlus className="w-6 h-6 text-yellow-500" />,
      desc: "Personalized medical advice from pediatric specialists.",
    },
    {
      title: "Ear Piercing",
      icon: <HeartPulse className="w-6 h-6 text-pink-500" />,
      desc: "Ensure a safe and comfortable ear piercing experience",
    },
  ];

  // small helper to pick an icon for the appointment type
  const getTypeIcon = (type) => {
    switch (type) {
      case "Vaccination":
        return <Syringe className="w-6 h-6 text-green-600" />;
      case "Check-up":
        return <Stethoscope className="w-6 h-6 text-sky-600" />;
      case "Ear Piercing":
        return <HeartPulse className="w-6 h-6 text-pink-600" />;
      case "Consultation":
      case "Follow-up Check-up":
        return <UserPlus className="w-6 h-6 text-yellow-600" />;
      default:
        return <CalendarDays className="w-6 h-6 text-sky-600" />;
    }
  };

  // Add this with other helper functions
  const formatTime12Hour = (time24) => {
    if (!time24) return "N/A";
    const [hours, minutes] = time24.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // ADD THIS NEW HELPER FUNCTION
  const formatTimeRange = (startTime, endTime) => {
    if (!startTime) return "N/A";

    // If end_time is null, calculate it (add 1 hour)
    let calculatedEndTime = endTime;
    if (!endTime || endTime === "N/A") {
      const [hours, minutes] = startTime.split(":");
      const endHour = parseInt(hours) + 1;
      calculatedEndTime = `${String(endHour).padStart(2, "0")}:${minutes}:00`;
    }

    return `${formatTime12Hour(startTime)} - ${formatTime12Hour(
      calculatedEndTime
    )}`;
  };

  return (
    <div>
      {/* Greeting Section - Hidden on mobile */}
      <div className="hidden md:block relative bg-white/60 border border-sky-100 p-4 rounded-2xl shadow-sm mb-6 overflow-hidden transition hover:shadow-md">
        <div className="relative z-10"></div>
        <div className="absolute right-6 bottom-0 opacity-10">
          <HeartPulse className="w-32 h-32 text-sky-400" />
        </div>
      </div>
      {/* Latest Approved Appointment Section (compact, tab-themed) */}
      <div className="bg-white/80 border-t-2 border-sky-400 shadow-sm rounded-2xl p-2 sm:p-3 mb-4 transition hover:shadow-md">
        {/* Header with Icon (compact) */}
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-gradient-to-br from-sky-600 to-sky-800 p-2 rounded-lg shadow-sm">
            <CalendarDays className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-sky-800">Appointment</h2>
            <p className="text-xs text-sky-600">
              Most recent confirmed booking
            </p>
          </div>
        </div>

        {appointment ? (
          <div className="space-y-2">
            <div className="bg-gradient-to-r from-sky-50 to-blue-50 border-l-4 border-sky-400 rounded-lg p-2 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="bg-sky-400 p-1 rounded-full">
                  <CalendarDays className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-xs text-sky-600 uppercase font-semibold">
                    Appointment ID
                  </p>
                  <p className="text-sm font-bold text-sky-900 tracking-wider">
                    {appointment.appointment_reference || "N/A"}
                  </p>
                </div>
              </div>
            </div>
            {/* Patient Name Card (smaller) */}
            <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-l-4 border-yellow-400 rounded-lg p-2 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="bg-yellow-400 p-1 rounded-full">
                  <User className="w-4 h-4 text-sky-900" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-900">
                    {userInfo?.full_name || "Loading..."}
                  </p>
                </div>
              </div>
            </div>

            {/* Compact appointment details grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white border border-sky-100 rounded-md p-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="bg-sky-100 p-1 rounded-md">
                    <CalendarDays className="w-4 h-4 text-sky-600" />
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 uppercase">Date</p>
                    <p className="text-sm text-gray-800">
                      {new Date(
                        appointment.appointment_date
                      ).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-sky-100 rounded-md p-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="bg-purple-100 p-1 rounded-md">
                    <Clock className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 uppercase">Time</p>
                    <p className="text-sm text-gray-800">
                      {appointment.appointment_time || "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-sky-100 rounded-md p-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="bg-green-100 p-1 rounded-md">
                    <Stethoscope className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 uppercase">
                      Service
                    </p>
                    <p className="text-sm text-gray-800">
                      {appointment.appointment_type}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-sky-100 rounded-md p-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="bg-emerald-100 p-1 rounded-md">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 uppercase">
                      Status
                    </p>
                    <p className="text-sm text-emerald-600 capitalize">
                      {appointment.status}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
              <CalendarDays className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-600 font-medium text-sm mb-2">
              No Approved Appointments
            </p>
            <p className="text-gray-500 text-xs mb-4">
              Your confirmed appointments will appear here.
            </p>
            <div>
              <button
                onClick={() => setShowBookingModal(true)}
                className="inline-flex items-center px-3 py-1 bg-yellow-400 text-sky-900 rounded-full font-semibold text-sm hover:bg-yellow-500 transition"
              >
                Book Appointment
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Appointment Records Section (collapsed by default) */}
      <div className="bg-white/80 border-t-2 border-sky-400 shadow-sm rounded-2xl p-2 sm:p-3 mb-4 transition hover:shadow-md">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-sky-600 to-sky-800 p-2 rounded-lg shadow-sm">
              <ClipboardList className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-sky-800">
                Appointment Records
              </h2>
              <p className="text-xs text-sky-600">
                All your past and upcoming appointments
              </p>
            </div>
          </div>
          <div>
            <button
              onClick={() => setShowAppointmentRecords((s) => !s)}
              className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-sky-100 text-sky-700 rounded-full hover:bg-sky-200"
            >
              {showAppointmentRecords ? "Hide Records" : "Show Records"}
            </button>
          </div>
        </div>

        {!showAppointmentRecords ? (
          <div className="text-center py-6">
            <p className="text-gray-600 font-medium mb-3">
              Click here to view your appointment records.
            </p>
          </div>
        ) : loadingAppointments ? (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
            <span className="ml-3 text-sky-600">Loading appointments...</span>
          </div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            No appointment records found.
          </div>
        ) : (
          <>
            {/* Filter bar */}
            <div className="mb-3">
              <div className="flex flex-wrap gap-2">
                {["All", "Pending", "Approved", "Completed", "Cancelled"].map(
                  (s) => (
                    <button
                      key={s}
                      onClick={() => setRecordFilter(s)}
                      className={`px-3 py-1 text-xs rounded-full transition ${
                        recordFilter === s
                          ? "bg-yellow-400 text-sky-900 font-semibold"
                          : "bg-sky-100 text-sky-700 hover:bg-sky-200"
                      }`}
                    >
                      {s}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="max-h-64 md:max-h-80 overflow-y-auto">
                <table className="min-w-full divide-y divide-sky-200">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-sky-700">
                        ID {/* 🆕 ADD THIS COLUMN */}
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-sky-700">
                        Date
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-sky-700">
                        Time
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-sky-700">
                        Type
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-sky-700">
                        Status
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-sky-700">
                        Concerns
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-100">
                    {filteredAppointments.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-6 text-center text-sm text-gray-500"
                        >
                          No records match the selected filter.
                        </td>
                      </tr>
                    ) : (
                      filteredAppointments.map((appt, idx) => (
                        <tr
                          key={appt.appointment_id || idx}
                          className="hover:bg-sky-50 transition"
                        >
                          {/* 🆕 ADD REFERENCE ID COLUMN */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs font-mono text-sky-700 font-semibold">
                            {appt.appointment_reference || "-"}
                          </td>

                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">
                            {appt.appointment_date
                              ? new Date(
                                  appt.appointment_date
                                ).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })
                              : "-"}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">
                            {appt.appointment_time || "-"}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">
                            {appt.appointment_type || "-"}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm capitalize font-semibold">
                            <div className="flex flex-col gap-2">
                              <span
                                className={
                                  String(appt.status || "").toLowerCase() ===
                                  "approved"
                                    ? "text-green-600"
                                    : String(
                                        appt.status || ""
                                      ).toLowerCase() === "pending"
                                    ? "text-yellow-600"
                                    : String(
                                        appt.status || ""
                                      ).toLowerCase() === "cancelled" ||
                                      String(
                                        appt.status || ""
                                      ).toLowerCase() === "canceled"
                                    ? "text-red-500"
                                    : "text-gray-600"
                                }
                              >
                                {appt.status || "-"}
                              </span>
                              {String(appt.status || "").toLowerCase() ===
                                "pending" && (
                                <button
                                  onClick={() =>
                                    handleCancelAppointment(appt.appointment_id)
                                  }
                                  disabled={isCancelling(appt.appointment_id)}
                                  className="self-start text-xs px-2 py-1 rounded-full bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 disabled:opacity-50"
                                >
                                  {isCancelling(appt.appointment_id)
                                    ? "Cancelling..."
                                    : "Cancel"}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-800">
                            {appt.concerns || "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowBookingModal(false)}
          />

          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl p-4 z-10 max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-sky-800">
                Book Appointment
              </h3>
              <button
                aria-label="Close booking"
                onClick={() => setShowBookingModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* LEFT: Calendar & slots (stacked for modal) */}
              <div className="lg:col-span-2">
                <div className="mb-3">
                  <label className="block text-sm font-semibold text-sky-800 mb-2">
                    1. Choose Appointment Type
                  </label>
                  <select
                    value={appointmentType}
                    onChange={(e) => {
                      setAppointmentType(e.target.value);
                      setSelectedDate(null);
                      setSelectedSlot(null);
                      setAdditionalServices([]);
                    }}
                    className="w-full border-2 border-sky-300 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-yellow-400 focus:outline-none"
                  >
                    <option value="">-- Select Type --</option>
                    {Object.keys(appointmentTypesMap).map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                {!appointmentType && (
                  <div className="text-center py-6 bg-sky-50 rounded-xl border-2 border-dashed border-sky-300">
                    <ClipboardList className="w-12 h-12 text-sky-300 mx-auto mb-3" />
                    <p className="text-sky-600">
                      Please select an appointment type first
                    </p>
                  </div>
                )}

                {appointmentType && (
                  <>
                    <div className="mb-4">
                      <label className="block text-sm font-semibold text-sky-800 mb-2">
                        2. Pick a Date
                      </label>
                      {!loadingCalendar && (
                        <div className="bg-gradient-to-br from-sky-50 to-blue-50 rounded-xl p-4 border border-sky-200">
                          <div className="flex items-center justify-between mb-4">
                            <button
                              onClick={() => {
                                const newMonth = new Date(selectedMonth);
                                newMonth.setMonth(newMonth.getMonth() - 1);
                                setSelectedMonth(newMonth);
                              }}
                              className="p-2 hover:bg-white rounded-lg transition-colors"
                            >
                              <ChevronDown className="w-5 h-5 rotate-90 text-sky-700" />
                            </button>
                            <h4 className="text-sm font-bold text-sky-900">
                              {selectedMonth.toLocaleDateString("en-US", {
                                month: "long",
                                year: "numeric",
                              })}
                            </h4>
                            <button
                              onClick={() => {
                                const newMonth = new Date(selectedMonth);
                                newMonth.setMonth(newMonth.getMonth() + 1);
                                setSelectedMonth(newMonth);
                              }}
                              className="p-2 hover:bg-white rounded-lg transition-colors"
                            >
                              <ChevronDown className="w-5 h-5 -rotate-90 text-sky-700" />
                            </button>
                          </div>

                          <div className="grid grid-cols-7 gap-2">
                            {[
                              "Mon",
                              "Tue",
                              "Wed",
                              "Thu",
                              "Fri",
                              "Sat",
                              "Sun",
                            ].map((d) => (
                              <div
                                key={d}
                                className="text-center text-xs font-semibold text-sky-700 py-2"
                              >
                                {d}
                              </div>
                            ))}
                            {(() => {
                              const year = selectedMonth.getFullYear();
                              const month = selectedMonth.getMonth();
                              const firstDay = new Date(year, month, 1);
                              const lastDay = new Date(year, month + 1, 0);
                              const startingDayOfWeek = firstDay.getDay();
                              const daysInMonth = lastDay.getDate();
                              const adjustedStartDay =
                                startingDayOfWeek === 0
                                  ? 6
                                  : startingDayOfWeek - 1;
                              const days = [];
                              for (let i = 0; i < adjustedStartDay; i++)
                                days.push(
                                  <div
                                    key={`empty-${i}`}
                                    className="aspect-square"
                                  />
                                );
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              for (let day = 1; day <= daysInMonth; day++) {
                                const date = new Date(year, month, day);
                                const dateStr = `${year}-${String(
                                  month + 1
                                ).padStart(2, "0")}-${String(day).padStart(
                                  2,
                                  "0"
                                )}`;
                                const dayOfWeek = date.getDay();
                                if (dayOfWeek === 0) {
                                  days.push(
                                    <div
                                      key={`day-${day}`}
                                      className="aspect-square rounded-lg bg-gray-200 flex items-center justify-center relative border border-gray-300"
                                    >
                                      <div className="text-center">
                                        <span className="text-sm text-gray-500">
                                          {day}
                                        </span>
                                        <div className="text-xs text-gray-500 mt-1">
                                          Closed
                                        </div>
                                      </div>
                                    </div>
                                  );
                                  continue;
                                }
                                const isPast = date < today;
                                const availableSlotsCnt =
                                  getAvailableSlotCount(date);
                                const isSelected =
                                  selectedDate &&
                                  date.toDateString() ===
                                    selectedDate.toDateString();
                                let bgColor = "bg-white hover:bg-sky-100";
                                let textColor = "text-gray-700";
                                let badge = null;
                                if (isPast) {
                                  bgColor = "bg-gray-100 cursor-not-allowed";
                                  textColor = "text-gray-400";
                                } else if (isSelected) {
                                  bgColor =
                                    "bg-yellow-400 border-2 border-yellow-500";
                                  textColor = "text-sky-900 font-bold";
                                } else if (availableSlotsCnt > 0) {
                                  bgColor =
                                    "bg-green-50 hover:bg-green-100 border border-green-200";
                                  textColor = "text-green-800 font-semibold";
                                  badge = (
                                    <span className="absolute bottom-1 right-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                                      {availableSlotsCnt}
                                    </span>
                                  );
                                } else {
                                  bgColor =
                                    "bg-red-50 cursor-not-allowed border border-red-200";
                                  textColor = "text-red-400";
                                  badge = (
                                    <span className="absolute bottom-1 right-1 text-red-400 text-xs">
                                      ✕
                                    </span>
                                  );
                                }
                                days.push(
                                  <button
                                    key={`day-${day}`}
                                    disabled={isPast || availableSlotsCnt === 0}
                                    onClick={() => {
                                      setSelectedDate(date);
                                      fetchAvailableSlots(date);
                                    }}
                                    className={`aspect-square rounded-lg ${bgColor} ${textColor} flex items-center justify-center relative transition-all ${
                                      !isPast && availableSlotsCnt > 0
                                        ? "cursor-pointer hover:scale-105"
                                        : ""
                                    }`}
                                  >
                                    <span className="text-xs">{day}</span>
                                    {badge}
                                  </button>
                                );
                              }
                              return days;
                            })()}
                          </div>

                          <div className="mt-4 pt-4 border-t border-sky-200 flex flex-wrap gap-4 text-xs">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 bg-green-50 border border-green-200 rounded"></div>
                              <span className="text-gray-700">Available</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 bg-red-50 border border-red-200 rounded"></div>
                              <span className="text-gray-700">No slots</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 bg-yellow-400 border-2 border-yellow-500 rounded"></div>
                              <span className="text-gray-700">Selected</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {selectedDate && (
                      <div>
                        <label className="block text-sm font-semibold text-sky-800 mb-2">
                          3. Choose Time Slot
                        </label>
                        {slotsLoading ? (
                          <div className="flex items-center justify-center py-3 bg-sky-50 rounded-xl">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-sky-500" />
                          </div>
                        ) : availableSlots.length === 0 ? (
                          <div className="text-center py-4 bg-red-50 rounded-xl border border-red-200">
                            <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                            <p className="text-red-600 text-sm">
                              No slots available for this date
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {availableSlots.map((slot) => {
                              const isSelected =
                                selectedSlot?.schedule_id === slot.schedule_id;
                              return (
                                <button
                                  key={slot.schedule_id}
                                  onClick={() => setSelectedSlot(slot)}
                                  className={`p-3 rounded-xl border-2 transition-all ${
                                    isSelected
                                      ? "bg-yellow-400 border-yellow-500 text-sky-900"
                                      : "bg-white border-sky-200 hover:border-sky-400 text-sky-800"
                                  }`}
                                >
                                  <div className="flex items-center justify-center gap-2 mb-1">
                                    <Clock className="w-4 h-4" />
                                    <span className="font-bold text-sm">
                                      {formatTimeRange(
                                        slot.start_time,
                                        slot.end_time
                                      )}
                                    </span>
                                  </div>
                                  <div
                                    className={`text-xs font-semibold ${
                                      isSelected
                                        ? "text-sky-900"
                                        : "text-sky-600"
                                    }`}
                                  >
                                    {slot.available_slots}/{slot.total_slots}{" "}
                                    available
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Vaccination type if needed */}
                    {appointmentType === "Vaccination" && (
                      <div className="bg-white rounded-2xl p-3 shadow-lg border border-sky-100 hover:shadow-xl transition-all mt-3">
                        <div className="flex items-center gap-2 mb-2">
                          <ClipboardList className="text-sky-600" />
                          <h3 className="text-xl font-bold text-sky-800">
                            Select Vaccination Type
                          </h3>
                        </div>
                        {vaccinesLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
                            <span className="ml-3 text-sky-600">
                              Loading vaccines...
                            </span>
                          </div>
                        ) : (
                          <>
                            <select
                              value={vaccinationType}
                              onChange={(e) => {
                                setVaccinationType(e.target.value);
                                const vaccine = availableVaccines.find(
                                  (v) => v.vaccine_name === e.target.value
                                );
                                setSelectedVaccine(vaccine);
                              }}
                              className="w-full border-2 border-sky-300 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-yellow-400 focus:outline-none"
                            >
                              <option value="">-- Select Vaccine --</option>
                              {availableVaccines
                                .filter((v) => v.available)
                                .map((vaccine) => (
                                  <option
                                    key={vaccine.vaccine_id}
                                    value={vaccine.vaccine_name}
                                  >
                                    {vaccine.vaccine_name} - {vaccine.reason}
                                  </option>
                                ))}
                            </select>
                            {availableVaccines.filter((v) => !v.available)
                              .length > 0 && (
                              <details className="mt-4">
                                <summary className="cursor-pointer text-sm text-gray-600 hover:text-sky-600 font-semibold">
                                  Show unavailable vaccines (
                                  {
                                    availableVaccines.filter(
                                      (v) => !v.available
                                    ).length
                                  }
                                  )
                                </summary>
                                <div className="mt-2 space-y-2">
                                  {availableVaccines
                                    .filter((v) => !v.available)
                                    .map((vaccine) => (
                                      <div
                                        key={vaccine.vaccine_id}
                                        className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                                      >
                                        <div className="flex items-start justify-between">
                                          <div>
                                            <p className="font-semibold text-gray-700">
                                              {vaccine.vaccine_name}
                                            </p>
                                            <p className="text-sm text-gray-600">
                                              {vaccine.description}
                                            </p>
                                          </div>
                                          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-semibold">
                                            Unavailable
                                          </span>
                                        </div>
                                        <p className="text-sm text-red-600 mt-2">
                                          ⏱️ {vaccine.reason}
                                        </p>
                                      </div>
                                    ))}
                                </div>
                              </details>
                            )}
                            {selectedVaccine && vaccinationType && (
                              <div className="mt-4 p-4 bg-sky-50 rounded-lg border border-sky-200">
                                <h4 className="font-bold text-sky-900 mb-2">
                                  📋 Vaccine Information
                                </h4>
                                <p className="text-sm text-sky-700 mb-2">
                                  <strong>Description:</strong>{" "}
                                  {selectedVaccine.description}
                                </p>
                                <div className="flex items-center gap-4 text-sm">
                                  <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full font-semibold">
                                    Dose {selectedVaccine.next_dose_number} of{" "}
                                    {selectedVaccine.total_doses}
                                  </span>
                                  <span className="text-sky-600">
                                    {selectedVaccine.doses_received} dose(s)
                                    completed
                                  </span>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* Additional Services */}
                    {selectedDate && appointmentType && selectedSlot && (
                      <div className="bg-white rounded-2xl p-3 shadow-lg border border-sky-100 hover:shadow-xl transition-all mt-3">
                        <div className="flex items-center gap-2 mb-3">
                          <ClipboardList className="text-sky-600" />
                          <h3 className="text-xl font-bold text-sky-800">
                            4. Additional Services (Optional)
                          </h3>
                        </div>
                        <p className="text-sm text-sky-600 mb-4">
                          You can add other services to your appointment. Select
                          "None" if you don't want any additional services.
                        </p>
                        <div className="space-y-3">
                          <label
                            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                              additionalServices.length === 0
                                ? "border-yellow-400 bg-yellow-50"
                                : "border-sky-200 hover:border-sky-300 bg-white"
                            }`}
                          >
                            <input
                              type="radio"
                              name="additionalServices"
                              checked={additionalServices.length === 0}
                              onChange={handleSelectNone}
                              className="w-5 h-5 text-yellow-400 border-sky-300 focus:ring-yellow-400"
                            />
                            <span className="flex-1 font-semibold text-sky-800">
                              None
                            </span>
                          </label>
                          {Object.keys(appointmentTypesMap)
                            .filter(
                              (t) =>
                                t !== appointmentType && t !== "Vaccination"
                            )
                            .map((type) => {
                              const isSelected =
                                additionalServices.includes(type);
                              return (
                                <label
                                  key={type}
                                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                    isSelected
                                      ? "border-yellow-400 bg-yellow-50"
                                      : "border-sky-200 hover:border-sky-300 bg-white"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() =>
                                      toggleAdditionalService(type)
                                    }
                                    className="w-5 h-5 text-yellow-400 border-sky-300 rounded focus:ring-yellow-400"
                                  />
                                  <span className="flex-1 font-semibold text-sky-800">
                                    {type}
                                  </span>
                                </label>
                              );
                            })}
                        </div>
                        {additionalServices.length > 0 && (
                          <div className="mt-4 p-3 bg-sky-50 rounded-lg border border-sky-200">
                            <p className="text-sm text-sky-700">
                              <strong>Selected Additional Services:</strong>{" "}
                              {additionalServices.join(", ")}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Patient Concerns */}
                    <div className="bg-white rounded-2xl p-3 shadow-lg border border-sky-100 hover:shadow-xl transition-all mt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <ClipboardList className="text-sky-600" />
                        <h3 className="text-xl font-bold text-sky-800">
                          {selectedDate && appointmentType && selectedSlot
                            ? "5. Patient Concerns"
                            : "4. Patient Concerns"}
                        </h3>
                      </div>
                      <textarea
                        value={patientConcerns}
                        onChange={(e) => setPatientConcerns(e.target.value)}
                        placeholder="Describe symptoms or reason for visit"
                        className="w-full border-2 border-sky-300 rounded-xl px-3 py-2 text-sm bg-white resize-none focus:ring-2 focus:ring-yellow-400 focus:outline-none"
                        rows={3}
                      />
                      {patientConcerns.length > 0 && (
                        <p className="text-xs text-sky-600 mt-2">
                          {patientConcerns.length} characters
                        </p>
                      )}
                    </div>

                    {/* Book Button */}
                    <div className="text-center mt-3">
                      <button
                        onClick={handleBookAppointment}
                        className="inline-block bg-yellow-400 text-sky-900 px-6 py-2 rounded-full text-sm font-bold shadow-md hover:bg-yellow-500 hover:scale-105 hover:shadow-lg transition-all"
                      >
                        Book Appointment
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* RIGHT: Summary Card */}
              <div className="bg-white rounded-2xl p-4 shadow-lg border border-sky-100 h-fit sticky top-6">
                <h3 className="text-base font-bold text-sky-800 mb-4 flex items-center gap-2">
                  <ClipboardList className="w-6 h-6 text-sky-600" />
                  Appointment Summary
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-sky-600 font-semibold mb-1">
                      Appointment Type
                    </p>
                    <p className="text-lg font-bold text-sky-900">
                      {appointmentType || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-sky-600 font-semibold mb-1">
                      Date
                    </p>
                    <p className="text-base font-bold text-sky-900">
                      {selectedDate
                        ? selectedDate.toLocaleDateString("en-US", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-sky-600 font-semibold mb-1">
                      Time
                    </p>
                    <p className="text-lg font-bold text-sky-900">
                      {selectedSlot
                        ? formatTimeRange(
                            selectedSlot.start_time,
                            selectedSlot.end_time
                          )
                        : "—"}
                    </p>
                  </div>
                  <div className="pt-3 border-t border-sky-200">
                    {!appointmentType && (
                      <div className="text-center py-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">
                          Select appointment type
                        </p>
                      </div>
                    )}
                    {appointmentType && !selectedDate && (
                      <div className="text-center py-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-600">
                          Pick a date from calendar
                        </p>
                      </div>
                    )}
                    {appointmentType && selectedDate && !selectedSlot && (
                      <div className="text-center py-3 bg-yellow-50 rounded-lg">
                        <p className="text-sm text-yellow-700">
                          Choose a time slot
                        </p>
                      </div>
                    )}
                    {appointmentType && selectedDate && selectedSlot && (
                      <div className="text-center py-3 bg-green-50 rounded-lg border border-green-200">
                        <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-1" />
                        <p className="text-sm text-green-700 font-semibold">
                          Ready to book!
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Clinic Services Section */}
      <div className="bg-white/60 rounded-2xl shadow-sm p-4 sm:p-6 max-h-[50vh] lg:max-h-none overflow-auto">
        <h2 className="text-xl font-bold text-sky-700 mb-4 text-center">
          Our Clinic Services
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {services.map((service, idx) => (
            <div
              key={idx}
              className="bg-white/80 border border-sky-100 rounded-xl shadow-sm p-3 text-center transition-all duration-150"
            >
              <div className="flex justify-center mb-1">{service.icon}</div>
              <h3 className="text-sm font-semibold text-sky-700">
                {service.title}
              </h3>
              <p className="text-gray-600 text-[11px] mt-1">{service.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PatientDashboard;