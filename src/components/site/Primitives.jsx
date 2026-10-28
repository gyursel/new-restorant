import {useSectionConfig} from '@/content/SectionConfig';
import {CmsText} from "@/components/site/PublicText";
import { copy, getContent } from "@/components/site/public-copy";
import { motion, useReducedMotion } from "framer-motion";
export const Reveal = ({
  children,
  delay = 0,
  className = "",
  y = 24
}) => {
  const userReducedMotion = useReducedMotion();
  const reduce = userReducedMotion || getContent()?.appearance?.motion === "reduced";
  const compact = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
  if (reduce || compact) return <div className={className}>{children}</div>;
  return <motion.div className={className} initial={reduce ? false : {
    opacity: 0,
    y
  }} whileInView={{
    opacity: 1,
    y: 0
  }} viewport={{
    once: true,
    amount: 0.12
  }} transition={{
    duration: 0.7,
    delay,
    ease: [0.22, 1, 0.36, 1]
  }}>
      {children}
    </motion.div>;
};
export const SectionHeading = ({
  eyebrow,
  title,
  text,
  id,
  pageTitle = false
}) => {const section=useSectionConfig();title=section.title||title;text=section.description||text;return <Reveal className="max-w-2xl">
    <p className="eyebrow mb-4">{eyebrow}</p>
    {pageTitle ? <h1 id={id} className="font-editorial text-4xl sm:text-5xl lg:text-6xl leading-tight" data-testid="menu-page-title">{title}</h1> : <h2 id={id} className="section-title">{title}</h2>}
    {text && <p className="mt-4 text-sm sm:text-base text-slate-400 leading-relaxed">{text}</p>}
  </Reveal>};
export const Logo = ({
  small = false
}) => getContent()?.settings?.media?.logo_image?<img className="cms-brand-logo" src={getContent().settings.media.logo_image} alt={getContent().settings.restaurant_name||"CHEF'S BURGER"}/>:<span className="eg-brand"><EmberMark size={small ? 30 : 38}/><span className={`brand-wordmark ${small ? "brand-wordmark-small" : ""}`}>
    <span><CmsText field="Primitives_jsx_1"/><span className="text-[#f05255]"><CmsText field="Primitives_jsx_2"/></span><span className="brand-period"><CmsText field="Primitives_jsx_3"/></span></span>
    <span className="brand-tagline"><CmsText field="Primitives_jsx_4"/></span>
  </span></span>;
export const EmberMark = ({size = 38}) => <svg className="eg-mark" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id="eg-mark-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffb547"/><stop offset="1" stopColor="#ef5f0a"/></linearGradient></defs><rect x="1" y="1" width="38" height="38" rx="12" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.16)"/><path d="M20.5 7.5c1.2 4.6 7.5 7.3 7.5 13.6a8 8 0 0 1-16 0c0-3.4 1.8-5.7 3.9-7.3.2 2.6 1.4 4.1 3.1 4.6-.9-3.6-.3-7.4 1.5-10.9z" fill="url(#eg-mark-g)"/></svg>;
export const SampleTag = ({
  children = copy["Primitives_jsx_5"],
  testid = "sample-prices-tag"
}) => <span data-testid={testid} className="inline-flex items-center gap-1.5 rounded-full border border-[#d5b782]/40 bg-[#d5b782]/10 px-3 py-1 text-[11px] font-semibold text-[#d5b782]">
    <span className="h-1.5 w-1.5 rounded-full bg-[#d5b782]" />
    {children}
  </span>;
