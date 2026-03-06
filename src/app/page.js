import Link from "next/link";
import { Send, BarChart3, Mail, Settings } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-5xl font-bold text-gray-900 mb-4">
        Job Outreach <span className="text-indigo-600">Pro</span>
      </h1>
      <p className="text-xl text-gray-600 mb-8 max-w-2xl">
        Automate your job search outreach with personalized email campaigns,
        tracking, and follow-up reminders.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg w-full mb-8">
        <Link
          href="/email"
          className="flex items-center justify-center bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
        >
          <Send className="w-5 h-5 mr-2" />
          Start Campaign
        </Link>
        <Link
          href="/dashboard"
          className="flex items-center justify-center bg-white text-gray-700 px-6 py-3 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors font-medium"
        >
          <BarChart3 className="w-5 h-5 mr-2" />
          Dashboard
        </Link>
      </div>

      <div className="flex space-x-6 text-sm text-gray-500">
        <Link href="/templates" className="flex items-center hover:text-indigo-600">
          <Mail className="w-4 h-4 mr-1" />
          Templates
        </Link>
        <Link href="/settings" className="flex items-center hover:text-indigo-600">
          <Settings className="w-4 h-4 mr-1" />
          Settings
        </Link>
      </div>
    </div>
  );
}
