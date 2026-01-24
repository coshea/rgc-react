export const openRegistrationWindow = () => {
  const now = Date.now();
  return {
    registrationStart: new Date(now - 60 * 60 * 1000),
    registrationEnd: new Date(now + 60 * 60 * 1000),
  };
};
