import { Bed, HeartPulse, AlertCircle, CheckCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Barchart } from "../charts/barChart";
import BedRequest from "./bedRequest";
import { BarAllotment } from "../charts/barAllotment";
import AllotmentRecord from "./allotmentRecord";
import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { io } from "socket.io-client";

interface DeptOccupancy {
  total: number;
  occupied: number;
  available: number;
  rate: number;
}

interface Metrics {
  occupancy: Record<string, DeptOccupancy>;
  queueLength: Record<string, number>;
  admissionsToday: number;
  avgAllocationTimeMinutes: number | null;
  dischargesToday: number;
}

function getRateColor(rate: number): string {
  if (rate < 0.7) return "text-green-600";
  if (rate < 0.9) return "text-yellow-600";
  return "text-red-600";
}

interface BedCardProps {
  title: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  occupied: number;
  total: number;
  rate: number;
}

function BedCard({ title, Icon, occupied, total, rate }: BedCardProps) {
  const colorClass = getRateColor(rate);
  return (
    <Card className="transition-transform transform hover:scale-105 duration-300 ease-in-out">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${colorClass}`}>
          {total > 0 ? `${occupied}/${total}` : "N/A"}
        </div>
        <p className="text-xs text-muted-foreground">
          {total > 0
            ? `${Math.round(rate * 100)}% occupied — ${total - occupied} available`
            : "No beds configured"}
        </p>
      </CardContent>
    </Card>
  );
}

export function BedAllotment() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [hospitalId, setHospitalId] = useState<string | null>(null);

  // Fetch current hospital identity once
  useEffect(() => {
    axios
      .get("/api/v1/hospital/me", { withCredentials: true })
      .then(({ data }) => {
        if (data.success) setHospitalId(data.data._id);
      })
      .catch(() => {});
  }, []);

  const fetchMetrics = useCallback(async () => {
    if (!hospitalId) return;
    try {
      const { data } = await axios.get(
        `/api/v1/dashboard/metrics?hospitalId=${hospitalId}`,
        { withCredentials: true }
      );
      if (data.success) setMetrics(data.data);
    } catch (_) {
      // non-critical
    }
  }, [hospitalId]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Re-fetch reactively on socket events
  useEffect(() => {
    if (!hospitalId) return;
    const socket = io("http://localhost:4000", { withCredentials: true });
    socket.emit("joinHospital", hospitalId);

    const refresh = () => fetchMetrics();
    socket.on("patientDischarged",    refresh);
    socket.on("queuePatientAdmitted", refresh);
    socket.on("bedAllotmentResponse", refresh);

    return () => { socket.disconnect(); };
  }, [hospitalId, fetchMetrics]);

  // Compute totals
  const totalOccupied = metrics
    ? Object.values(metrics.occupancy).reduce((s, d) => s + d.occupied, 0)
    : 0;
  const totalBeds = metrics
    ? Object.values(metrics.occupancy).reduce((s, d) => s + d.total, 0)
    : 0;

  const bedStats = metrics
    ? Object.entries(metrics.occupancy).map(([dept, d]) => ({
        label: dept,
        value: d.occupied,
      }))
    : [];

  const deptCards = [
    { title: "ICU Beds",       Icon: HeartPulse, dept: "ICU" },
    { title: "Emergency Beds", Icon: AlertCircle, dept: "Emergency" },
    { title: "General Beds",   Icon: Bed,         dept: "General" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Bed Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:col-span-12">
        {deptCards.map(({ title, Icon, dept }) => {
          const d = metrics?.occupancy[dept];
          return (
            <div className="col-span-1" key={title}>
              <BedCard
                title={title}
                Icon={Icon}
                occupied={d?.occupied ?? 0}
                total={d?.total ?? 0}
                rate={d?.rate ?? 0}
              />
            </div>
          );
        })}
        {/* Total card */}
        <div className="col-span-1">
          <BedCard
            title="Total Beds"
            Icon={CheckCircle}
            occupied={totalOccupied}
            total={totalBeds}
            rate={totalBeds > 0 ? totalOccupied / totalBeds : 0}
          />
        </div>
      </div>

      {/* Graph section */}
      <div className="col-span-1 sm:col-span-2 lg:col-span-6">
        <Barchart chartData={bedStats} />
      </div>

      {/* Bed Request section */}
      <div className="col-span-1 sm:col-span-2 lg:col-span-6">
        <BedRequest />
      </div>

      {/* Bar Allotment section */}
      <div className="col-span-1 sm:col-span-2 lg:col-span-12">
        <BarAllotment chartData={[]} />
      </div>

      {/* Allotment Record section */}
      <div className="col-span-1 sm:col-span-2 lg:col-span-12">
        <AllotmentRecord />
      </div>
    </div>
  );
}
