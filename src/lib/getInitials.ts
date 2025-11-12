const getInitialsFromEmail = (email: string) => {
  if (!email) return "?";
  const username = email.split("@")[0];
  return username.substring(0, 2).toUpperCase();
};

export default getInitialsFromEmail;
