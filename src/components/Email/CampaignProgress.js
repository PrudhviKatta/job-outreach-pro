// CampaignProgress.js - Simple campaign status display
import {
  CheckCircle,
  XCircle,
  Clock,
  StopCircle,
  RefreshCw,
} from "lucide-react";
import Button from "@/components/UI/Button";

export default function CampaignProgress({
  status,
  progress,
  onStop,
  onReset,
}) {
  const getStatusConfig = () => {
    switch (status) {
      case "sending":
        return {
          icon: Clock,
          color: "blue",
          title: "Campaign Running",
          description: "Sending emails in the background...",
        };
      case "completed":
        return {
          icon: CheckCircle,
          color: "green",
          title: "Campaign Completed",
          description: "All emails have been processed",
        };
      case "failed":
        return {
          icon: XCircle,
          color: "red",
          title: "Campaign Failed",
          description: "Campaign encountered an error",
        };
      case "stopped":
        return {
          icon: StopCircle,
          color: "yellow",
          title: "Campaign Stopped",
          description: "Campaign was manually stopped",
        };
      default:
        return {
          icon: Clock,
          color: "gray",
          title: "Unknown Status",
          description: "Status unknown",
        };
    }
  };

  const config = getStatusConfig();
  const StatusIcon = config.icon;
  const progressPercentage =
    progress.total > 0
      ? ((progress.sent + progress.failed) / progress.total) * 100
      : 0;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className={`p-2 rounded-full bg-${config.color}-100 mr-3`}>
            <StatusIcon className={`w-6 h-6 text-${config.color}-600`} />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{config.title}</h2>
            <p className="text-sm text-gray-600">{config.description}</p>
          </div>
        </div>

        {status === "sending" && (
          <div className="animate-spin">
            <RefreshCw className="w-5 h-5 text-blue-600" />
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span>Progress</span>
          <span>
            {progress.sent + progress.failed}/{progress.total} processed
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              status === "completed"
                ? "bg-green-600"
                : status === "failed"
                ? "bg-red-600"
                : "bg-blue-600"
            }`}
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {progressPercentage.toFixed(1)}% complete
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">
            {progress.sent}
          </div>
          <div className="text-sm text-green-700">Sent</div>
        </div>
        <div className="text-center p-3 bg-red-50 rounded-lg">
          <div className="text-2xl font-bold text-red-600">
            {progress.failed}
          </div>
          <div className="text-sm text-red-700">Failed</div>
        </div>
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">
            {progress.pending}
          </div>
          <div className="text-sm text-blue-700">Pending</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex space-x-3">
        {status === "sending" && (
          <Button onClick={onStop} variant="danger" className="flex-1">
            <StopCircle className="w-4 h-4 mr-2" />
            Stop Campaign
          </Button>
        )}

        {(status === "completed" ||
          status === "failed" ||
          status === "stopped") && (
          <Button onClick={onReset} className="flex-1">
            <RefreshCw className="w-4 h-4 mr-2" />
            Start New Campaign
          </Button>
        )}
      </div>

      {/* Campaign Info */}
      {status === "sending" && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            💡 Campaign is running in the background. You can safely close this
            page and check back later.
          </p>
        </div>
      )}
    </div>
  );
}
