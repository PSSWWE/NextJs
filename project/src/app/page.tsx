"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Package, Truck, Globe, Clock, Shield, HeadphonesIcon, Facebook, Twitter, Instagram, MapPin, Phone, Mail, Search, Star } from "lucide-react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { toast } from "sonner";

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const CUSTOMER_STORIES: { name: string; title: string; shortQuote: string; fullQuote: string; photo?: string }[] = [
  { name: "Sajid Aslam", title: "CEO Cormet Group", shortQuote: "Always reliable, always personal—PSS makes shipping easy.", fullQuote: "As a transportation coordinator, I appreciate the simplicity and power of PSS Worldwide's real-time features. Managing fleets, monitoring routes, and addressing issues proactively - all in one place. It's a game-changer for anyone in the logistics field.", photo: "/customers/Sajid.jpeg" },
  { name: "Zubair Suleman", title: "Partner Matila Traders", shortQuote: "Exceptional service with a friendly touch every time.", fullQuote: "We've been using PSS Worldwide for our international shipments for over two years. The tracking is transparent, customer support is responsive, and our packages always arrive when promised. Highly recommend for B2B logistics.", photo: "/customers/Zubair.jpeg" },
  { name: "Shafiq Latif", title: "Swift Global", shortQuote: "Trusted team, smooth delivery, peace of mind.", fullQuote: "As a small business owner, I needed a courier that could handle both domestic and international orders without breaking the bank. PSS Worldwide offered competitive rates and seamless delivery. My customers are happy and so am I." },
  { name: "Najam Alavi", title: "Xenomorph", shortQuote: "Fast, safe, and handled with care—every shipment counts.", fullQuote: "The customs clearance assistance from PSS Worldwide has saved us countless hours. They handle documentation, coordinate with authorities, and keep us informed at every step. Professional and stress-free.", photo: "/customers/Najam.jpeg" },
  { name: "Hamza Asif", title: "Vodoo Spell Botique", shortQuote: "Professional, personal, and always going the extra mile.", fullQuote: "When we have urgent orders or last-minute restocks, PSS's same-day delivery option has been a lifesaver. Fast, secure, and our fragile items always arrive in perfect condition. Worth every penny." },
  { name: "Arshad Rasheed", title: "Owner Friends Tailor", shortQuote: "Your cargo is safe, and the service is seamless.", fullQuote: "We grew from shipping a few dozen boxes a month to hundreds. PSS Worldwide scaled with us—same quality, same reliability. Their freight services and warehouse support made the transition smooth." },
  { name: "Asad Ullah", title: "Partner Alwan Printers", shortQuote: "Reliable, efficient, and truly cares about your shipment.", fullQuote: "We ship time-sensitive medical equipment and supplies. PSS Worldwide understands the urgency and handles every shipment with care. Tracking and notifications give us peace of mind.", photo: "/customers/Asad.jpeg" },
  { name: "Shms ul Haq", title: "Owner Nisar Studio", shortQuote: "Shipping made simple, with a team you can trust.", fullQuote: "Exporting to multiple countries used to be a headache. With PSS Worldwide, we get one point of contact, clear pricing, and deliveries across Asia, Europe, and the Americas. Feels local even when it's global." },
  { name: "Mubashir Malik", title: "GM Minolta Systems", shortQuote: "On time, stress-free, and always professional.", fullQuote: "We ship art and fragile installations. PSS's secure packaging and careful handling mean our pieces arrive exhibition-ready. Their team treats every shipment like it's their own.", photo: "/customers/Mubashir.jpeg" },
  { name: "Abdur Rahman", title: "Director Sphere Traders", shortQuote: "Friendly service, expert handling, and consistent delivery.", fullQuote: "The real-time tracking and proof of delivery have cut down customer disputes and support tickets. We always know where a package is and when it was received. Efficiency went up, stress went down." },
  { name: "Aaida Abu Jaber", title: "Tor Tar Fashion", shortQuote: "Every shipment handled with care and attention.", fullQuote: "We needed a partner who could handle temperature-sensitive organic produce. PSS Worldwide's logistics and cold-chain options have been solid. Fresh delivery, happy customers, fewer losses.", photo: "/customers/Aaida.jpeg" },
  { name: "Amna Shah", title: "Director Rakhtsaaz", shortQuote: "A brilliant team making international shipping effortless.", fullQuote: "We use PSS for both heavy freight and express spare parts. Having one provider for both simplifies invoicing, reporting, and relationship management. Quality and consistency across the board." },
];

const BRANDS = [
  "INTERWOOD",
  "BEECHTREE",
  "Telenor Microfinance Bank",
  "SANAULLA",
  "CHASE UP",
  "Nestlé",
  "Unilever",
  "Packages Limited",
  "Engro",
  "Habib Metropolitan",
  "Lucky Cement",
  "Nishat Mills",
  "Fauji Foods",
  "JDW Sugar",
  "GSK",
  "PepsiCo",
  "Coca-Cola",
  "Philips",
  "Siemens",
  "Toyota",
];

const BRANDS_VISIBLE = 5;
const BRANDS_STEP = 1;

function BrandsSlideshowSection() {
  const [startIndex, setStartIndex] = useState(0);
  const n = BRANDS.length;

  useEffect(() => {
    const t = setInterval(() => {
      setStartIndex((i) => (i + BRANDS_STEP) % n);
    }, 3000);
    return () => clearInterval(t);
  }, [n]);

  const visibleBrands = Array.from({ length: BRANDS_VISIBLE }, (_, k) => BRANDS[(startIndex + k) % n]);

  return (
    <section id="brands" className="py-16 bg-gray-50 dark:bg-gray-900 border-y border-gray-200 dark:border-gray-700 scroll-mt-32">
      <div className="container mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-10"
        >
          Proudly working with
        </motion.h2>
        <div className="flex flex-wrap justify-center items-center gap-6 md:gap-10">
          {visibleBrands.map((name, i) => (
            <motion.div
              key={`${startIndex}-${i}-${name}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="flex items-center justify-center min-w-[140px] md:min-w-[160px] h-16 md:h-20 px-6 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-semibold text-sm md:text-base text-center"
            >
              {name}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const CARDS_PER_VIEW = 3;
const STORIES_STEP = 1;

const STORIES_GAP_PX = 24;

function CustomerStoriesSection() {
  const stories = CUSTOMER_STORIES;
  const numSlides = stories.length;
  const containerRef = useRef<HTMLDivElement>(null);
  const [cardWidth, setCardWidth] = useState(0);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [isResetting, setIsResetting] = useState(false);
  const storiesForStrip = [...stories, ...stories.slice(0, CARDS_PER_VIEW)];
  const stripLength = storiesForStrip.length;

  const activeSlide = displayIndex % numSlides;

  useEffect(() => {
    const t = setInterval(() => {
      setDisplayIndex((i) => (i + STORIES_STEP) % stripLength);
    }, 3000);
    return () => clearInterval(t);
  }, [stripLength]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.offsetWidth;
      setCardWidth((w - 2 * STORIES_GAP_PX) / CARDS_PER_VIEW + STORIES_GAP_PX);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleAnimationComplete = () => {
    if (displayIndex === numSlides) {
      setIsResetting(true);
      setDisplayIndex(0);
    }
  };

  useEffect(() => {
    if (!isResetting) return;
    const id = requestAnimationFrame(() => setIsResetting(false));
    return () => cancelAnimationFrame(id);
  }, [isResetting]);

  const translateX = cardWidth > 0 ? -(displayIndex * cardWidth) : 0;
  const stripWidth = cardWidth > 0 ? stripLength * cardWidth - STORIES_GAP_PX : 0;
  const singleCardWidth = cardWidth > 0 ? cardWidth - STORIES_GAP_PX : 0;

  return (
    <section id="customer-stories" className="py-20 bg-white dark:bg-gray-800 scroll-mt-32">
      <div className="container mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center text-sm font-semibold uppercase tracking-wider text-red-600 dark:text-red-400 mb-2"
        >
          Customer Stories
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
          className="text-center text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-12"
        >
          What Says Our Happy Clients
        </motion.h2>

        <div ref={containerRef} className="w-full max-w-6xl mx-auto overflow-hidden">
          <motion.div
            className="flex flex-row shrink-0"
            style={{
              width: stripWidth || undefined,
              gap: STORIES_GAP_PX,
            }}
            animate={{ x: translateX }}
            transition={{ duration: isResetting ? 0 : 0.45, ease: "easeInOut" }}
            onAnimationComplete={handleAnimationComplete}
          >
            {storiesForStrip.map((story, index) => {
              const initials = story.name.split(" ").map((n) => n[0]).join("").slice(0, 2);
              return (
                <div
                  key={`${story.name}-${story.shortQuote}-${index}`}
                  className="shrink-0 min-w-0 rounded-xl shadow-md border border-gray-100 dark:border-gray-600 p-5 md:p-6 flex flex-col text-left bg-white dark:bg-gray-700"
                  style={{ width: singleCardWidth || undefined }}
                >
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-3">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((_) => (
                        <Star key={_} className="w-5 h-5 fill-current" />
                      ))}
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">(5) Rating</span>
                  </div>
                  <p className="text-base md:text-lg font-bold text-gray-900 dark:text-white mb-2 line-clamp-2">
                    {story.shortQuote}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed flex-1 line-clamp-4">
                    {story.fullQuote}
                  </p>
                  <div className="mt-4 flex items-center gap-3 pt-3 border-t border-gray-100 dark:border-gray-600">
                    <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-blue-700 flex items-center justify-center text-sm font-bold text-white shrink-0 overflow-hidden">
                      {story.photo ? (
                        <img src={story.photo} alt={story.name} className="w-full h-full object-cover" />
                      ) : (
                        initials
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white text-sm">{story.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{story.title}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </motion.div>

          <div className="flex justify-center gap-2 mt-10" role="tablist" aria-label="Customer story slides">
            {Array.from({ length: numSlides }).map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === activeSlide}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setDisplayIndex(i)}
                className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${
                  i === activeSlide ? "bg-blue-600 scale-125" : "bg-gray-300 dark:bg-gray-600 hover:bg-gray-400"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function TrackYourPackageSection() {
  const router = useRouter();
  const [bookingId, setBookingId] = useState("");

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    const id = bookingId.trim();
    if (!id) return;
    router.push(`/tracking?bookingId=${encodeURIComponent(id)}`);
  };

  return (
    <section id="track-package" className="relative py-16 bg-white dark:bg-gray-800 border-t border-b border-gray-100 dark:border-gray-700 scroll-mt-32">
      <div className="container mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2"
        >
          Track Your Shipment
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
          className="text-gray-600 dark:text-gray-400 text-lg mb-8"
        >
          Enter your booking ID to get real-time updates on your shipment
        </motion.p>
        <motion.form
          onSubmit={handleTrack}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 max-w-xl mx-auto"
        >
          <Input
            type="text"
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
            placeholder="Enter booking ID (e.g., 420001)"
            className="flex-1 min-w-0 h-12 px-4 rounded-lg bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus-visible:ring-blue-600 focus-visible:ring-offset-0"
          />
          <Button
            type="submit"
            size="lg"
            className="h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shrink-0"
          >
            <Search className="w-5 h-5 mr-2 inline" />
            Track
          </Button>
        </motion.form>
      </div>
    </section>
  );
}

const HERO_SLIDES = [
  {
    // src: "/banner_new.jpg",
    src: "/Hero7.jpeg",
    alt: "Your trusted delivery partner",
    tagline: "EXPRESS COURIER & LOGISTICS",
    headingLines: ["Fast. Secure. Global.", "Your trusted delivery partner."],
    paragraph: "Reliable shipping solutions to over 100+ countries. Track every shipment in real time.",
  },
  {
    // src: "/truck.jpg",
    src: "/Hero2.jpeg",
    alt: "PSS Worldwide logistics",
    tagline: "FREIGHT & CARGO SOLUTIONS",
    headingLines: ["Freight services.", "Scaled to your business."],
    paragraph: "From single parcels to full-container loads. One partner for all your logistics needs.",
  },
  {
    // src: "/Truck_2.jpg",
    src: "/Hero3.jpeg",
    alt: "PSS Worldwide logistics",
    tagline: "INTERNATIONAL SHIPPING",
    headingLines: ["Borders don't stop us.", "We deliver worldwide."],
    paragraph: "Customs clearance, tracking, and dedicated support. Shipping made simple.",
  },
  {
    src: "/shipment2.jpeg",
    // src: "/shipment.jpeg",
    // src: "/Hero4.jpeg",
    alt: "Your trusted delivery partner",
    tagline: "SAME-DAY & EXPRESS DELIVERY",
    headingLines: ["Urgent? We've got you.", "Fast. Secure. On time."],
    paragraph: "When it has to get there today. Same-day and express options when you need them most.",
  },
  {
    src: "/Hero5.jpeg",
    alt: "Your trusted delivery partner",
    tagline: "TRACKING & TRANSPARENCY",
    headingLines: ["Always know where it is.", "Real-time tracking."],
    paragraph: "From pickup to delivery. Full visibility and proof of delivery for every shipment.",
  },
];

export default function HomePage() {
  const heroRef = useRef<HTMLElement>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "22%"]);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);

  useEffect(() => {
    const t = setInterval(() => {
      setCurrentSlide((i) => (i + 1) % HERO_SLIDES.length);
    }, 5000);
    return () => clearInterval(t);
  }, []);

  // Smooth-scroll to section when landing with a hash (e.g. from navbar on another page)
  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    if (hash) {
      const el = document.getElementById(hash);
      if (el) {
        requestAnimationFrame(() => {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    }
  }, []);

  return (
    <div className="min-h-screen w-full overflow-x-hidden scrollbar-pretty">
      {/* Hero Section - image + left-aligned text, vertical dots, text/image change per slide */}
      <section
        ref={heroRef}
        id="home"
        className="relative w-full min-h-[calc(100vh+25px)] overflow-hidden -mt-[115px] pt-[115px] scroll-mt-0"
      >
        <motion.div className="absolute inset-0" style={{ y: imageY, scale: imageScale }}>
          {HERO_SLIDES.map((slide, index) => (
            <motion.div
              key={slide.src}
              className="absolute inset-0"
              style={{ zIndex: index === currentSlide ? 1 : 0 }}
              initial={false}
              animate={{ opacity: index === currentSlide ? 1 : 0 }}
              transition={{ duration: 0.8 }}
            >
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                priority={index === 0}
                className="object-cover"
              />
            </motion.div>
          ))}
        </motion.div>
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-black/40 z-1" aria-hidden />
        {/* Left-aligned content + vertical dots - fixed top position so dots/text don't jump when slide content length changes */}
        <div className="absolute inset-0 flex items-start z-10 pt-[34%] sm:pt-[32%] md:pt-[30%]">
          <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-start gap-6 sm:gap-8 md:gap-10">
              {/* Vertical dot navigation - fixed position, no pt that would shift */}
              <div className="flex flex-col gap-3 shrink-0" role="tablist" aria-label="Hero slides">
                {HERO_SLIDES.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={i === currentSlide}
                    aria-label={`Go to slide ${i + 1}`}
                    onClick={() => setCurrentSlide(i)}
                    className={`rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white/50 ${
                      i === currentSlide
                        ? "w-3 h-3 sm:w-3.5 sm:h-3.5 bg-blue-500 ring-0"
                        : "w-3 h-3 sm:w-3.5 sm:h-3.5 border-2 border-white bg-transparent hover:border-white/80"
                    }`}
                  />
                ))}
              </div>
              {/* Text content - changes with slide */}
              <div className="min-w-0 flex-1 max-w-2xl lg:max-w-3xl">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentSlide}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.4 }}
                    className="text-left"
                  >
                    <p className="text-xs sm:text-sm font-medium tracking-widest uppercase text-blue-400 mb-3 sm:mb-4">
                      {HERO_SLIDES[currentSlide].tagline}
                    </p>
                    <div className="flex flex-row flex-wrap items-baseline gap-x-4 gap-y-1 sm:gap-x-5 sm:gap-y-2">
                      {HERO_SLIDES[currentSlide].headingLines.map((line, i) => (
                        <h1
                          key={i}
                          className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-6xl 2xl:text-6xl font-bold text-white leading-tight tracking-tight whitespace-nowrap"
                        >
                          {line}
                        </h1>
                      ))}
                    </div>
                    <p className="mt-4 sm:mt-6 text-sm sm:text-base text-gray-300 max-w-lg">
                      {HERO_SLIDES[currentSlide].paragraph}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-white dark:bg-gray-800 scroll-mt-30">
        <div className="container mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-6">
                About PSS Worldwide
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
                PSS Worldwide is a leading courier and logistics company committed to providing 
                fast, reliable, and affordable shipping solutions to customers worldwide.
              </p>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
                With years of experience in the industry, we have built a reputation for 
                excellence in international shipping, express delivery, and freight services.
              </p>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
                Our state-of-the-art tracking system ensures you always know where your package is, 
                and our dedicated team works around the clock to ensure timely and secure delivery.
              </p>
              <Link href="/about">
                <Button size="lg" className="bg-[#1a365d] hover:bg-[#2c5282] text-white hover:scale-105 transition-transform">
                  Learn More About Us
                </Button>
              </Link>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative h-96 rounded-xl overflow-hidden shadow-2xl"
            >
              <Image
                src="/truck.jpg"
                alt="About Us"
                fill
                className="object-cover"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* You're in Good Company */}
      <section id="good-company" className="py-20 bg-white dark:bg-gray-800 scroll-mt-32">
        <div className="container mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              You&apos;re in Good Company
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            We leverage a premium network of international shipping giants to offer you flexible, fast, and secure delivery solutions for every single package.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex justify-center"
          >
            <Image
              src="/boxes.png"
              alt="Shipping partners - FedEx, UPS, DPD, EVRi, DHL, Parcelforce Worldwide"
              width={800}
              height={450}
              className="w-full max-w-3xl h-auto object-contain"
            />
          </motion.div>
        </div>
      </section>

      {/* Proudly working with - brands slideshow */}
      <BrandsSlideshowSection />

      {/* Services Section */}
      <section id="services" className="py-20 bg-gray-50 dark:bg-gray-900 scroll-mt-24">
        <div className="container mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Our Services
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Comprehensive courier solutions tailored to meet your shipping needs
            </p>
          </motion.div>
          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {[
              { icon: Package, title: "Express Delivery", desc: "Fast and secure express delivery services to over 100+ countries worldwide.", color: "blue" },
              { icon: Truck, title: "Freight Services", desc: "Reliable freight and cargo services for businesses of all sizes.", color: "green" },
              { icon: Globe, title: "International Shipping", desc: "Seamless international shipping with customs clearance support.", color: "purple" },
              { icon: Clock, title: "Same-Day Delivery", desc: "Urgent delivery options available for time-sensitive shipments.", color: "orange" },
              { icon: Shield, title: "Secure Packaging", desc: "Professional packaging services to ensure your items arrive safely.", color: "red" },
              { icon: HeadphonesIcon, title: "24/7 Support", desc: "Round-the-clock customer support to assist you whenever you need help.", color: "cyan" },
            ].map((service, index) => {
              const Icon = service.icon;
              return (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  whileHover={{ y: -8, scale: 1.02 }}
                  className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 border border-gray-100 dark:border-gray-700"
                >
                  <div className={`w-12 h-12 bg-${service.color}-100 dark:bg-${service.color}-900 rounded-lg flex items-center justify-center mb-4`}>
                    <Icon className={`w-6 h-6 text-${service.color}-600 dark:text-${service.color}-400`} />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    {service.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {service.desc}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Track Your Package */}
      <TrackYourPackageSection />

      {/* Customer Stories Section */}
      <CustomerStoriesSection />

      {/* Contact Section - dark footer with map and form */}
      <ContactSection />
    </div>
  );
}

const SERVICES_OPTIONS = [
  "Express Delivery",
  "Freight Services",
  "International Shipping",
  "Same-Day Delivery",
  "Secure Packaging",
  "General Inquiry",
];

function ContactSection() {
  const [formData, setFormData] = useState({
    company: "",
    name: "",
    phone: "",
    email: "",
    service: "",
    message: "",
  });
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      toast.error("Please fill in Name, Email and Message.");
      return;
    }
    if (!privacyAccepted) {
      toast.error("Please accept the privacy policy.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: formData.company || undefined,
          name: formData.name,
          phone: formData.phone || undefined,
          email: formData.email,
          service: formData.service || undefined,
          message: formData.message,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to send. Please try again or email us directly.");
        return;
      }
      toast.success("Thank you for your message! We'll get back to you soon.");
      setFormData({ company: "", name: "", phone: "", email: "", service: "", message: "" });
      setPrivacyAccepted(false);
    } catch {
      toast.error("Failed to send. Please try again or email us directly.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      id="contact"
      className="relative text-white overflow-hidden scroll-mt-30 bg-cover bg-center bg-no-repeat min-h-[calc(100vh-80px)] flex items-stretch"
      style={{ backgroundImage: "url('/map.jpeg')" }}
    >
      {/* Black tint over background image */}
      <div className="absolute inset-0 bg-black/75" aria-hidden />
      {/* Top blue line */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#2563eb]" aria-hidden />
      {/* Subtle dotted pattern */}
      <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] bg-size-[24px_24px]" aria-hidden />

      <div className="relative z-10 pt-8 pb-6 w-full max-w-screen-2xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 flex flex-col">
        {/* Four columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-8 mb-8">
          {/* Column 1: Logo + description */}
          <div>
            <Link href="/" className="inline-block mb-4">
              <img src="/logo_final.png" alt="PSS Worldwide" className="h-10 w-auto object-contain" />
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
              Fast, secure, and reliable courier and logistics solutions. Your trusted delivery partner for express shipping worldwide.
            </p>
          </div>

          {/* Column 2: Contact */}
          <div>
            <h3 className="font-bold text-white uppercase tracking-wide mb-4">Contact</h3>
            <ul className="space-y-3 text-gray-400 text-sm">
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                <span>LGF-44, Land Mark Plaza, Jail Road<br />Lahore, 54660, Pakistan</span>
              </li>
              <li>
                <a href="tel:+92 42 35716494" className="flex items-center gap-2 hover:text-white transition-colors">
                  <Phone className="w-4 h-4 shrink-0" /> +92 42 35716494
                </a>
              </li>
              <li>
                <a href="mailto:info@psswwe.com" className="flex items-center gap-2 hover:text-white transition-colors">
                  <Mail className="w-4 h-4 shrink-0" /> info@psswwe.com
                </a>
              </li>
              <li className="pt-2 flex flex-wrap gap-x-2 gap-y-1">
                <a href="#" className="hover:text-white transition-colors">Legal Notice</a>
                <span aria-hidden>|</span>
                <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              </li>
            </ul>
          </div>

          {/* Column 3: Navigation */}
          <div>
            <h3 className="font-bold text-white uppercase tracking-wide mb-4">Navigation</h3>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><a href="#home" className="hover:text-white transition-colors">Home</a></li>
              <li><a href="#about" className="hover:text-white transition-colors">About</a></li>
              <li><a href="#services" className="hover:text-white transition-colors">Service</a></li>
              <li><a href="#contact" className="hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>

          {/* Column 4: Social media */}
          <div>
            <h3 className="font-bold text-white uppercase tracking-wide mb-4">Social media</h3>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>
                <a href="#" className="flex items-center gap-2 hover:text-white transition-colors" aria-label="Facebook">
                  <Facebook className="w-4 h-4" /> Facebook
                </a>
              </li>
              <li>
                <a href="#" className="flex items-center gap-2 hover:text-white transition-colors" aria-label="Twitter">
                  <Twitter className="w-4 h-4" /> Twitter
                </a>
              </li>
              <li>
                <a href="#" className="flex items-center gap-2 hover:text-white transition-colors" aria-label="Instagram">
                  <Instagram className="w-4 h-4" /> Instagram
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Map + Contact form row */}
        <div className="grid grid-cols-1 lg:grid-cols-[2.1fr_0.9fr] gap-6 pt-4 border-t border-white/10 flex-1 items-start">
          {/* Map - slightly taller but still compact */}
          <div className="rounded-lg overflow-hidden bg-gray-800/50 h-[240px] sm:h-[400px]">
            <iframe
              title="PSS Worldwide - Land Mark Plaza, Jail Road, Lahore"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3400.6058668977444!2d74.3469253!3d31.5349833!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x391905ede7407d95%3A0x3731d66c5f937a1f!2sPrompt%20Survey%20%26%20Services%20(PSS)!5e0!3m2!1sen!2s!4v1769604264555!5m2!1sen!2s"
              className="w-full h-full border-0"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          {/* Contact form */}
          <div className="max-h-[240px] sm:max-h-[400px]">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="company" className="text-gray-300 text-sm">Company</Label>
                  <Input id="company" name="company" value={formData.company} onChange={handleChange} placeholder="Company" className="bg-gray-800/50 border-gray-600 text-white placeholder:text-gray-500 focus-visible:ring-[#2563eb]" />
                </div>
                <div>
                  <Label htmlFor="contact-name" className="text-gray-300 text-sm">Name</Label>
                  <Input id="contact-name" name="name" value={formData.name} onChange={handleChange} placeholder="Name" required className="bg-gray-800/50 border-gray-600 text-white placeholder:text-gray-500 focus-visible:ring-[#2563eb]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="contact-phone" className="text-gray-300 text-sm">Phone</Label>
                  <Input id="contact-phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} placeholder="Phone" className="bg-gray-800/50 border-gray-600 text-white placeholder:text-gray-500 focus-visible:ring-[#2563eb]" />
                </div>
                <div>
                  <Label htmlFor="contact-email" className="text-gray-300 text-sm">Email</Label>
                  <Input id="contact-email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="Email" required className="bg-gray-800/50 border-gray-600 text-white placeholder:text-gray-500 focus-visible:ring-[#2563eb]" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300 text-sm">Select a service</Label>
                <Select value={formData.service} onValueChange={(v) => setFormData({ ...formData, service: v })}>
                  <SelectTrigger className="mt-1 w-full bg-gray-800/50 border-gray-600 text-white focus:ring-[#2563eb] [&>span]:text-gray-300">
                    <SelectValue placeholder="Select a service" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    {SERVICES_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s} className="text-white focus:bg-gray-700 focus:text-white">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-message" className="text-gray-300 text-sm">Message</Label>
                <Textarea
                  id="contact-message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Message"
                  required
                  rows={3}
                  className="mt-1 bg-gray-800/50 border-gray-600 text-white placeholder:text-gray-500 focus-visible:ring-[#2563eb]"
                />
              </div>
              <div className="flex items-start gap-2">
                <Checkbox id="privacy" checked={privacyAccepted} onCheckedChange={(v) => setPrivacyAccepted(!!v)} className="border-gray-500 data-[state=checked]:bg-[#2563eb] data-[state=checked]:border-[#2563eb] mt-0.5" />
                <label htmlFor="privacy" className="text-gray-500 text-xs cursor-pointer">
                  I agree to the processing of my data in accordance with the privacy policy.
                </label>
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white">
                {loading ? "Sending..." : "Send"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
