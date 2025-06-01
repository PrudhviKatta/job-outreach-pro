import { useState } from "react";
import Button from "@/components/UI/Button";
import { Plus } from "lucide-react";

export default function EmailForm({
  templates,
  resumes,
  selectedTemplate,
  selectedResume,
  onTemplateChange,
  onResumeChange,
  onAddRecipient,
  loading,
}) {
  const [recipientForm, setRecipientForm] = useState({
    name: "",
    email: "",
    company: "",
    position: "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!recipientForm.name || !recipientForm.email) {
      return;
    }
    onAddRecipient(recipientForm);
    setRecipientForm({ name: "", email: "", company: "", position: "" });
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Email Configuration</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Template
          </label>
          <select
            value={selectedTemplate}
            onChange={(e) => onTemplateChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            disabled={loading}
          >
            <option value="">Select a template...</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Resume
          </label>
          <select
            value={selectedResume}
            onChange={(e) => onResumeChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            disabled={loading}
          >
            <option value="">Select a resume...</option>
            {resumes.map((resume) => (
              <option key={resume.id} value={resume.id}>
                {resume.display_name} {resume.is_default && "⭐"}
              </option>
            ))}
          </select>
        </div>

        <hr className="my-6" />

        <h3 className="text-lg font-medium mb-3">Add Recipient</h3>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={recipientForm.name}
              onChange={(e) =>
                setRecipientForm({ ...recipientForm, name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              value={recipientForm.email}
              onChange={(e) =>
                setRecipientForm({ ...recipientForm, email: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company
            </label>
            <input
              type="text"
              value={recipientForm.company}
              onChange={(e) =>
                setRecipientForm({ ...recipientForm, company: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Position
            </label>
            <input
              type="text"
              value={recipientForm.position}
              onChange={(e) =>
                setRecipientForm({ ...recipientForm, position: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <Button
            type="submit"
            className="w-full flex items-center justify-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Recipient
          </Button>
        </form>
      </div>
    </div>
  );
}
