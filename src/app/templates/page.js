"use client";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Edit2, Trash2 } from "lucide-react";
import Button from "@/components/UI/Button";
import toast from "react-hot-toast";
import dynamic from "next/dynamic";

// Dynamically import MDEditor to avoid SSR issues
const MDEditor = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 bg-gray-100 rounded animate-pulse flex items-center justify-center">
        Loading editor...
      </div>
    ),
  }
);

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
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
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from("templates")
      .select("*")
      .is("deleted_at", null) // Only fetch non-deleted templates
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Error loading templates");
    } else {
      setTemplates(data || []);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingTemplate) {
        const { error } = await supabase
          .from("templates")
          .update(formData)
          .eq("id", editingTemplate.id);

        if (error) throw error;
        toast.success("Template updated!");
      } else {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const response = await fetch("/api/templates", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(formData),
        });

        if (!response.ok) throw new Error("Failed to create template");
        toast.success("Template created!");
      }

      setShowForm(false);
      setEditingTemplate(null);
      setFormData({
        name: "",
        subject: "",
        body: "",
        type: "email",
        category: "company",
      });
      fetchTemplates();
    } catch (error) {
      toast.error("Error saving template");
    }
  };

  const handleDelete = async (id) => {
    if (
      !confirm(
        "Are you sure you want to archive this template? It will be hidden but your email history will be preserved."
      )
    )
      return;

    try {
      // Soft delete - set deleted_at timestamp
      const { error } = await supabase
        .from("templates")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      toast.success("Template archived!");
      fetchTemplates();
    } catch (error) {
      toast.error("Error archiving template");
      console.error("Archive error:", error);
    }
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      body: template.body,
      type: template.type,
      category: template.category,
    });
    setShowForm(true);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Templates</h1>
        <Button onClick={() => setShowForm(true)} className="flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-xl font-semibold mb-4">
            {editingTemplate ? "Edit Template" : "Create Template"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="email">Email</option>
                </select>
              </div>
            </div>

            {formData.type === "email" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="company">Company Direct</option>
                    <option value="vendor">Vendor/Recruiter</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject Line
                  </label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) =>
                      setFormData({ ...formData, subject: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Use {{variables}} for personalization"
                    required={formData.type === "email"}
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message Body
              </label>
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <MDEditor
                  value={formData.body}
                  onChange={(value) =>
                    setFormData({ ...formData, body: value || "" })
                  }
                  preview="edit"
                  hideToolbar={false}
                  height={300}
                  data-color-mode="light"
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Available variables:{" "}
                {
                  "{{recruiterName}}, {{company}}, {{position}}, {{myName}}, {{myEmail}}"
                }
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Use markdown: **bold**, *italic*, - bullet points, [link](url)
              </p>
            </div>

            <div className="flex space-x-3">
              <Button type="submit">
                {editingTemplate ? "Update Template" : "Create Template"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setEditingTemplate(null);
                  setFormData({
                    name: "",
                    subject: "",
                    body: "",
                    type: "email",
                    category: "company",
                  });
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {templates.map((template) => (
          <div key={template.id} className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold">{template.name}</h3>
                <div className="flex space-x-2 mt-1">
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                    {template.type.replace("_", " ")}
                  </span>
                  {template.category && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                      {template.category}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEdit(template)}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(template.id)}
                  className="text-red-600 hover:text-red-700"
                  title="Archive template"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {template.subject && (
              <p className="text-sm text-gray-600 mb-2">
                <strong>Subject:</strong> {template.subject}
              </p>
            )}

            <div className="text-sm text-gray-700 line-clamp-3">
              <div dangerouslySetInnerHTML={{ __html: template.body }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
