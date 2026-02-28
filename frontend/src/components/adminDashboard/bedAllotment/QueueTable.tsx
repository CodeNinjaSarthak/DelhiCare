import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { io } from "socket.io-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Patient {
  _id: string;
  name: string;
}

interface QueueEntry {
  _id: string;
  patientId: Patient;
  department: string;
  score: number;
  status: string;
  createdAt: string;
}

const DEPARTMENTS = ["ICU", "General", "Emergency"] as const;
type Dept = (typeof DEPARTMENTS)[number];

function formatWaitTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

interface QueueTableInnerProps {
  hospitalId: string;
  department: Dept;
  onQueueChange: () => void;
}

function DeptQueue({ hospitalId, department, onQueueChange }: QueueTableInnerProps) {
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchQueue = useCallback(
    async (p = 1) => {
      try {
        const { data } = await axios.get(
          `/api/v1/hospital/queue?department=${department}&page=${p}&limit=20`,
          { withCredentials: true }
        );
        if (data.success) {
          setEntries(data.data);
          setTotalPages(data.totalPages);
          setPage(data.page);
        }
      } catch {
        toast.error(`Failed to load ${department} queue`);
      }
    },
    [department]
  );

  useEffect(() => {
    fetchQueue(1);
  }, [fetchQueue]);

  const handleCancel = async (queueId: string) => {
    try {
      await axios.delete(`/api/v1/hospital/queue/${queueId}`, {
        withCredentials: true,
      });
      toast.success("Queue entry cancelled");
      setEntries((prev) => prev.filter((e) => e._id !== queueId));
      onQueueChange();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Cancel failed");
    }
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Patient</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Wait Time</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                No patients waiting in {department}
              </TableCell>
            </TableRow>
          )}
          {entries.map((e) => (
            <TableRow key={e._id}>
              <TableCell className="font-medium">
                {e.patientId?.name ?? "—"}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{e.score}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatWaitTime(e.createdAt)}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCancel(e._id)}
                >
                  Cancel
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4 text-sm text-muted-foreground">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => fetchQueue(page - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => fetchQueue(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

interface QueueTableProps {
  hospitalId: string;
}

export default function QueueTable({ hospitalId }: QueueTableProps) {
  const [activeDept, setActiveDept] = useState<Dept>("ICU");
  const [refreshKey, setRefreshKey] = useState(0);

  // Re-render on socket events
  useEffect(() => {
    const socket = io("http://localhost:4000", { withCredentials: true });
    socket.emit("joinHospital", hospitalId);

    const refresh = () => setRefreshKey((k) => k + 1);
    socket.on("queuePatientAdmitted", refresh);
    socket.on("bedAllotmentResponse", refresh);

    return () => { socket.disconnect(); };
  }, [hospitalId]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Waiting Queue</CardTitle>
          <CardDescription>
            Patients waiting for bed allocation, sorted by priority score.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Department Tabs */}
          <div className="flex gap-2 mb-6">
            {DEPARTMENTS.map((dept) => (
              <Button
                key={dept}
                size="sm"
                variant={activeDept === dept ? "default" : "outline"}
                onClick={() => setActiveDept(dept)}
              >
                {dept}
              </Button>
            ))}
          </div>

          <DeptQueue
            key={`${activeDept}-${refreshKey}`}
            hospitalId={hospitalId}
            department={activeDept}
            onQueueChange={() => setRefreshKey((k) => k + 1)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
