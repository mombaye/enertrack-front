// src/layouts/MainLayout.tsx
import { Outlet } from "react-router-dom";
import Sidebar from "@/layouts/Sidebar";

export default function MainLayout() {
  return (
    <div style={{ minHeight: "100vh", background: "#f6f8fa" }}>
      {/* Fonts used across the app */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap');

        :root {
          --sbw: 272px;
          --brand-blue:   #003c71;
          --brand-orange: #003c71;
        }

        /* Smooth sidebar width transition on main */
        .main-area {
          margin-left: var(--sbw);
          transition: margin-left .22s cubic-bezier(.4,0,.2,1);
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        @media (max-width: 767px) {
          .main-area { margin-left: 0 !important; }
        }

        /* Subtle page content background */
        .page-content {
          flex: 1;
          padding: 24px 28px;
          background: #f6f8fa;
        }

        @media (max-width: 767px) {
          /* Sans le Header, le hamburger flottant de la Sidebar (top:14, ~38px,
             visible sous le breakpoint md de Tailwind = 768px) a besoin d'espace
             réservé pour ne pas chevaucher le contenu. */
          .page-content { padding: 64px 16px 24px; }
        }

        /* Scrollbar styling */
        * { scrollbar-width: thin; scrollbar-color: rgba(0,60,113,.15) transparent; }
        *::-webkit-scrollbar { width: 5px; height: 5px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background: rgba(0,60,113,.15); border-radius: 10px; }
        *::-webkit-scrollbar-thumb:hover { background: rgba(0,60,113,.28); }
      `}</style>

      <Sidebar />

      <div className="main-area">
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}