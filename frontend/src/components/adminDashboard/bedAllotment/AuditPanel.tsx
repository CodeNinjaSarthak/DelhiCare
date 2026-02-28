import { useEffect, useState } from "react";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface AuditEntry {
  _id: string;
  action: string;
  metadata: Record<string, any>;
  createdAt: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  hospitalId: string;
  patientId: string;
}

const ACTION_LABELS: Record<string, string> = {
  PATIENT_ADMITTED:        "Admitted to bed",
  PATIENT_QUEUED:          "Placed in waiting queue",
  QUEUE_AUTO_ALLOCATED:    "Allocated from queue",
  PATIENT_DISCHARGED:      "Discharged",
  BED_REQUEST_APPROVED:    "Bed request approved",
  BED_REQUEST_REJECTED:    "Bed request rejected",
  QUEUE_ENTRY_CANCELLED:   "Queue entry cancelled (auto)",
  QUEUE_MANUALLY_CANCELLED:"Queue entry cancelled (manual)",
};

const ACTION_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PATIENT_ADMITTED:        "secondary",
  PATIENT_QUEUED:          "outline",
  QUEUE_AUTO_ALLOCATED:    "secondary",
  PATIENT_DISCHARGED:      "destructive",
  BED_REQUEST_APPROVED:    "secondary",
  BED_REQUEST_REJECTED:    "destructive",
  QUEUE_ENTRY_CANCELLED:   "outline",
  QUEUE_MANUALLY_CANCELLED:"outline",
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

function MetaPreview({ metadata }: { metadata: Record<string, any> }) {
  const entries = Object.entries(metadata).filter(([k]) => k !== "__v");
  if (entries.length === 0) return null;
  return (
    <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
      {entries.map(([k, v]) => (
        <div key={k}>
          <span className="font-medium">{k}:</span>{" "}
          <span>{String(v).slice(0, 40)}</span>
        </div>
      ))}
    </div>
  );
}

export default function AuditPanel({ open, onClose, hospitalId, patientId }: Props) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !patientId) return;
    setLoading(true);
    axios
      .get(`/api/v1/audit?hospitalId=${hospitalId}&patientId=${patientId}&limit=50`, {
        withCredentials: true,
      })
      .then(({ data }) => {
        if (data.success) setEntries(data.data);
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [open, hospitalId, patientId]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Patient Audit History</DialogTitle>
        </DialogHeader>

        {loading && (
          <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
        )}

        {!loading && entries.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No audit records found.</p>
        )}

        {!loading && entries.length > 0 && (
          <div className="relative pl-6 border-l border-muted space-y-6 mt-2">
            {entries.map((entry) => (
              <div key={entry._id} className="relative">
                {/* Timeline dot */}
                <span className="absolute -left-[1.45rem] top-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />

                <div className="flex items-start justify-between gap-2">
                  <Badge variant={ACTION_COLORS[entry.action] ?? "outline"} className="text-xs">
                    {ACTION_LABELS[entry.action] ?? entry.action}
                  </Badge>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatRelativeTime(entry.createdAt)}
                  </span>
                </div>

                <MetaPreview metadata={entry.metadata ?? {}} />
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
