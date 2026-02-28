import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import axios from "axios";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

type Role = "hospital" | "patient";

export default function Login() {
  const [role, setRole] = useState<Role>("hospital");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const endpoint =
      role === "hospital"
        ? "/api/v1/hospital/login"
        : "/api/v1/user/login";

    try {
      await axios.post(endpoint, { email, password }, { withCredentials: true });
      toast.success("Logged in successfully");
      navigate(role === "hospital" ? "/dashboard/bedAllotment" : "/patientDashboard/overview");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full bg-stone-200 lg:grid lg:min-h-[600px] lg:grid-cols-2 xl:min-h-[800px]">
      <div className="flex items-center justify-center py-12">
        <div className="mx-auto grid w-[350px] gap-6">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-bold">Login</h1>
            <p className="text-balance text-muted-foreground">
              Select your account type and sign in
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

          <form onSubmit={handleLogin} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </form>

          <div className="text-center text-sm">
            Don't have an account?{" "}
            <Link to="/sign-up" className="underline">
              Sign up
            </Link>
          </div>
        </div>
      </div>

      <div className="hidden bg-muted lg:block">
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
