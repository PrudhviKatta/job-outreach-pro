// Phase 1: Clean EmailForm.js - Proper validation order
import { useState } from "react";
import { Users, Upload, AlertTriangle } from "lucide-react";
import BulkUpload from "./BulkUpload";

export default function CleanEmailForm({
  templates,
  resumes,
  selectedTemplate,
  selectedResume,
  onTemplateChange,
  onResumeChange,
  onRecipientsReady, // New: Pass total count instead of individual recipients
  recipientCount = 0,
  loading,
  dailyEmailCount = 0,
}) {
  const [activeTab, setActiveTab] = useState("manual");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    position: "",
  });

  // Manual recipients (small list for display)
  const [manualRecipients, setManualRecipients] = useState([]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.email) return;

    const newRecipient = {
      ...formData,
      id: Date.now() + Math.random(),
    };

    const updatedRecipients = [...manualRecipients, newRecipient];
    setManualRecipients(updatedRecipients);

    // Pass to parent for processing
    onRecipientsReady(updatedRecipients);

    // Reset form
    setFormData({
      name: "",
      email: "",
      company: "",
      position: "",
    });
  };

  const handleBulkAdd = async (recipients) => {
    // For bulk upload, we don't display all recipients in UI
    // Just pass them to parent for processing
    onRecipientsReady(recipients);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleRemoveManual = (id) => {
    const updated = manualRecipients.filter((r) => r.id !== id);
    setManualRecipients(updated);
    onRecipientsReady(updated);
  };

  // Disable recipient input if no template selected
  const canAddRecipients = selectedTemplate && !loading;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-6">Campaign Setup</h2>

      {/* STEP 1: Template Selection (MANDATORY) */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Email Template *
        </label>
        <select
          value={selectedTemplate}
          onChange={(e) => onTemplateChange(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        >
          <option value="">Select a template first...</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
        {!selectedTemplate && (
          <p className="text-yellow-600 text-sm mt-1 flex items-center">
            <AlertTriangle className="w-4 h-4 mr-1" />
            Select a template to continue
          </p>
        )}
      </div>

      {/* STEP 2: Resume Selection (OPTIONAL) */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Resume (Optional)
        </label>
        <select
          value={selectedResume}
          onChange={(e) => onResumeChange(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading || !selectedTemplate}
        >
          <option value="">No resume attachment</option>
          {resumes.map((resume) => (
            <option key={resume.id} value={resume.id}>
              {resume.display_name}
            </option>
          ))}
        </select>
        {selectedTemplate && !selectedResume && (
          <p className="text-amber-600 text-sm mt-1 flex items-center">
            <AlertTriangle className="w-4 h-4 mr-1" />
            No resume selected - emails will be sent without attachment
          </p>
        )}
      </div>

      <hr className="my-6" />

      {/* STEP 3: Add Recipients (Only enabled after template) */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Add Recipients
        </h3>

        {!canAddRecipients && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
            <AlertTriangle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">
              {!selectedTemplate
                ? "Select a template first to add recipients"
                : "Loading..."}
            </p>
          </div>
        )}

        {canAddRecipients && (
          <>
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
              <div className="space-y-4">
                {/* Manual Entry Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) =>
                          handleInputChange("name", e.target.value)
                        }
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
                        onChange={(e) =>
                          handleInputChange("email", e.target.value)
                        }
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
                        onChange={(e) =>
                          handleInputChange("company", e.target.value)
                        }
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
                    disabled={!formData.email}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    Add Recipient
                  </button>
                </form>

                {/* Manual Recipients List (Small display) */}
                {manualRecipients.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Manual Recipients ({manualRecipients.length})
                    </h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {manualRecipients.map((recipient) => (
                        <div
                          key={recipient.id}
                          className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm"
                        >
                          <div>
                            <span className="font-medium">
                              {recipient.name || "Unknown"}
                            </span>
                            <span className="text-gray-600 ml-2">
                              {recipient.email}
                            </span>
                          </div>
                          <button
                            onClick={() => handleRemoveManual(recipient.id)}
                            className="text-red-600 hover:text-red-700 text-xs"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "bulk" && (
              <BulkUpload
                onBulkAdd={handleBulkAdd}
                dailyEmailCount={dailyEmailCount}
                maxDailyEmails={500}
              />
            )}
          </>
        )}
      </div>

      {/* Recipients Summary */}
      {recipientCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Users className="w-5 h-5 text-blue-600 mr-2" />
              <span className="font-medium text-blue-900">
                {recipientCount} recipients ready
              </span>
            </div>
            <div className="text-sm text-blue-700">
              Ready to start campaign ✓
            </div>
          </div>
        </div>
      )}

      {/* Daily Email Counter */}
      {dailyEmailCount > 0 && (
        <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Daily emails sent:</span>
            <span className="text-sm font-medium text-gray-900">
              {dailyEmailCount}/500
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${Math.min((dailyEmailCount / 500) * 100, 100)}%`,
              }}
            ></div>
          </div>
          {dailyEmailCount >= 450 && (
            <p className="text-xs text-amber-600 mt-1">
              ⚠️ Approaching daily limit ({500 - dailyEmailCount} emails
              remaining)
            </p>
          )}
        </div>
      )}
    </div>
  );
}
