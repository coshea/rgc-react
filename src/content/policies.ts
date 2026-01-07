import { siteConfig } from "@/config/site";

export type PolicySection = {
  title: string;
  body: string;
};

const contactEmail = siteConfig.contactEmail;

export const termsSections: PolicySection[] = [
  {
    title: "Acceptance of Terms",
    body: "By accessing or using the Ridgefield Golf Club (RGC) website you agree to these Terms of Use and to abide by all applicable laws. If you do not agree, please discontinue use immediately.",
  },
  {
    title: "Changes and Contact",
    body: `We may update these Terms from time to time. Continued use of the site after changes become effective constitutes acceptance. Questions may be directed to the Contact page or emailed to ${contactEmail}.`,
  },
  {
    title: "Acceptable Use",
    body: "Do not attempt to disrupt the site, harvest member data, impersonate others, or upload unlawful, defamatory, or infringing content. We may suspend access if we detect misuse or security risks.",
  },
  {
    title: "Contact",
    body: `Questions about this Privacy Policy can be directed through the Contact page or by emailing ${contactEmail}.`,
  },
  {
    title: "Intellectual Property",
    body: "Logos, graphics, and written content on this site belong to Ridgefield Golf Club unless otherwise noted. You may not reproduce or distribute materials without written permission.",
  },
  {
    title: "Disclaimers and Liability",
    body: 'The site is provided on an "as is" basis. RGC disclaims all warranties, including implied warranties of merchantability, fitness for a particular purpose, and non-infringement. To the fullest extent permitted by law, RGC is not liable for indirect or consequential damages arising from your use of the site.',
  },
  {
    title: "Changes and Contact",
    body: `We may update these Terms from time to time. Continued use of the site after changes become effective constitutes acceptance. Questions may be directed to the Contact page or emailed to ${contactEmail}.`,
  },
];

export const privacySections: PolicySection[] = [
  {
    title: "Information We Collect",
    body: "We collect the information you provide when creating an account, registering for tournaments, or submitting forms. This may include your name, email address, phone number, GHIN number, and profile photo. We also collect limited technical data such as IP addresses and device information to maintain security and performance.",
  },
  {
    title: "How We Use Information",
    body: "Data is used to manage memberships, run tournaments, display directory listings, send club announcements, and improve the website. We may send transactional emails related to registrations, billing, or policy updates.",
  },
  {
    title: "Sharing and Disclosure",
    body: "We do not sell your personal data. Information may be shared with trusted service providers (such as payment processors or email delivery services) who assist with club operations and who are bound by confidentiality obligations. We may disclose information if required by law or to protect the rights and safety of members.",
  },
  {
    title: "Cookies and Analytics",
    body: "The site uses cookies and similar technologies to keep you signed in, remember preferences, and understand aggregate usage patterns. You can manage cookies through your browser settings; however, disabling certain cookies may limit functionality.",
  },
  {
    title: "Data Retention and Security",
    body: "We retain member information for as long as the account remains active or as needed to provide services. We use industry-standard safeguards, including encryption and access controls, to protect data. No system is 100% secure, so please notify us immediately if you suspect unauthorized access.",
  },
  {
    title: "Your Choices",
    body: "You may update your profile information at any time from your account dashboard. To request deletion of your account or to opt out of certain communications, contact us using the details below.",
  },
  {
    title: "Contact",
    body: `Questions about this Privacy Policy can be directed through the Contact page or by emailing ${contactEmail}.`,
  },
];
