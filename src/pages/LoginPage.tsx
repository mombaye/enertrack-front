import { useForm } from "react-hook-form";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import camusatLogo from "@/assets/images/camusat-logo.png";
import { loginUser } from "@/services/authService";
import { toast } from "react-toastify";
import { useAuth } from "@/auth/AuthContext";
// SVG inline
function EnergySVG() {
  return (
    <svg width="170" height="170" viewBox="0 0 170 170" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="85" cy="85" r="80" fill="#eaf1fc" />
      <rect x="75" y="60" width="20" height="50" rx="5" fill="#0c295a" />
      <rect x="82" y="40" width="6" height="30" rx="2" fill="#3774c2" />
      <line x1="85" y1="40" x2="65" y2="20" stroke="#3774c2" strokeWidth="3" />
      <line x1="85" y1="40" x2="105" y2="20" stroke="#3774c2" strokeWidth="3" />
      <rect x="50" y="110" width="40" height="15" rx="3" fill="#1976d2" />
      <rect x="54" y="114" width="32" height="7" rx="2" fill="#bbdefb" />
      <polyline points="115,105 130,85 120,85 135,65" fill="none" stroke="#fbbc04" strokeWidth="7" strokeLinejoin="round" />
    </svg>
  );
}

export default function LoginPage() {
  const { register, handleSubmit, formState: { errors } } = useForm();
  
  const { login } = useAuth();
  console.log("DEBUG useAuth() :", useAuth());
  const navigate = useNavigate();

  const onSubmit = async (data: any) => {
    try {
      
    
      const res = await loginUser(data.username, data.password);
      login(res.access, res.refresh);
      navigate("/dashboard");
    } catch (err: any) {
      console.error("Login error:", err);
      // Axios retourne l’erreur dans err.response.data.detail ou err.message
      let msg = "Erreur inconnue";
      if (err.response) {
        msg = err.response.data?.detail || "Identifiants invalides !";
      } else if (err.message) {
        msg = err.message;
      }
      toast.error(msg, { autoClose: 4000 });
    }
};

  return (
    <div className="min-h-screen flex flex-col md:flex-row justify-center items-center bg-gradient-to-tr from-blue-900 to-blue-400">
      {/* Bloc SVG à gauche sur desktop */}
      <div className="hidden md:flex flex-col items-center justify-center mr-12">
        <EnergySVG />
        <span className="text-blue-100 font-semibold mt-4 text-center">Plateforme Energie Analysis</span>
      </div>
      {/* Formulaire connexion */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white shadow-2xl rounded-2xl p-8 flex flex-col gap-6 w-[90vw] max-w-[350px]"
      >
        <img src={camusatLogo} alt="Logo Camusat" className="w-28 mx-auto mb-2" />
        <input
          className="border rounded-xl px-4 py-2 text-lg"
          placeholder="Nom d'utilisateur"
          {...register("username", { required: true })}
        />
        <input
          className="border rounded-xl px-4 py-2 text-lg"
          type="password"
          placeholder="Mot de passe"
          {...register("password", { required: true })}
        />
        <button className="bg-primary text-white font-semibold rounded-xl py-2 mt-2 hover:bg-blue-800 transition">
          Se connecter
        </button>
        {errors.username && <span className="text-red-600">Identifiant requis</span>}
        {errors.password && <span className="text-red-600">Mot de passe requis</span>}
      </form>
    </div>
  );
}
