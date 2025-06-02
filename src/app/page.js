import Link from "next/link";
import { ArrowRight, Send, Users, BarChart3 } from "lucide-react";

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to Job Outreach Pro
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Streamline your job search with automated outreach
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Link
            href="/email"
            className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            <Send className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Send Emails</h3>
            <p className="text-gray-600">Personalized email campaigns</p>
          </Link>
          <Link
            href="/dashboard"
            className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            <BarChart3 className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Analytics</h3>
            <p className="text-gray-600">Track your outreach success</p>
          </Link>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Go to Dashboard
          <ArrowRight className="ml-2 w-5 h-5" />
        </Link>
      </div>
    </div>
  );
}
