import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import axios from "axios";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

type Role = "hospital" | "patient";

// ── Patient form ─────────────────────────────────────────────────────────────

function PatientForm({ onSuccess }: { onSuccess: () => void }) {
  const [data, setData] = useState({
    name: "",
    email: "",
    contactNumber: "",
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setData((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (data.password !== data.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setIsLoading(true);
    try {
      await axios.post(
        "/api/v1/user/verify-otp",
        {
          name: data.name,
          email: data.email,
          contactNumber: data.contactNumber,
          password: data.password,
        },
        { withCredentials: true }
      );
      toast.success("Account created successfully");
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Full Name</Label>
        <Input id="name" placeholder="John Doe" value={data.name} onChange={set("name")} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="m@example.com" value={data.email} onChange={set("email")} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="contactNumber">Mobile Number</Label>
        <Input id="contactNumber" type="tel" placeholder="9876543210" value={data.contactNumber} onChange={set("contactNumber")} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" placeholder="••••••••" value={data.password} onChange={set("password")} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <Input id="confirmPassword" type="password" placeholder="••••••••" value={data.confirmPassword} onChange={set("confirmPassword")} required />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Creating account..." : "Create Account"}
      </Button>
    </form>
  );
}

// ── Hospital form ─────────────────────────────────────────────────────────────

function HospitalForm({ onSuccess }: { onSuccess: () => void }) {
  const [data, setData] = useState({
    name: "",
    registrationNumber: "",
    email: "",
    contactNumber: "",
    password: "",
    confirmPassword: "",
    street: "",
    locality: "",
    city: "Delhi",
    pinCode: "",
    latitude: "",
    longitude: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setData((prev) => ({ ...prev, [field]: e.target.value }));

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setData((prev) => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        setLocating(false);
        toast.success("Location detected");
      },
      () => {
        toast.error("Could not get location. Enter manually.");
        setLocating(false);
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (data.password !== data.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (!data.latitude || !data.longitude) {
      toast.error("Please provide hospital location");
      return;
    }
    setIsLoading(true);
    try {
      await axios.post(
        "/api/v1/hospital/register",
        {
          name: data.name,
          registrationNumber: data.registrationNumber,
          email: data.email,
          password: data.password,
          contactNumber: data.contactNumber,
          address: {
            street: data.street,
            locality: data.locality,
            city: data.city,
            pinCode: data.pinCode,
          },
          location: {
            coordinates: [parseFloat(data.longitude), parseFloat(data.latitude)],
          },
        },
        { withCredentials: true }
      );
      toast.success("Hospital registered successfully");
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      {/* Basic info */}
      <div className="grid gap-2">
        <Label htmlFor="name">Hospital Name</Label>
        <Input id="name" placeholder="City Hospital" value={data.name} onChange={set("name")} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="registrationNumber">Registration Number</Label>
        <Input id="registrationNumber" placeholder="REG-12345" value={data.registrationNumber} onChange={set("registrationNumber")} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="admin@hospital.com" value={data.email} onChange={set("email")} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="contactNumber">Contact Number</Label>
        <Input id="contactNumber" type="tel" placeholder="9876543210" value={data.contactNumber} onChange={set("contactNumber")} required />
      </div>

      {/* Password */}
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" placeholder="••••••••" value={data.password} onChange={set("password")} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <Input id="confirmPassword" type="password" placeholder="••••••••" value={data.confirmPassword} onChange={set("confirmPassword")} required />
      </div>

      {/* Address */}
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">Address</p>
      <div className="grid gap-2">
        <Label htmlFor="street">Street</Label>
        <Input id="street" placeholder="123 Main St" value={data.street} onChange={set("street")} required />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          <Label htmlFor="locality">Locality</Label>
          <Input id="locality" placeholder="Connaught Place" value={data.locality} onChange={set("locality")} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" value="Delhi" readOnly className="bg-gray-100 cursor-not-allowed" />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="pinCode">Pin Code</Label>
        <Input id="pinCode" placeholder="110001" value={data.pinCode} onChange={set("pinCode")} required />
      </div>

      {/* Location */}
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">Location (GPS)</p>
      <Button type="button" variant="outline" onClick={useMyLocation} disabled={locating} className="w-full">
        {locating ? "Detecting..." : "Use My Location"}
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          <Label htmlFor="latitude">Latitude</Label>
          <Input id="latitude" placeholder="28.6139" value={data.latitude} onChange={set("latitude")} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="longitude">Longitude</Label>
          <Input id="longitude" placeholder="77.2090" value={data.longitude} onChange={set("longitude")} required />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Registering..." : "Register Hospital"}
      </Button>
    </form>
  );
}

// ── Main Signup page ──────────────────────────────────────────────────────────

export default function Signup() {
  const [role, setRole] = useState<Role>("hospital");
  const navigate = useNavigate();

  const handleSuccess = () => {
    navigate("/login");
  };

  return (
    <div className="w-full bg-stone-200 lg:grid lg:grid-cols-2 min-h-screen">
      <div className="flex items-start justify-center py-12 px-4">
        <div className="mx-auto w-full max-w-[420px] grid gap-6">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-bold">Sign Up</h1>
            <p className="text-balance text-muted-foreground">
              Create your account
            </p>
          </div>

          {/* Role toggle */}
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              type="button"
              onClick={() => setRole("hospital")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                role === "hospital"
                  ? "bg-neutral-900 text-white"
                  : "bg-white text-neutral-700 hover:bg-gray-100"
              }`}
            >
              Hospital
            </button>
            <button
              type="button"
              onClick={() => setRole("patient")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                role === "patient"
                  ? "bg-neutral-900 text-white"
                  : "bg-white text-neutral-700 hover:bg-gray-100"
              }`}
            >
              Patient
            </button>
          </div>

          {role === "hospital" ? (
            <HospitalForm onSuccess={handleSuccess} />
          ) : (
            <PatientForm onSuccess={handleSuccess} />
          )}

          <div className="text-center text-sm">
            Already have an account?{" "}
            <Link to="/login" className="underline">
              Log in
            </Link>
          </div>
        </div>
      </div>

      <div className="hidden bg-muted lg:block lg:sticky lg:top-0 lg:h-screen">
        <img
          src="https://i.imgur.com/ETkShrX.jpg"
          alt="Image"
          width="1920"
          height="1080"
          className="h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
    </div>
  );
}
