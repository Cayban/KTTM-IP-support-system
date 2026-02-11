import { MapPinIcon, PhoneIcon } from "@heroicons/react/24/outline";

const FacebookIcon = (props) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
  </svg>
);

const MailIcon = (props) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
    <path d="m22 6-10 7L2 6"></path>
  </svg>
);

function Footer() {
  return (
    <footer className="w-full bg-gradient-to-br from-sky-50 via-blue-50 to-sky-100 border-t-4 border-sky-500 shadow-inner">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="text-center mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-sky-700 mb-1">
            Get in Touch
          </h2>
          <p className="text-gray-600 text-sm sm:text-base">
            We're here to help your little one thrive
          </p>
        </div>

        {/* Contact Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {/* Location Card */}
          <div className="bg-white rounded-xl shadow-md p-4hover:shadow-2xl transition-all duration-300 border-t-4 border-sky-500 transform hover:-translate-y-1">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-sky-100 p-3 rounded-full">
                <MapPinIcon className="w-6 h-6 text-sky-600" />
              </div>
              <h3 className="text-lg font-bold text-sky-700">Location</h3>
            </div>
            <p className="text-gray-700 text-sm leading-relaxed mb-4">
              138 Rizal Avenue Brgy 9<br />
              Batangas City, Calabarzon 4200
            </p>
            <a
              href="https://www.google.com/maps/place/Castillo+Children's+Clinic/@13.7565027,121.0566993,1162m/data=!3m2!1e3!4b1!4m6!3m5!1s0x33bd0541aaa50131:0xa6968e99ce251f20!8m2!3d13.7564975!4d121.0592742!16s%2Fg%2F11f4xtcvqq"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-full text-sm bg-green-500 text-white px-4 py-2.5 rounded-full hover:bg-green-600 transition font-semibold shadow-md hover:shadow-lg"
            >
              📍 View on Map
            </a>
          </div>

          {/* Phone Card */}
          <div className="bg-white rounded-xl shadow-md p-4hover:shadow-2xl transition-all duration-300 border-t-4 border-yellow-500 transform hover:-translate-y-1">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-yellow-100 p-3 rounded-full">
                <PhoneIcon className="w-6 h-6 text-yellow-600" />
              </div>
              <h3 className="text-lg font-bold text-yellow-700">Phone</h3>
            </div>
            <a
              href="tel:09664412470"
              className="text-gray-700 text-lg hover:text-yellow-600 font-bold transition block text-center py-2"
            >
              📞 0966 441 2470
            </a>
          </div>

          {/* Email Card */}
          <div className="bg-white rounded-xl shadow-md p-4hover:shadow-2xl transition-all duration-300 border-t-4 border-purple-500 transform hover:-translate-y-1">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-purple-100 p-3 rounded-full">
                <MailIcon className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-bold text-purple-700">Email</h3>
            </div>
            <a
              href="mailto:castillochildrensclinic@gmail.com"
              className="text-gray-700 text-xs sm:text-sm hover:text-purple-600 transition break-all font-medium block text-center"
            >
              ✉️ castillochildrensclinic@gmail.com
            </a>
          </div>

          {/* Facebook Card */}
          <div className="bg-white rounded-xl shadow-md p-4hover:shadow-2xl transition-all duration-300 border-t-4 border-blue-500 transform hover:-translate-y-1">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-blue-100 p-3 rounded-full">
                <FacebookIcon className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-blue-700">Facebook</h3>
            </div>
            <a
              href="https://www.facebook.com/myracastilloMD"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 hover:underline text-sm font-semibold block text-center"
            >
              👍 @myracastilloMD
            </a>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t-2 border-sky-200 my-8"></div>

        {/* Copyright & Branding */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <img
              src="/clinicsclogo.png"
              alt="Clinic Logo"
              className="w-10 h-10 object-contain"
            />
            <p className="text-lg font-bold text-sky-700">
              Castillo Children Clinic
            </p>
          </div>
          <p className="text-gray-600 text-sm">
            Providing quality pediatric care for babies, kids, and teens
          </p>
          <p className="text-gray-500 text-xs">
            © {new Date().getFullYear()} Castillo Children Clinic. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;