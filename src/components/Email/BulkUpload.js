// components/Email/BulkUpload.js
import { useState, useCallback } from "react";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  X,
  Eye,
} from "lucide-react";
import Papa from "papaparse";

const BulkUpload = ({
  onBulkAdd,
  dailyEmailCount = 0,
  maxDailyEmails = 500,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [parsedData, setParsedData] = useState([]);
  const [validationStats, setValidationStats] = useState(null);

  // Email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validateEmail = (email) => {
    return emailRegex.test(email?.trim());
  };

  const processCSVData = useCallback(
    (csvData) => {
      console.log("📊 Processing CSV data:", { rowCount: csvData.length });

      const processed = [];
      const duplicates = new Set();
      const invalid = [];

      // Track emails we've seen in this file
      const seenEmails = new Set();

      csvData.forEach((row, index) => {
        // Flexible column mapping - check for various possible column names
        const name =
          row.Name ||
          row.name ||
          row.NAME ||
          row["Full Name"] ||
          row["full_name"] ||
          "";
        const email =
          row.Email ||
          row.email ||
          row.EMAIL ||
          row["Email Address"] ||
          row["email_address"] ||
          "";
        const company =
          row.Company ||
          row.company ||
          row.COMPANY ||
          row.Organization ||
          row.organization ||
          "";
        const position =
          row.Position ||
          row.position ||
          row.POSITION ||
          row.Title ||
          row.title ||
          row.Role ||
          row.role ||
          "";

        // Skip empty rows
        if (!email?.trim()) {
          return;
        }

        const cleanEmail = email.trim().toLowerCase();

        // Check for duplicates within file
        if (seenEmails.has(cleanEmail)) {
          duplicates.add(cleanEmail);
          return;
        }

        // Validate email format
        if (!validateEmail(cleanEmail)) {
          invalid.push({
            row: index + 1,
            email: cleanEmail,
            reason: "Invalid format",
          });
          return;
        }

        seenEmails.add(cleanEmail);
        processed.push({
          id: Date.now() + Math.random(), // Temporary ID
          name: name.trim() || "Unknown",
          email: cleanEmail,
          company: company.trim() || null,
          position: position.trim() || null,
        });
      });

      // Limit to 500 records
      const limited = processed.slice(0, 500);
      const overlimit = processed.length > 500 ? processed.length - 500 : 0;

      const stats = {
        total: csvData.length,
        valid: limited.length,
        duplicates: duplicates.size,
        invalid: invalid.length,
        overlimit,
        dailyRemaining: maxDailyEmails - dailyEmailCount,
      };

      console.log("✅ CSV processing complete:", stats);

      setParsedData(limited);
      setValidationStats(stats);
      setShowPreview(true);
    },
    [dailyEmailCount, maxDailyEmails]
  );

  const handleFileRead = useCallback(
    (file) => {
      setProcessing(true);
      console.log("📁 Reading file:", file.name, file.type);

      Papa.parse(file, {
        header: true,
        dynamicTyping: false, // Keep as strings for better control
        skipEmptyLines: true,
        delimitersToGuess: [",", "\t", "|", ";"],
        complete: (results) => {
          console.log("📋 Papa Parse results:", {
            data: results.data.length,
            errors: results.errors.length,
            meta: results.meta,
          });

          if (results.errors.length > 0) {
            console.warn("⚠️ Parse errors:", results.errors);
          }

          processCSVData(results.data);
          setProcessing(false);
        },
        error: (error) => {
          console.error("❌ Parse error:", error);
          setProcessing(false);
          alert("Error reading file. Please check the format and try again.");
        },
      });
    },
    [processCSVData]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragActive(false);

      const files = e.dataTransfer.files;
      if (files && files[0]) {
        const file = files[0];
        if (file.type === "text/csv" || file.name.endsWith(".csv")) {
          handleFileRead(file);
        } else {
          alert("Please upload a CSV file only for now.");
        }
      }
    },
    [handleFileRead]
  );

  const handleFileSelect = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileRead(file);
      }
      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [handleFileRead]
  );

  const handleConfirmAdd = async () => {
    console.log(`🚀 Bulk adding ${parsedData.length} recipients to campaign`);

    try {
      // Call the bulk handler instead of individual adds
      await onBulkAdd(parsedData);

      // Reset state
      setParsedData([]);
      setValidationStats(null);
      setShowPreview(false);
      setUploadResults({
        success: true,
        count: parsedData.length,
        message: `Successfully added ${parsedData.length} recipients!`,
      });

      // Clear results after 3 seconds
      setTimeout(() => setUploadResults(null), 3000);
    } catch (error) {
      console.error("❌ Error bulk adding recipients:", error);
      setUploadResults({
        success: false,
        message: "Error adding recipients. Please try again.",
      });
    }
  };

  const handleCancel = () => {
    setParsedData([]);
    setValidationStats(null);
    setShowPreview(false);
  };

  const remainingDaily = maxDailyEmails - dailyEmailCount;
  const canSendCount = Math.min(parsedData.length, remainingDaily);

  return (
    <div className="space-y-4">
      {/* File Upload Area */}
      {!showPreview && (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer ${
            dragActive
              ? "border-blue-500 bg-blue-50"
              : processing
              ? "border-gray-300 bg-gray-50"
              : "border-gray-300 hover:border-gray-400"
          }`}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragActive(false);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() =>
            !processing && document.getElementById("csv-file-input")?.click()
          }
        >
          <input
            id="csv-file-input"
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />

          {processing ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-lg font-medium text-gray-900">
                Processing file...
              </p>
              <p className="text-sm text-gray-500">
                Validating emails and checking for duplicates
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Upload className="w-12 h-12 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                Drop your CSV file here
              </p>
              <p className="text-sm text-gray-500 mb-4">or click to browse</p>
              <div className="flex items-center space-x-2 text-xs text-gray-400">
                <span className="bg-gray-100 px-2 py-1 rounded flex items-center">
                  <FileSpreadsheet className="w-3 h-3 mr-1" />
                  CSV Only
                </span>
                <span className="bg-gray-100 px-2 py-1 rounded">
                  Max 500 records
                </span>
                <span className="bg-gray-100 px-2 py-1 rounded">
                  {remainingDaily} emails left today
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preview Section */}
      {showPreview && validationStats && (
        <div className="space-y-4">
          {/* Validation Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <Eye className="w-5 h-5 text-blue-600 mr-2" />
              <h3 className="text-lg font-medium text-blue-900">
                Preview: {validationStats.valid} recipients ready
              </h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-blue-700">✅ Valid emails:</span>
                <span className="font-medium text-blue-900">
                  {validationStats.valid}
                </span>
              </div>
              {validationStats.duplicates > 0 && (
                <div className="flex justify-between">
                  <span className="text-yellow-700">⚠️ Duplicates:</span>
                  <span className="font-medium text-yellow-900">
                    {validationStats.duplicates}
                  </span>
                </div>
              )}
              {validationStats.invalid > 0 && (
                <div className="flex justify-between">
                  <span className="text-red-700">❌ Invalid:</span>
                  <span className="font-medium text-red-900">
                    {validationStats.invalid}
                  </span>
                </div>
              )}
              {validationStats.overlimit > 0 && (
                <div className="flex justify-between">
                  <span className="text-orange-700">🚫 Over limit:</span>
                  <span className="font-medium text-orange-900">
                    {validationStats.overlimit}
                  </span>
                </div>
              )}
            </div>

            {canSendCount < parsedData.length && (
              <div className="mt-3 p-2 bg-yellow-100 rounded text-sm text-yellow-800">
                ⚠️ Daily limit: Can only send {canSendCount} of{" "}
                {parsedData.length} emails today
              </div>
            )}
          </div>

          {/* Preview Table */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h4 className="text-sm font-medium text-gray-900">
                Sample Data (showing first 5 of {parsedData.length} records)
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Name
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Email
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Company
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Position
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {parsedData.slice(0, 5).map((recipient, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {recipient.name}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {recipient.email}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {recipient.company || "-"}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {recipient.position || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsedData.length > 5 && (
              <div className="px-4 py-2 bg-gray-50 text-center text-sm text-gray-500">
                ... and {parsedData.length - 5} more recipients
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={handleConfirmAdd}
              disabled={parsedData.length === 0}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Add {canSendCount} Recipients
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center"
            >
              <X className="w-4 h-4 mr-1" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Results Message */}
      {uploadResults && (
        <div
          className={`p-4 rounded-lg ${
            uploadResults.success
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center">
            {uploadResults.success ? (
              <CheckCircle className="w-5 h-5 mr-2" />
            ) : (
              <AlertCircle className="w-5 h-5 mr-2" />
            )}
            <span className="text-sm font-medium">{uploadResults.message}</span>
          </div>
        </div>
      )}

      {/* Format Guide */}
      <div className="bg-gray-50 rounded-lg p-3">
        <h4 className="text-sm font-medium text-gray-900 mb-2">
          Required CSV Format:
        </h4>
        <div className="text-xs text-gray-600 space-y-1">
          <div>
            • <span className="font-medium">Email</span> column (required)
          </div>
          <div>
            • <span className="font-medium">Name</span> column (optional)
          </div>
          <div>
            • <span className="font-medium">Company</span> column (optional)
          </div>
          <div>
            • <span className="font-medium">Position</span> column (optional)
          </div>
          <div className="text-gray-500 mt-2">
            💡 Column names are flexible: "Email", "email", "EMAIL", "Email
            Address" all work
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkUpload;
