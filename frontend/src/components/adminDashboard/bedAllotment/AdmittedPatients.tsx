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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import AuditPanel from "./AuditPanel";

interface Patient {
  _id: string;
  name: string;
  contactNumber: string;
}

interface Admission {
  _id: string;
  patientId: Patient;
  department: string;
  bedId: { _id: string } | string;
  status: string;
  createdAt: string;
}

interface Props {
  hospitalId: string;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdmittedPatients({ hospitalId }: Props) {
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [auditPatientId, setAuditPatientId] = useState<string | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);

  const fetchAdmissions = useCallback(async (p = 1) => {
    try {
      const { data } = await axios.get(
        `/api/v1/hospital/patients?status=Admitted&page=${p}&limit=20`,
        { withCredentials: true }
      );
      if (data.success) {
        setAdmissions(data.data);
        setTotalPages(data.totalPages);
        setPage(data.page);
      }
    } catch {
      toast.error("Failed to load admitted patients");
    }
  }, []);

  useEffect(() => {
    fetchAdmissions(1);
  }, [fetchAdmissions]);

  // React to socket events
  useEffect(() => {
    const socket = io("http://localhost:4000", { withCredentials: true });
    socket.emit("joinHospital", hospitalId);

    socket.on("patientDischarged", ({ admissionId }: { admissionId: string }) => {
      setAdmissions((prev) => prev.filter((a) => a._id !== admissionId));
    });
    socket.on("queuePatientAdmitted", () => fetchAdmissions(page));
    socket.on("bedAllotmentResponse", () => fetchAdmissions(page));

    return () => { socket.disconnect(); };
  }, [hospitalId, page, fetchAdmissions]);

  const handleDischarge = async (admissionId: string) => {
    try {
      await axios.patch(
        `/api/v1/hospital/discharge/${admissionId}`,
        {},
        { withCredentials: true }
      );
      toast.success("Patient discharged successfully");
      setAdmissions((prev) => prev.filter((a) => a._id !== admissionId));
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Discharge failed");
    }
  };

  const openAudit = (patientId: string) => {
    setAuditPatientId(patientId);
    setAuditOpen(true);
  };

  const bedId = (a: Admission) =>
    typeof a.bedId === "object" ? a.bedId._id : a.bedId;

  return (
    <>
      <Card>
        <CardHeader className="px-7">
          <CardTitle>Admitted Patients</CardTitle>
          <CardDescription>Currently admitted patients in your hospital.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead className="hidden sm:table-cell">Department</TableHead>
                <TableHead className="hidden sm:table-cell">Bed</TableHead>
                <TableHead className="hidden md:table-cell">Admitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admissions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No admitted patients
                  </TableCell>
                </TableRow>
              )}
              {admissions.map((a) => (
                <TableRow
                  key={a._id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openAudit(a.patientId._id)}
                >
                  <TableCell>
                    <div className="font-medium">{a.patientId?.name ?? "—"}</div>
                    <div className="hidden text-sm text-muted-foreground md:inline">
                      {a.patientId?.contactNumber ?? ""}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="secondary">{a.department}</Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                    {bedId(a).toString().slice(-6)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {formatRelativeTime(a.createdAt)}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive">Discharge</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Discharge patient?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will discharge{" "}
                            <strong>{a.patientId?.name}</strong> from the{" "}
                            {a.department} department. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDischarge(a._id)}>
                            Discharge
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4 text-sm text-muted-foreground">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => fetchAdmissions(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => fetchAdmissions(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {auditPatientId && (
        <AuditPanel
          open={auditOpen}
          onClose={() => setAuditOpen(false)}
          hospitalId={hospitalId}
          patientId={auditPatientId}
        />
      )}
    </>
  );
}
