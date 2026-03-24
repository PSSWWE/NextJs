"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { Menu, Bell, Maximize2, Minimize2, Search, Upload, Package } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import BulkUploadModal from "./BulkUploadModal";

const PUBLIC_TOOLS_ADMIN_EMAIL = "mohidfaisal321@gmail.com";

interface DecodedToken {
  email?: string;
}

const Navbar = ({
  onToggleSidebar,
  isSidebarOpen,
}: {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}) => {
  const pathname = usePathname();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  // Default true to match server (public tools off until DB says otherwise)
  const [publicToolsDisabled, setPublicToolsDisabled] = useState(true);
  const [showPublicToolsToggle, setShowPublicToolsToggle] = useState(false);

  // Check if fullscreen is supported
  const isFullscreenSupported = typeof document !== 'undefined' && 
    (document.fullscreenEnabled || 
     (document as any).webkitFullscreenEnabled || 
     (document as any).mozFullScreenEnabled || 
     (document as any).msFullscreenEnabled);

  // Toggle fullscreen
  const toggleFullscreen = async () => {
    try {
      if (!isFullscreen) {
        // Enter fullscreen
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if ((document.documentElement as any).webkitRequestFullscreen) {
          await (document.documentElement as any).webkitRequestFullscreen();
        } else if ((document.documentElement as any).mozRequestFullScreen) {
          await (document.documentElement as any).mozRequestFullScreen();
        } else if ((document.documentElement as any).msRequestFullscreen) {
          await (document.documentElement as any).msRequestFullscreen();
        }
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      ));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Who may change the global flag (UI only; protect POST in production via API auth if needed)
  useEffect(() => {
    const token = Cookies.get("token");
    if (!token) return;
    try {
      const decoded = jwtDecode<DecodedToken>(token);
      const email = (decoded.email || "").trim().toLowerCase();
      setShowPublicToolsToggle(email === PUBLIC_TOOLS_ADMIN_EMAIL.toLowerCase());
    } catch {
      setShowPublicToolsToggle(false);
    }
  }, []);

  // Load public tools toggle from server (global for all users)
  useEffect(() => {
    const loadFlag = async () => {
      try {
        const res = await fetch("/api/public-tools", {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        setPublicToolsDisabled(!!data?.disabled);
      } catch (e) {
        console.error("Failed to load public tools flag", e);
      }
    };
    loadFlag();
  }, []);

  const handleTogglePublicTools = async () => {
    const prev = publicToolsDisabled;
    const next = !prev;
    setPublicToolsDisabled(next);
    try {
      const res = await fetch("/api/public-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ disabled: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPublicToolsDisabled(prev);
        console.error("Failed to update public tools flag", data?.error || res.status);
        return;
      }
      setPublicToolsDisabled(!!data?.disabled);
    } catch (e) {
      setPublicToolsDisabled(prev);
      console.error("Failed to update public tools flag", e);
    }
  };

  return (
    <header className="w-full h-16 bg-white dark:bg-card border-b border-gray-200 dark:border-zinc-700 px-6 flex items-center justify-between shadow-sm z-50 transition-all duration-300 ease-in-out">
      {/* Left section */}
      <div className="flex items-center gap-4 relative">
        <button
          onClick={onToggleSidebar}
          className={`text-gray-700 dark:text-gray-300 hover:text-gray-900 text-2xl focus:outline-none transition-transform duration-300 ${
            isSidebarOpen ? "rotate-0" : "rotate-90"
          }`}
        >
          <Menu className="w-6 h-6" />
        </button>

        <Link
          href="/dashboard"
          className={`transition-all duration-300 ease-in-out ${
            isSidebarOpen
              ? "opacity-100 translate-x-0"
              : "opacity-0 -translate-x-4 pointer-events-none"
          }`}
        >
          <img 
            src="/logo_final.png" 
            alt="PSS Logo" 
            className="h-14 w-auto object-contain"
          />
        </Link>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-6">
        {/* Tracking Page */}
        <Link
          href="/tracking"
          className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors duration-200 bg-linear-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700"
          title="Track Shipment"
        >
          <Package className="w-5 h-5" />
          <span className="text-sm font-medium">Tracking</span>
        </Link>

        {/* Remote Area Lookup */}
        <Link
          href="/dashboard/remote-area-lookup"
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors duration-200 bg-linear-to-r from-purple-500 to-pink-600 text-white hover:from-purple-600 hover:to-pink-700 ${
            pathname.startsWith("/dashboard/remote-area-lookup")
              ? "ring-2 ring-purple-300 dark:ring-purple-700"
              : ""
          }`}
          title="Remote Area Lookup"
        >
          <Search className="w-5 h-5" />
          <span className="text-sm font-medium">Remote Area Lookup</span>
        </Link>

        {showPublicToolsToggle && (
          <button
            type="button"
            onClick={() => void handleTogglePublicTools()}
            className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors duration-200 ${
              publicToolsDisabled
                ? "border-red-400 text-red-600 bg-red-50"
                : "border-emerald-400 text-emerald-700 bg-emerald-50"
            }`}
            title="Toggle public tools availability for all visitors"
          >
            {publicToolsDisabled ? "Public tools OFF" : "Public tools ON"}
          </button>
        )}

        {/* Fullscreen button */}
        {isFullscreenSupported && (
          <button
            onClick={toggleFullscreen}
            className="text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100 transition-colors duration-200 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-5 h-5" />
            ) : (
              <Maximize2 className="w-5 h-5" />
            )}
          </button>
        )}

        {/* Notification button */}
        <button className="relative text-gray-500 dark:text-gray-300 hover:text-gray-700 transition">
          <Bell className="w-6 h-6" />
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
            1
          </span>
        </button>

        {/* Theme toggle */}
        <ThemeToggle />
      </div>

      {/* Bulk Upload Modal (triggered elsewhere, kept mounted for now) */}
      <BulkUploadModal
        isOpen={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
      />
    </header>
  );
};

export default Navbar;
