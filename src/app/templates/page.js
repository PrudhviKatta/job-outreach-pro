"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import toast from "react-hot-toast";
import { Trash2, Edit, Plus, X } from "lucide-react";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

export default function TemplatesPage() {
  const { data: session } = useSession();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    body: "",
    type: "email",
    category: "company",
  });

  useEffect(() => {
    if (session) fetchTemplates();
  }, [session]);

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/templates?type=email");
      const data = await res.json();
      if (data.success) {
        setTemplates(data.data);
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const method = editingTemplate ? "PUT" : "POST";
      const body = editingTemplate
        ? { id: editingTemplate.id, ...formData }
        : formData;

      const res = await fetch("/api/templates", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(
          editingTemplate ? "Template updated!" : "Template created!"
        );
        fetchTemplates();
        resetForm();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error("Error saving template");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Archive this template?")) return;
    try {
      const res = await fetch(`/api/templates?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Template archived");
        fetchTemplates();
      }
    } catch (error) {
      toast.error("Error archiving template");
    }
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject || "",
      body: template.body,
      type: template.type,
      category: template.category || "company",
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingTemplate(null);
    setFormData({
      name: "",
      subject: "",
      body: "",
      type: "email",
      category: "company",
    });
  };

  const variablesList = [
    "{{recruiterName}}",
    "{{company}}",
    "{{position}}",
    "{{myName}}",
    "{{myEmail}}",
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Email Templates</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg shadow-md p-6 space-y-4"
        >
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">
              {editingTemplate ? "Edit Template" : "New Template"}
            </h2>
            <button type="button" onClick={resetForm}>
              <X className="w-5 h-5 text-gray-500 hover:text-gray-700" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Cold Outreach v1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="company">Company</option>
                <option value="vendor">Vendor</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject Line *
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) =>
                setFormData({ ...formData, subject: e.target.value })
              }
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Interested in {{position}} role at {{company}}"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Body *
            </label>
            <MDEditor
              value={formData.body}
              onChange={(val) => setFormData({ ...formData, body: val || "" })}
              height={300}
            />
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Available Variables:
            </p>
            <div className="flex flex-wrap gap-2">
              {variablesList.map((v) => (
                <code
                  key={v}
                  className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs cursor-pointer hover:bg-indigo-200"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      body: formData.body + ` ${v}`,
                    })
                  }
                >
                  {v}
                </code>
              ))}
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              type="submit"
              className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors font-medium"
            >
              {editingTemplate ? "Update Template" : "Create Template"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-500">
          Loading templates...
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-500">
            No templates yet. Create your first one!
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-white rounded-lg shadow-md p-6"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {template.name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Subject: {template.subject}
                  </p>
                  <p className="text-sm text-gray-500 mt-2 line-clamp-3">
                    {template.body}
                  </p>
                  {template.category && (
                    <span className="inline-block mt-2 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {template.category}
                    </span>
                  )}
                </div>
                <div className="flex space-x-2 ml-4">
                  <button
                    onClick={() => handleEdit(template)}
                    className="text-indigo-600 hover:text-indigo-700 p-1"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="text-red-600 hover:text-red-700 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
