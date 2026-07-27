"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Map, Loader2, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isRegistering) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Registrazione completata! Verifica la tua email se richiesto, o effettua il login.");
        setIsRegistering(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Accesso effettuato con successo!");
        router.push("/dashboard");
      }
    } catch (error: any) {
      toast.error(error.message || "Si è verificato un errore");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        <div className="bg-rose-600 px-6 py-8 text-center text-white">
          <Link href="/" className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4 hover:bg-white/30 transition">
            <Map className="w-8 h-8 text-white" />
          </Link>
          <h2 className="text-2xl font-bold font-serif mb-1">X-PM property manager</h2>
          <p className="text-rose-100 text-sm">
            {isRegistering ? "Unisciti alla nostra piattaforma" : "Bentornato! Effettua l'accesso per continuare"}
          </p>
        </div>

        <div className="p-8">
          <form onSubmit={handleAuth} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border-gray-300 border px-4 py-3 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition"
                placeholder="nome@agenzia.com"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full border-gray-300 border px-4 py-3 pr-12 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isRegistering ? "Registrati" : "Accedi")}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            {isRegistering ? "Hai già un account?" : "Non hai un account?"}{" "}
            <button 
              type="button" 
              onClick={() => setIsRegistering(!isRegistering)}
              className="font-bold text-rose-600 hover:underline"
            >
              {isRegistering ? "Accedi" : "Registrati ora"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
