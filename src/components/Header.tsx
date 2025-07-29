import { useAuth } from "@/auth/AuthContext";

export default function Header() {
  const { user, logout } = useAuth();
  return (
    <header className="bg-white shadow flex justify-between items-center px-4 py-4 md:px-8 md:ml-64">
      <div />
      <div className="flex items-center gap-4">
        <span className="font-semibold text-blue-900 text-sm md:text-base">
          {user?.username} ({user?.role})
        </span>
        <button
          onClick={logout}
          className="px-4 py-1 rounded-xl bg-primary text-white hover:bg-blue-800 transition text-sm md:text-base"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
