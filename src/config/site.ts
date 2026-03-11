export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "Ridgefield Golf Club",
  description: `The RIDGEFIELD GOLF CLUB was established in 1974. Our club consists of approximately 300 members, both residents and non-residents of Ridgefield, CT with all levels of golfing skill. 
  
  The purpose of our club is to promote competition, camaraderie and fun. We have about 15 tournaments a year that are open to all club members. 
  
  Tournament winners receive Ridgefield Golf Course Pro-Shop credit which can be used for golf merchandise.`,
  links: {},
  contactEmail: "RidgefieldCTGolfClub@gmail.com",
  contactAddress: {
    name: "RGC",
    street: "PO Box 24",
    cityStateZip: "Ridgefield, CT 06877",
  },
  pages: {
    home: {
      title: "Home",
      description: "Welcome to the Ridgefield Golf Club",
      link: "/",
      icon: "lucide:home",
    },
    membership: {
      title: "Membership",
      description: "Join the Ridgefield Golf Club",
      link: "/membership",
      icon: "lucide:user-plus",
    },
    membershipV2: {
      title: "Membership (New Flow)",
      description: "Compare the new membership payment flow",
      link: "/membership-v2",
      icon: "lucide:credit-card",
    },
    directory: {
      title: "Member Directory",
      description: "View all members",
      link: "/membership/member-directory",
      icon: "lucide:users",
    },
    membershipDashboard: {
      title: "Membership Dashboard",
      description: "View membership payments and donations",
      link: "/admin/membership/dashboard",
      icon: "lucide:layout-dashboard",
    },
    board: {
      title: "Board of Governors",
      description: "Club leadership team",
      link: "/board",
      icon: "lucide:shield",
    },
    about: {
      title: "About",
      description: "Learn more about the Ridgefield Golf Club",
      link: "/about",
      icon: "lucide:info",
    },
    policies: {
      title: "Policies & Rules",
      description: "Club policies and course rules",
      link: "/policies",
      icon: "lucide:scroll-text",
    },
    handicapPolicy: {
      title: "RGC Handicap Policy",
      description: "Club policy on posting scores and maintaining handicaps",
      link: "/policies/handicap-policy",
      icon: "lucide:calculator",
    },
    localRules: {
      title: "Local Rules",
      description: "Local rules for Ridgefield Golf Course",
      link: "/policies/local-rules",
      icon: "lucide:map-pin",
    },
    cookies: {
      title: "Cookie Policy",
      description: "How we use cookies and how to manage your preferences",
      link: "/cookies",
      icon: "lucide:cookie",
    },
    contact: {
      title: "Contact Us",
      description: "Get in touch with the Ridgefield Golf Club",
      link: "/contact",
      icon: "lucide:mail",
    },
    terms: {
      title: "Terms of Use",
      description: "Rules for using the Ridgefield Golf Club website",
      link: "/terms",
      icon: "lucide:scale",
    },
    privacy: {
      title: "Privacy Policy",
      description: "How we collect and protect member information",
      link: "/privacy",
      icon: "lucide:lock",
    },
    login: {
      title: "Login",
      description: "Login to your Ridgefield Golf Club account",
      link: "/login",
    },
    signup: {
      title: "Sign Up",
      description: "Sign up for a Ridgefield Golf Club account",
      link: "/signup",
    },
    profile: {
      title: "Profile",
      description: "View and edit your profile",
      link: "/profile",
    },
    pastchampions: {
      title: "Past Champions",
      description:
        "View past champions of the Ridgefield Golf Club tournaments",
      link: "/past-champions",
      icon: "lucide:award",
    },
    tournaments: {
      title: "Tournaments",
      description: "Ridgefield Golf Club tournaments",
      link: "/tournaments",
      icon: "lucide:calendar",
    },
    moneyList: {
      title: "Money List",
      description: "Yearly prize money standings",
      link: "/money-list",
      icon: "lucide:badge-dollar-sign",
    },
    verifyEmail: {
      title: "Verify Email",
      description: "Confirm your email address",
      link: "/verify-email",
      icon: "lucide:check-circle",
    },
    findGame: {
      title: "Find a Game",
      description: "Find playing partners",
      link: "/find-a-game",
      icon: "lucide:handshake",
    },
    blog: {
      title: "Announcements",
      description: "Latest club news and announcements",
      link: "/announcements",
      icon: "lucide:newspaper",
    },
    adminNotifications: {
      title: "Notifications",
      description: "Send and manage member notifications",
      link: "/admin/notifications",
      icon: "lucide:bell",
    },
  },
};
