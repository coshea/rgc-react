export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "Ridgefield Golf Club",
  description: `The RIDGEFIELD GOLF CLUB was established in 1974. Our club consists of approximately 300 members, both residents and non-residents of Ridgefield, CT with all levels of golfing skill. 
  
  The purpose of our club is to promote competition, camaraderie and fun. We have about 15 tournaments a year that are open to all club members. 
  
  Tournament winners receive Ridgefield Golf Course Pro-Shop credit which can be used for golf merchandise.`,
  links: {},
  pages: {
    home: {
      title: "Home",
      description: "Welcome to the Ridgefield Golf Club",
      link: "/",
    },
    membership: {
      title: "Membership",
      description: "Join the Ridgefield Golf Club",
      link: "/membership",
      children: {
        directory: {
          title: "Member Directory",
          description: "View all members",
          link: "/membership/member-directory",
        },
      },
    },
    about: {
      title: "About",
      description: "Learn more about the Ridgefield Golf Club",
      link: "/about",
    },
    policies: {
      title: "Policies/Rules",
      description: "View the policies and rules of the Ridgefield Golf Club",
      link: "/policies",
    },
    contact: {
      title: "Contact Us",
      description: "Get in touch with the Ridgefield Golf Club",
      link: "/#home-contact-section",
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
    },
    tournaments: {
      title: "Tournaments",
      description: "Ridgefield Golf Club tournaments",
      link: "/tournaments",
    },
  },
};
