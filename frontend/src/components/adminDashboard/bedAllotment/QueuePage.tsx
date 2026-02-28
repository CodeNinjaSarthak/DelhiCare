import { useEffect, useState } from "react";
import axios from "axios";
import QueueTable from "./QueueTable";

export default function QueuePage() {
  const [hospitalId, setHospitalId] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get("/api/v1/hospital/me", { withCredentials: true })
      .then(({ data }) => { if (data.success) setHospitalId(data.data._id); })
      .catch(() => {});
  }, []);

  if (!hospitalId) {
    return <p className="p-6 text-muted-foreground">Loading…</p>;
  }

  return <QueueTable hospitalId={hospitalId} />;
}
