"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FaPhone,
  FaEnvelope,
  FaMapMarkerAlt,
  FaGlobe,
  FaChevronDown,
  FaYoutube,
  FaInstagram,
  FaTwitter,
  FaFacebookF,
  FaArrowRight,
  FaExternalLinkAlt,
  FaBars,
  FaTimes,
} from "react-icons/fa";

const PublicNavbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { href: "/#home", label: "Home" },
    { href: "/#about", label: "About us" },
    { href: "/#services", label: "Services" },
    { href: "/#contact", label: "Contact" },
    { href: "/auth/login", label: "Sign in" },
  ];

  // Offset for smooth scrolling to sections, matching the main navbar height
  const NAVBAR_OFFSET = 80;

  const handleSectionClick = (e: React.MouseEvent, href: string) => {
    if (pathname !== "/") return;
    if (href.startsWith("/#")) {
      e.preventDefault();
      const id = href.slice(2);
      const el = document.getElementById(id);
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - NAVBAR_OFFSET;
        window.scrollTo({ top, behavior: "smooth" });
      }
      setIsMenuOpen(false);
    }
  };

  const isActive = (href: string) => {
    if (href === "/" || href === "/#home") return pathname === "/";
    if (href.startsWith("/#")) return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Main Navigation Bar - white transparent overlay */}
      <div className="bg-white/50 border-b border-gray-200/50 backdrop-blur-sm">
        <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 sm:h-16 items-center justify-between gap-4">
            {/* Logo - smaller */}
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <img
                src="/logo_final.png"
                alt="PSS"
                className="h-9 sm:h-10 w-auto object-contain"
              />
            </Link>

            {/* Center - Nav links */}
            <nav className="hidden lg:flex items-center justify-center flex-1 gap-4 xl:gap-6 min-w-0">
              {navLinks.map((link) => (
                <Link
                  key={link.href + link.label}
                  href={link.href}
                  onClick={(e) => handleSectionClick(e, link.href)}
                  className={`shrink-0 px-1 py-2 text-sm xl:text-base font-medium text-slate-700 hover:text-slate-900 transition-colors ${
                    isActive(link.href) ? "text-slate-900" : ""
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Right - Track order link + Rate calculator button */}
            <div className="hidden lg:flex items-center gap-4 xl:gap-6 shrink-0">
              {pathname === "/" ? (
                <Link
                  href="/#track-package"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById("track-package")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="inline-flex items-center gap-1.5 text-sm xl:text-base font-medium text-black hover:text-black transition-colors"
                >
                  <FaArrowRight className="w-4 h-4 xl:w-5 xl:h-5 fill-current shrink-0" />
                  <span>Tracking</span>
                </Link>
              ) : (
                <Link
                  href="/tracking"
                  className="inline-flex items-center gap-1.5 text-sm xl:text-base font-medium text-black hover:text-black transition-colors"
                >
                  <FaArrowRight className="w-4 h-4 xl:w-5 xl:h-5 fill-current shrink-0" />
                  <span>Tracking</span>
                </Link>
              )}
              <Link
                href="/rate-calculator"
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 xl:px-5 xl:py-2.5 text-sm xl:text-base font-medium text-white hover:bg-blue-700 transition-colors shrink-0"
              >
                <span>Rate calculator</span>
                <FaExternalLinkAlt className="w-4 h-4 xl:w-5 xl:h-5 fill-current" />
              </Link>
            </div>

            <button
              className="lg:hidden p-2 rounded-md text-black hover:bg-black/10"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <FaTimes className="h-5 w-5 fill-current" /> : <FaBars className="h-5 w-5 fill-current" />}
            </button>
          </div>

          {/* Mobile menu */}
          {isMenuOpen && (
            <div className="lg:hidden border-t border-black/10 py-4 space-y-1 bg-white">
              {navLinks.map((link) => (
                <Link
                  key={link.href + link.label}
                  href={link.href}
                  onClick={(e) => {
                    handleSectionClick(e, link.href);
                    setIsMenuOpen(false);
                  }}
                  className={`block px-4 py-3 text-lg font-medium ${
                    isActive(link.href) ? "text-slate-900" : "text-slate-700"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {pathname === "/" ? (
                <Link
                  href="/#track-package"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById("track-package")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    setIsMenuOpen(false);
                  }}
                  className="block px-4 py-3 text-lg font-medium text-black"
                >
                  Track order
                </Link>
              ) : (
                <Link
                  href="/tracking"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-4 py-3 text-lg font-medium text-black"
                >
                  Track order
                </Link>
              )}
              <div className="pt-2 px-4">
                <Link
                  href="/rate-calculator"
                  onClick={() => setIsMenuOpen(false)}
                  className="block w-full py-3 text-center text-lg font-medium rounded-full bg-blue-600 text-white"
                >
                  Rate calculator
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default PublicNavbar;
