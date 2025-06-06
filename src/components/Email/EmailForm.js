// components/Email/EmailForm.js - Updated with bulk upload tab
import { useState } from "react";
import { Users, Upload } from "lucide-react";
import BulkUpload from "./BulkUpload";

export default function EmailForm({
  templates,
  resumes,
  selectedTemplate,
  selectedResume,
  onTemplateChange,
  onResumeChange,
  onAddRecipient,
  onBulkAdd,
  loading,
  dailyEmailCount = 0, // Add this prop to track daily email count
}) {
  const [activeTab, setActiveTab] = useState("manual");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    position: "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.email) return;

    onAddRecipient({
      ...formData,
      id: Date.now() + Math.random(), // Generate unique ID
    });

    // Reset form
    setFormData({
      name: "",
      email: "",
      company: "",
      position: "",
    });
  };

  const handleBulkAdd = async (recipients) => {
    console.log(`📦 EmailForm: Bulk adding ${recipients.length} recipients`);

    // Just pass the recipients to the parent - don't track state here
    await onBulkAdd(recipients);
  };
  // In the BulkUpload component props:
  {
    activeTab === "bulk" && (
      <BulkUpload
        onBulkAdd={handleBulkAdd} // ← New bulk handler
        dailyEmailCount={dailyEmailCount}
        maxDailyEmails={500}
      />
    );
  }

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-6">Campaign Details</h2>

      {/* Template Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Email Template *
        </label>
        <select
          value={selectedTemplate}
          onChange={(e) => onTemplateChange(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        >
          <option value="">Select a template</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </div>

      {/* Resume Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Resume
        </label>
        <select
          value={selectedResume}
          onChange={(e) => onResumeChange(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        >
          <option value="">Select a resume (optional)</option>
          {resumes.map((resume) => (
            <option key={resume.id} value={resume.id}>
              {resume.display_name}
            </option>
          ))}
        </select>
      </div>

      <hr className="my-6" />

      {/* Add Recipients Section */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Add Recipients
        </h3>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab("manual")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "manual"
                ? "text-blue-600 border-blue-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Manual Entry
          </button>
          <button
            onClick={() => setActiveTab("bulk")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ml-4 ${
              activeTab === "bulk"
                ? "text-blue-600 border-blue-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
          >
            <Upload className="w-4 h-4 inline mr-2" />
            Bulk Upload
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "manual" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Manual Entry Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="John Doe"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="john@company.com"
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => handleInputChange("company", e.target.value)}
                  placeholder="Acme Corp"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Position
                </label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={(e) =>
                    handleInputChange("position", e.target.value)
                  }
                  placeholder="Software Engineer"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!formData.email || loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Add Recipient
            </button>
          </form>
        )}

        {activeTab === "bulk" && (
          <BulkUpload
            onBulkAdd={handleBulkAdd}
            dailyEmailCount={dailyEmailCount}
            maxDailyEmails={500}
          />
        )}
      </div>

      {/* Daily Email Counter */}
      {dailyEmailCount > 0 && (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-800">Daily emails sent:</span>
            <span className="text-sm font-medium text-blue-900">
              {dailyEmailCount}/500
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${Math.min((dailyEmailCount / 500) * 100, 100)}%`,
              }}
            ></div>
          </div>
          {dailyEmailCount >= 450 && (
            <p className="text-xs text-blue-700 mt-1">
              ⚠️ Approaching daily limit ({500 - dailyEmailCount} emails
              remaining)
            </p>
          )}
        </div>
      )}
    </div>
  );
}
